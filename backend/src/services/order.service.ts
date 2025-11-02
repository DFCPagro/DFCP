import mongoose, { Types } from "mongoose";
import Order from "../models/order.model";
import { AvailableMarketStockModel } from "../models/availableMarketStock.model";
import { CreateOrderInput } from "../validations/orders.validation";

import ShiftConfig from "../models/shiftConfig.model";
import { DateTime } from "luxon";
import { getCurrentShift, getNextAvailableShifts } from "./shiftConfig.service";

import { addOrderIdToFarmerOrder } from "./farmerOrder.service";
import { ensureOrderToken } from "./ops.service";

// NEW: FO-based adjusters (no lineId)
import {
  adjustAvailableKgByFOAtomic,
  adjustAvailableUnitsByFOAtomic,
} from "./availableMarketStock.service";

import {
  ORDER_STAGE_DEFS,
  ORDER_STAGE_KEYS,
  ORDER_STAGE_LABELS,
  OrderStageKey,
} from "../models/shared/stage.types";

type ShiftName = "morning" | "afternoon" | "evening" | "night";

/** --------------------------------- types --------------------------------- */

type IdLike = string | Types.ObjectId;
const toOID = (v: IdLike) =>
  v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));



type PayloadItem = CreateOrderInput["items"][number];

/** -------------------------------- helpers -------------------------------- */

/**
 * Derive whether an order is "problem":
 * We look at order.stageKey (current pipeline stage),
 * find that stage entry in order.stages,
 * and check if its status === "problem".
 */
function isOrderProblem(order: {
  stageKey?: string;
  stages?: Array<{ key?: string; status?: string }>;
}): boolean {
  if (!order || !order.stageKey || !Array.isArray(order.stages)) return false;
  const cur = order.stages.find((s) => s && s.key === order.stageKey);
  if (!cur) return false;
  return cur.status === "problem";
}

/**
 * Ensure order.stages[] has an entry for a given stage key.
 * If missing, create one with default "pending".
 * Returns a mutable reference.
 */
function ensureStageEntry(orderDoc: any, key: OrderStageKey) {
  if (!Array.isArray(orderDoc.stages)) {
    orderDoc.stages = [];
  }
  let st = orderDoc.stages.find((s: any) => s?.key === key);
  if (!st) {
    st = {
      key,
      label: ORDER_STAGE_LABELS[key] || key,
      status: "pending",
      expectedAt: null,
      startedAt: null,
      completedAt: null,
      timestamp: new Date(),
      note: "",
    };
    orderDoc.stages.push(st);
  }
  return st;
}

/**
 * On order creation we want:
 * - stageKey = "pending"
 * - stages[0] for "pending" with status "current"
 * - audit "ORDER_CREATED"
 *
 * NOTE: we do NOT close any previous stage here because it's the first stage.
 */
function initOrderStagesAndAudit(orderDoc: any, customerOID: Types.ObjectId, itemsCount: number) {
  const now = new Date();
  const firstStageKey: OrderStageKey = "pending";

  // stageKey
  orderDoc.stageKey = firstStageKey;

  // make sure we have that stage in .stages and mark it current
  const st = ensureStageEntry(orderDoc, firstStageKey);
  st.status = "current";
  st.timestamp = now;
  if (!st.startedAt) st.startedAt = now;
  // completedAt stays null

  // audit
  orderDoc.addAudit(
    customerOID,
    "ORDER_CREATED",
    "Customer placed an order",
    { itemsCount }
  );
}

/** ------------------------ legacy / normalization helpers ------------------------ */

// you already have this type in your codebase; repeating here for clarity
type AmsLine = {
  farmerOrderId?: Types.ObjectId | null;
  pricePerKg?: number; // authoritative price per KG from AMS
  unitMode?: "kg" | "unit" | "mixed";
  estimates?: {
    avgWeightPerUnitKg?: number | null;
    sdKg?: number | null;
  };
};

// legacy = has 'quantity' and no 'quantityKg'/'units'
const isLegacyItem = (it: any): boolean =>
  it &&
  typeof it === "object" &&
  "quantity" in it &&
  !("quantityKg" in it) &&
  !("units" in it);

