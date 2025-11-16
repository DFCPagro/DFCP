// src/services/order.service.ts
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
  ORDER_STAGE_KEYS,
  ORDER_STAGE_LABELS,
  OrderStageKey,
} from "../models/shared/stage.types";
import ApiError from "@/utils/ApiError";
import ContainerOps from "@/models/ContainerOps.model";
import Shelf from "@/models/Shelf.model";
import Item from "@/models/Item.model";

// 🔸 shared audit helper
import { pushHistoryAuditTrail } from "./auditTrail.service";

// 🔸 use the centralized stage machine
import { updateOrderStageStatusSystem } from "./orderStages.service";

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
 * Only emits an ORDER_CREATED audit entry.
 * Stage changes are handled by orderStages.service.
 */
function addOrderCreatedAudit(
  orderDoc: any,
  customerOID: Types.ObjectId,
  itemsCount: number
) {
  const now = new Date();
  pushHistoryAuditTrail(orderDoc, {
    userId: customerOID,
    action: "ORDER_CREATED",
    note: "Customer placed an order",
    meta: { itemsCount },
    timestamp: now,
  });
}

/** ------------------------ legacy / normalization helpers ------------------------ */

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
 */
function ensureAmsLineEstimatesAndValidate(line: AmsLine, foIdForMsg: string) {
  if (!line.estimates) {
    line.estimates = {};
  }

  const requiresPerUnitAvg =
    line.unitMode === "unit" || line.unitMode === "mixed";

  if (requiresPerUnitAvg) {
    const avg = line.estimates.avgWeightPerUnitKg;
    const ok = Number.isFinite(avg) && (avg as number) > 0;

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

  const sd = line.estimates.sdKg;
  if (!Number.isFinite(sd) || (sd as number) < 0) {
    delete (line.estimates as any).sdKg;
  }
}

/**
 * prefer payload snapshot, fall back to AMS estimates
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
    const avg = resolveAvgPerUnit(it, amsLine);

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
        .lean(false)
        .session(session);

      if (!ams) {
        const err: any = new Error("AvailableMarketStock not found");
        err.name = "NotFound";
        throw err;
      }

      const itemsArr: AmsLine[] = Array.isArray((ams as any).items)
        ? ((ams as any).items as any)
        : [];

      const byFO = new Map<string, AmsLine>();

      for (const line of itemsArr) {
        const foIdStr = line?.farmerOrderId ? String(line.farmerOrderId) : "";
        if (!foIdStr) continue;

        ensureAmsLineEstimatesAndValidate(line, foIdStr);
        byFO.set(foIdStr, line);
      }

      // 2) Reserve AMS inventory (kg and/or units)
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

        const n = normalizeItem(it, line);

        if (!(n.quantityKg > 0 || n.units > 0)) {
          const err: any = new Error(
            `Invalid item quantities for item ${(it as any).itemId}`
          );
          err.name = "BadRequest";
          throw err;
        }

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

          const pricePerKg = Number.isFinite(line?.pricePerKg)
            ? Number(line?.pricePerKg)
            : Number.isFinite((it as any).pricePerKg)
            ? Number((it as any).pricePerKg)
            : 0;

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
            estimatesSnapshot: Object.keys(snapshot).length
              ? snapshot
              : undefined,
            sourceFarmerName,
            sourceFarmName,
            farmerOrderId: toOID((it as any).farmerOrderId),
          };
        }),
      };

      const created = await Order.create([orderPayload], { session });
      orderDoc = created[0];

      // 4) Link FarmerOrders with estimated kg for this order
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

      // 5) Emit ORDER_CREATED audit (no stage changes here)
      addOrderCreatedAudit(orderDoc, customerOID, payload.items.length);

      // 6) Save orderDoc with audit
      await orderDoc.save({ session });

      // 7) Mint order QR inside the same txn
      const qrDoc = await ensureOrderToken({
        orderId: orderDoc._id,
        createdBy: customerOID,
        ttlSeconds: 24 * 60 * 60,
        usagePolicy: "multi-use",
        issuer: customerOID,
        session,
      });

      orderQR = { token: qrDoc.token, sig: qrDoc.sig, scope: qrDoc.scope };
    });

    // 🔸 After successful transaction, move pipeline pending → confirmed
    // One call with stageKey "pending" + action "ok":
    // - marks "pending" done
    // - auto-advances to "confirmed" as current
    try {
      await updateOrderStageStatusSystem({
        orderId: String(orderDoc._id),
        stageKey: "pending",
        action: "ok",
        note: "Auto-confirm after successful creation",
      });
    } catch (e) {
      // Don't break order creation if stage auto-advance fails
      console.error("Auto-confirm stage failed for order", orderDoc?._id, e);
    }

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
 * ============================================================================
 */
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
 * ============================================================================
 */

type OrdersSummaryParams = {
  logisticCenterId: string;
  count?: number; // next N shifts (default 5)
};

type SummaryEntry = {
  date: string;
  shiftName: ShiftName;
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

  const anyCfg = await ShiftConfig.findOne(
    { logisticCenterId },
    { timezone: 1 }
  )
    .lean<{ timezone?: string }>()
    .exec();

  if (!anyCfg)
    throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = anyCfg.timezone || "Asia/Jerusalem";

  const currentShiftName = await getCurrentShift();

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
    const nextShifts = await getNextAvailableShifts({
      logisticCenterId,
      count,
    });

    const summaries = await Promise.all(
      nextShifts.map(async (s) => summarizeWindow(s.date, s.name as ShiftName))
    );

    return {
      current: null,
      next: summaries,
      tz,
      lc: logisticCenterId,
    };
  }

  const todayYmd = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");
  const nextShifts = await getNextAvailableShifts({ logisticCenterId, count });

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
 * ============================================================================
 */
export async function listOrdersForShift(params: {
  logisticCenterId: string;
  date: string;
  shiftName: ShiftName;
  status?: string;
  page?: number;
  limit?: number;
  fields?: string[];
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

  const cfg = await ShiftConfig.findOne({ logisticCenterId }, { timezone: 1 })
    .lean()
    .exec();
  if (!cfg)
    throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = cfg.timezone || "Asia/Jerusalem";

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

  const projection =
    Array.isArray(fields) && fields.length
      ? fields.reduce((acc, f) => ((acc[f] = 1), acc), {} as Record<string, 1>)
      : undefined;

  const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

  const [items, total, allForWindow] = await Promise.all([
    Order.find(q, projection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Order.countDocuments(q),
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

/**
 * Convert a single order line into required weight (kg),
 * respecting the user's chosen mode (kg or unit).
 */
async function requiredKgForLine(it: any): Promise<number> {
  const mode: "kg" | "unit" | "mixed" | undefined = it.unitMode;

  const qtyKg = Number(it.quantityKg ?? 0);
  const units = Number(it.units ?? 0);

  const snapshotAvgKg =
    it.estimatesSnapshot?.avgWeightPerUnitKg != null
      ? Number(it.estimatesSnapshot.avgWeightPerUnitKg)
      : null;

  let avgKg = snapshotAvgKg;

  if (avgKg == null) {
    const item = await Item.findById(it.itemId, {
      avgWeightPerUnitGr: 1,
      "sellModes.byKg": 1,
      "sellModes.byUnit": 1,
    }).lean();
    if (item?.avgWeightPerUnitGr != null) {
      avgKg = item.avgWeightPerUnitGr / 1000;
    }
  }

  if (mode === "kg") {
    return Math.max(0, qtyKg);
  }

  if (mode === "unit") {
    if (avgKg == null) {
      throw new ApiError(
        422,
        `Missing avgWeightPerUnit for unit-mode item: ${it.name || it.itemId}`
      );
    }
    return Math.max(0, units * avgKg);
  }

  if (qtyKg > 0) return qtyKg;
  if (units > 0 && avgKg != null) return units * avgKg;

  return 0;
}

/**
 * Check if ALL items of an Order can be fully picked from **picker** shelves.
 */
export async function canFulfillOrderFromPickerShelves(
  orderId: string | Types.ObjectId
) {
  const _id =
    typeof orderId === "string" ? new Types.ObjectId(orderId) : orderId;
  const order = await Order.findById(_id).lean();
  if (!order) throw new ApiError(404, "Order not found");

  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new ApiError(400, "Order has no items");
  }

  const requirements = [];
  for (const line of order.items) {
    const requiredKg = await requiredKgForLine(line);
    requirements.push({
      itemId: String(line.itemId),
      name: line.name,
      requiredKg,
    });
  }

  const itemIds = [...new Set(requirements.map((r) => r.itemId))]
    .filter(Boolean)
    .map((id) => new Types.ObjectId(id));

  if (itemIds.length === 0) {
    return {
      ok: true,
      summary: { totalRequired: 0, totalAvailable: 0, totalShort: 0 },
    };
  }

  const pickerAvailability = await ContainerOps.aggregate([
    { $match: { itemId: { $in: itemIds } } },
    { $unwind: "$distributedWeights" },
    {
      $lookup: {
        from: Shelf.collection.name,
        localField: "distributedWeights.shelfId",
        foreignField: "_id",
        as: "shelf",
      },
    },
    { $unwind: "$shelf" },
    { $match: { "shelf.type": "picker" } },
    {
      $group: {
        _id: "$itemId",
        totalAvailableKg: {
          $sum: { $toDouble: "$distributedWeights.weightKg" },
        },
      },
    },
  ]);

  const availableMap = new Map<string, number>();
  for (const row of pickerAvailability) {
    availableMap.set(String(row._id), Number(row.totalAvailableKg ?? 0));
  }

  let totalRequired = 0;
  let totalAvailable = 0;
  const missing: any[] = [];

  for (const req of requirements) {
    const avail = availableMap.get(req.itemId) ?? 0;
    totalRequired += req.requiredKg;
    totalAvailable += Math.min(avail, req.requiredKg);
    if (avail + 1e-9 < req.requiredKg) {
      missing.push({
        itemId: req.itemId,
        name: req.name,
        requiredKg: req.requiredKg,
        availableKg: avail,
        shortByKg: req.requiredKg - avail,
      });
    }
  }

  const summary = {
    totalRequired,
    totalAvailable,
    totalShort: Math.max(0, totalRequired - totalAvailable),
  };

  return missing.length === 0
    ? { ok: true, summary }
    : { ok: false, summary, missing };
}