/**
 * Make sure an AMS line is usable for unit-mode items.
 *
 * What we enforce here:
 * - If this line can be ordered by units (unitMode === "unit" or "mixed"),
 *   then line.estimates.avgWeightPerUnitKg MUST exist and be > 0.
 *
 * We do NOT try to "guess" the avg here because your current AmsLine
 * doesn't carry alternative weight fields (like avgWeightPerUnitGr).
 * So: AMS generation / seeding MUST populate estimates.avgWeightPerUnitKg.
 *
 * If it's missing, we throw *here*, once, with a clear message.
 * After this point, normalizeItem() can assume it's valid and doesn't have
 * to throw per-item anymore.
 */
function ensureAmsLineEstimatesAndValidate(line: AmsLine, foIdForMsg: string) {
  // always ensure estimates object exists so we don't do ?. all over later
  if (!line.estimates) {
    line.estimates = {};
  }

  const requiresPerUnitAvg =
    line.unitMode === "unit" || line.unitMode === "mixed";

  if (requiresPerUnitAvg) {
    const avg = line.estimates.avgWeightPerUnitKg;
    const ok =
      Number.isFinite(avg) &&
      (avg as number) > 0;

    if (!ok) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = [
        `AMS line for farmerOrderId=${foIdForMsg} is missing estimates.avgWeightPerUnitKg (>0) but is sold by unit.`,
        "Fix: when building AvailableMarketStock.items, include estimates.avgWeightPerUnitKg for unit/mixed items.",
      ];
      throw e;
    }
  }

  // also normalize sdKg to at least be a number or undefined
  const sd = line.estimates.sdKg;
  if (!Number.isFinite(sd) || (sd as number) < 0) {
    // it's fine if sdKg is missing; we won't throw
    // just leave it undefined
    delete (line.estimates as any).sdKg;
  }
}

/**
 * prefer payload snapshot, fall back to AMS estimates
 * at this point, after ensureAmsLineEstimatesAndValidate,
 * line.estimates.avgWeightPerUnitKg SHOULD exist (for unit/mixed)
 */
function resolveAvgPerUnit(it: any, amsLine?: AmsLine): number {
  const fromPayload = it?.estimatesSnapshot?.avgWeightPerUnitKg;
  const fromAms = amsLine?.estimates?.avgWeightPerUnitKg;

  const avg =
    Number.isFinite(fromPayload) && (fromPayload as number) > 0
      ? (fromPayload as number)
      : Number.isFinite(fromAms) && (fromAms as number) > 0
      ? (fromAms as number)
      : 0;

  return avg || 0;
}

/**
 * normalize any item into { unitMode, quantityKg, units, avg }
 *
 * IMPORTANT DIFFERENCE:
 * - We REMOVED the internal "throw if units>0 but no avg" block.
 *   That check moved to ensureAmsLineEstimatesAndValidate().
 *   So normalizeItem becomes pure normalization.
 */
function normalizeItem(it: any, amsLine?: AmsLine) {
  if (isLegacyItem(it)) {
    const quantityKg = Math.max(0, Number((it as any).quantity) || 0);
    return {
      unitMode: "kg" as const,
      quantityKg,
      units: 0,
      avg: 0,
    };
  } else {
    const unitMode = (it as any).unitMode ?? "kg";
    const quantityKg = Math.max(0, Number((it as any).quantityKg) || 0);
    const units = Math.max(0, Number((it as any).units) || 0);
    const avg = resolveAvgPerUnit(it, amsLine); // will be >0 for unit/mixed because of earlier validation

    return { unitMode, quantityKg, units, avg };
  }
}

function computeEstimatedKgNormalized(n: {
  quantityKg: number;
  units: number;
  avg: number;
}): number {
  const eff = n.quantityKg + n.units * n.avg;
  return Math.max(0, Math.round(eff * 1000) / 1000);
}

// helper to compute a UI-only per-unit price snapshot
function deriveUnitPrice(
  pricePerKg: number | undefined,
  avgKg: number | undefined | null
) {
  if (!Number.isFinite(pricePerKg) || !(pricePerKg! > 0)) return null;
  if (!Number.isFinite(avgKg) || !(avgKg! > 0)) return null;
  // round to cents for display
  return Math.round(pricePerKg! * avgKg! * 100) / 100;
}

/** ============================================================================
 * CREATE ORDER
 * ============================================================================
 */
export async function createOrderForCustomer(
  userId: IdLike,
  payload: CreateOrderInput
) {
  const session = await mongoose.startSession();

  const customerOID = toOID(userId);
  const amsOID = toOID(payload.amsId);
  const lcOID = toOID(payload.logisticsCenterId);

  let orderDoc: any;
  let orderQR: any;

  try {
    await session.withTransaction(async () => {
      // 1) Load AMS (for line lookup + authoritative shift)
      const ams = await AvailableMarketStockModel.findById(amsOID, {
        items: 1,
        availableShift: 1,
      })
        .lean(false) // keep mongoose doc instances
        .session(session);

      if (!ams) {
        const err: any = new Error("AvailableMarketStock not found");
        err.name = "NotFound";
        throw err;
      }

      // Build quick lookup by farmerOrderId (FO-centric; no subdoc _id)
      const itemsArr: AmsLine[] = Array.isArray((ams as any).items)
        ? ((ams as any).items as any)
        : [];

      const byFO = new Map<string, AmsLine>();

      for (const line of itemsArr) {
        const foIdStr = line?.farmerOrderId ? String(line.farmerOrderId) : "";
        if (!foIdStr) continue;

        // 🔥 critical step:
        // make sure AMS line is valid for unit/mixed
        ensureAmsLineEstimatesAndValidate(line, foIdStr);

        byFO.set(foIdStr, line);
      }

      // 2) Reserve AMS inventory (kg and/or units) — once per requested item
      for (const it of payload.items) {
        const foId = String((it as any).farmerOrderId || "");
        const line = byFO.get(foId);

        if (!line) {
          const err: any = new Error(
            `AMS line not found for farmerOrderId ${(it as any).farmerOrderId}`
          );
          err.name = "BadRequest";
          err.details = [
            "Ensure AMS has a line whose farmerOrderId matches the requested item.",
          ];
          throw err;
        }

        // normalize with validated AMS line
        const n = normalizeItem(it, line);

        // must actually order something
        if (!(n.quantityKg > 0 || n.units > 0)) {
          const err: any = new Error(
            `Invalid item quantities for item ${(it as any).itemId}`
          );
          err.name = "BadRequest";
          throw err;
        }

        // Reserve kg if needed
        if (n.quantityKg > 0) {
          const kg = Math.round(n.quantityKg * 1000) / 1000;
          await adjustAvailableKgByFOAtomic({
            docId: amsOID.toString(),
            farmerOrderId: foId,
            deltaKg: -kg,
            enforceEnoughForReserve: true,
            session,
          });
        }

        // Reserve units if needed
        if (n.units > 0) {
          await adjustAvailableUnitsByFOAtomic({
            docId: amsOID.toString(),
            farmerOrderId: foId,
            unitsDelta: -n.units,
            enforceEnoughForReserve: true,
            session,
          });
        }
      }

      // 3) Create Order (items snapshot normalized)
      const orderPayload: any = {
        customerId: customerOID,

        // map to AddressSchema shape in your model
        deliveryAddress: {
          address: payload.deliveryAddress.address,
          lnt: payload.deliveryAddress.lnt,
          alt: payload.deliveryAddress.alt,
          ...(payload.deliveryAddress.logisticCenterId
            ? { logisticCenterId: payload.deliveryAddress.logisticCenterId }
            : {}),
        },

        deliveryDate: payload.deliveryDate,
        LogisticsCenterId: lcOID,
        shiftName: (ams as any).availableShift,
        amsId: amsOID,
        ...(typeof (payload as any).tolerancePct === "number"
          ? { tolerancePct: (payload as any).tolerancePct }
          : {}),

        items: (payload.items as any[]).map((it) => {
          const foIdStr = String((it as any).farmerOrderId);
          const line = byFO.get(foIdStr);

          const n = normalizeItem(it, line);

          // authoritative pricePerKg:
          const pricePerKg = Number.isFinite(line?.pricePerKg)
            ? Number(line?.pricePerKg)
            : Number.isFinite((it as any).pricePerKg)
            ? Number((it as any).pricePerKg)
            : 0;

          // build snapshot to store on the order item
          const snapshot: any = {};
          const snapAvg = n.avg || line?.estimates?.avgWeightPerUnitKg;
          if (Number.isFinite(snapAvg) && (snapAvg as number) > 0) {
            snapshot.avgWeightPerUnitKg = snapAvg;
          }
          const snapSd = line?.estimates?.sdKg;
          if (Number.isFinite(snapSd) && (snapSd as number) > 0) {
            snapshot.stdDevKg = snapSd;
          }

          const sourceFarmerName =
            (it as any).sourceFarmerName ??
            (line as any)?.farmerName ??
            (line as any)?.farmer?.name ??
            "Unknown Farmer";

          const sourceFarmName =
            (it as any).sourceFarmName ??
            (line as any)?.farmName ??
            (line as any)?.farmer?.farmName ??
            "Unknown Farm";

          return {
            itemId: toOID((it as any).itemId),
            name: (it as any).name,
            imageUrl: (it as any).imageUrl ?? "",
            category: (it as any).category ?? "",
            pricePerUnit: pricePerKg,
            pricePerKg,
            derivedUnitPrice:
              n.unitMode === "unit" || n.unitMode === "mixed"
                ? deriveUnitPrice(
                    pricePerKg,
                    n.avg || line?.estimates?.avgWeightPerUnitKg || null
                  )
                : null,
            unitMode: n.unitMode,
            quantityKg: n.quantityKg,
            units: n.units,
            estimatesSnapshot:
              Object.keys(snapshot).length ? snapshot : undefined,
            sourceFarmerName,
            sourceFarmName,
            farmerOrderId: toOID((it as any).farmerOrderId),
          };
        }),
      };

      // 4) Persist order (so we can run doc methods)
      const created = await Order.create([orderPayload], { session });
      orderDoc = created[0];

      // 5) Link FarmerOrders with estimated kg for this order
      for (const it of payload.items as any[]) {
        const foIdStr = String((it as any).farmerOrderId);
        const line = byFO.get(foIdStr);
        const n = normalizeItem(it, line);

        const estKg = computeEstimatedKgNormalized(n);

        await addOrderIdToFarmerOrder(
          orderDoc._id,
          toOID((it as any).farmerOrderId),
          estKg,
          { session }
        );
      }

      // 6) Init stageKey/stages and add audit "ORDER_CREATED"
      initOrderStagesAndAudit(orderDoc, customerOID, payload.items.length);

      // 7) Save orderDoc with stages + audit
      await orderDoc.save({ session });

      // 8) Mint (or reuse) an order token/QR inside the same txn
      const qrDoc = await ensureOrderToken({
        orderId: orderDoc._id,
        createdBy: customerOID,
        ttlSeconds: 24 * 60 * 60, // 24h
        usagePolicy: "multi-use",
        issuer: customerOID,
        session,
      });

      orderQR = { token: qrDoc.token, sig: qrDoc.sig, scope: qrDoc.scope };
    });

    // committed
    return {
      order: orderDoc.toJSON(),
      orderQR,
    };
  } finally {
    session.endSession();
  }
}



/** ============================================================================
 * LIST latest orders for a customer
 * ============================================================================ */
export async function listOrdersForCustomer(userId: IdLike, limit = 15) {
  const customerOID = toOID(userId);

  const docs = await Order.find({ customerId: customerOID })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 15)))
    .lean()
    .exec();

  return docs;
}

/** ============================================================================
 * SUMMARY for dashboard (current + next shifts)
 * ============================================================================ */

type OrdersSummaryParams = {
  logisticCenterId: string;
  count?: number; // next N shifts (default 5)
};

type SummaryEntry = {
  date: string; // yyyy-LL-dd in LC tz
  shiftName: "morning" | "afternoon" | "evening" | "night";
  orderIds: string[];
  count: number;
  problemCount: number;
};

const dayRangeUtc = (tz: string, ymd: string) => {
  const start = DateTime.fromFormat(ymd, "yyyy-LL-dd", { zone: tz }).startOf(
    "day"
  );
  const end = start.plus({ days: 1 });
  return { startUTC: start.toUTC().toJSDate(), endUTC: end.toUTC().toJSDate() };
};

export async function ordersSummarry(params: OrdersSummaryParams) {
  const { logisticCenterId, count = 5 } = params;

  // find timezone for LC
  const anyCfg = await ShiftConfig.findOne(
    { logisticCenterId },
    { timezone: 1 }
  )
    .lean<{ timezone?: string }>()
    .exec();

  if (!anyCfg)
    throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = anyCfg.timezone || "Asia/Jerusalem";

  // current shift (name) in tz
  const currentShiftName = await getCurrentShift();

  // helper: summarize a (date, shiftName) window
  async function summarizeWindow(dateStr: string, shiftName: ShiftName) {
    const { startUTC, endUTC } = dayRangeUtc(tz, dateStr);
    const docs = await Order.find(
      {
        LogisticsCenterId: new Types.ObjectId(logisticCenterId),
        shiftName,
        deliveryDate: { $gte: startUTC, $lt: endUTC },
      },
      { _id: 1, stageKey: 1, stages: 1 }
    )
      .lean()
      .exec();

    const orderIds = docs.map((d) => String(d._id));
    const problemCount = docs.filter((d) => isOrderProblem(d)).length;

    return {
      date: dateStr,
      shiftName,
      orderIds,
      count: orderIds.length,
      problemCount,
    } as SummaryEntry;
  }

  if (currentShiftName === "none") {
    // no active shift now — still return next N shifts only
    const nextShifts = await getNextAvailableShifts({
      logisticCenterId,
      count,
    });

    const summaries = await Promise.all(
      nextShifts.map(async (s) =>
        summarizeWindow(s.date, s.name as ShiftName)
      )
    );

    return {
      current: null,
      next: summaries,
      tz,
      lc: logisticCenterId,
    };
  }

  // we DO have an active shift
  const todayYmd = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");

  // next N shifts after now
  const nextShifts = await getNextAvailableShifts({ logisticCenterId, count });

  // build the 1 (current) + N (next) targets
  const targets: Array<{ date: string; name: ShiftName }> = [
    { date: todayYmd, name: currentShiftName as ShiftName },
    ...nextShifts.map((s) => ({ date: s.date, name: s.name as ShiftName })),
  ];

  const results = await Promise.all(
    targets.map((t) => summarizeWindow(t.date, t.name))
  );

  const [current, ...next] = results;
  return {
    current,
    next,
    tz,
    lc: logisticCenterId,
  };
}

/** ============================================================================
 * LIST orders for a given shift+date (CS manager screen)
 * ============================================================================ */
export async function listOrdersForShift(params: {
  logisticCenterId: string;
  date: string; // yyyy-LL-dd in LC timezone
  shiftName: ShiftName;
  status?: string; // kept for backward compat in callers, but no longer used to filter "problem"
  page?: number; // default 1
  limit?: number; // default 50
  fields?: string[]; // optional projection
}) {
  const {
    logisticCenterId,
    date,
    shiftName,
    status,
    page = 1,
    limit = 50,
    fields,
  } = params;

  // Resolve timezone for this LC (same approach as summary)
  const cfg = await ShiftConfig.findOne({ logisticCenterId }, { timezone: 1 })
    .lean()
    .exec();
  if (!cfg)
    throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = cfg.timezone || "Asia/Jerusalem";

  // Convert date (in LC tz) to UTC day window
  const start = DateTime.fromFormat(date, "yyyy-LL-dd", { zone: tz }).startOf(
    "day"
  );
  if (!start.isValid)
    throw new Error(`Invalid date '${date}', expected yyyy-LL-dd`);
  const end = start.plus({ days: 1 });

  const q: any = {
    LogisticsCenterId: new Types.ObjectId(logisticCenterId),
    shiftName,
    deliveryDate: {
      $gte: start.toUTC().toJSDate(),
      $lt: end.toUTC().toJSDate(),
    },
  };

  // NOTE: you used to filter by `status`; now there's no `status` field on Order.
  // We keep `status` param for backward compat, but it's ignored here.
  // (If later you want "problemOnly", do that at controller level w/ isOrderProblem.)

  const projection =
    Array.isArray(fields) && fields.length
      ? fields.reduce((acc, f) => ((acc[f] = 1), acc), {} as Record<string, 1>)
      : undefined;

  const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

  // Fetch paged orders
  const [items, total, allForWindow] = await Promise.all([
    Order.find(q, projection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Order.countDocuments(q),
    // we'll reuse this to compute problemCount
    Order.find(q, { _id: 1, stageKey: 1, stages: 1 }).lean().exec(),
  ]);

  const problemCount = allForWindow.filter((d) => isOrderProblem(d)).length;

  return {
    meta: {
      lc: logisticCenterId,
      date,
      shiftName,
      tz,
      page,
      limit,
      total,
      problemCount,
      pages: Math.ceil(total / Math.max(1, limit)),
    },
    items,
  };
}
