// src/services/order.service.ts
import mongoose, { Types } from "mongoose";
import Order from "../models/order.model";
import { AvailableMarketStockModel } from "../models/availableMarketStock.model";
import { CreateOrderInput } from "../validations/orders.validation";
import {
  adjustAvailableQtyAtomic,
  adjustAvailableQtyByUnitsAtomic,
} from "./availableMarketStock.service";
import ShiftConfig from "../models/shiftConfig.model";
import { DateTime } from "luxon";
import { getCurrentShift, getNextAvailableShifts } from "./shiftConfig.service";

import { addOrderIdToFarmerOrder } from "./farmerOrder.service";
import { ensureOrderToken } from "./ops.service";

type ShiftName = "morning" | "afternoon" | "evening" | "night";

/** --------------------------------- types --------------------------------- */

type IdLike = string | Types.ObjectId;
const toOID = (v: IdLike) =>
  v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));

type AmsLine = {
  _id: Types.ObjectId;
  farmerOrderId?: Types.ObjectId;
  pricePerUnit?: number; // per KG (AMS is per-KG)
  unitMode?: "kg" | "unit" | "mixed";
  estimates?: {
    avgWeightPerUnitKg?: number | null;
    sdKg?: number | null;
  };
};

type PayloadItem = CreateOrderInput["items"][number];

/** ------------------------ legacy / normalization helpers ------------------------ */

// legacy = has 'quantity' and no 'quantityKg'/'units'
const isLegacyItem = (it: any): boolean =>
  it &&
  typeof it === "object" &&
  "quantity" in it &&
  !("quantityKg" in it) &&
  !("units" in it);

// prefer payload snapshot, fall back to AMS estimates
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

// normalize any item into { unitMode, quantityKg, units, avg }
function normalizeItem(it: PayloadItem, amsLine?: AmsLine) {
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

    // Require avg when reserving by units (unit/mixed with units>0)
    if (
      (unitMode === "unit" || unitMode === "mixed") &&
      units > 0 &&
      !(avg > 0)
    ) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = [
        `Missing avgWeightPerUnitKg for item ${String(
          (it as any).itemId
        )} while units > 0.`,
      ];
      throw e;
    }

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

// ───────────────────────────────────────────────────────────────────────────────
// Create order
// ───────────────────────────────────────────────────────────────────────────────
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

      // Build quick lookup by farmerOrderId
      const itemsArr: AmsLine[] = Array.isArray((ams as any).items)
        ? ((ams as any).items as any)
        : [];
      const byFO = new Map<string, AmsLine>();
      for (const line of itemsArr) {
        const fo = (line as any).farmerOrderId
          ? String((line as any).farmerOrderId)
          : "";
        if (fo) byFO.set(fo, line);
      }

      // 2) Reserve AMS inventory (kg and/or units) — once per item
      for (const it of payload.items) {
        const foId = String((it as any).farmerOrderId || "");
        const line = byFO.get(foId);

        if (!line || !line._id) {
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
          await adjustAvailableQtyAtomic({
            docId: amsOID.toString(),
            lineId: String(line._id),
            deltaKg: -kg,
            enforceEnoughForReserve: true,
            session,
          });
        }

        if (n.units > 0) {
          await adjustAvailableQtyByUnitsAtomic({
            docId: amsOID.toString(),
            lineId: String(line._id),
            unitsDelta: -n.units,
            enforceEnoughForReserve: true,
            session,
          });
        }
      }

      // 3) Create Order (items snapshot normalized)
      const orderPayload: any = {
        customerId: customerOID,
        deliveryAddress: payload.deliveryAddress, // { address, lat/lng normalized in controller/schema }
        deliveryDate: payload.deliveryDate,
        LogisticsCenterId: lcOID,
        // Take the authoritative shift from AMS to avoid mismatch
        shiftName: (ams as any).availableShift,
        amsId: amsOID,
        // Optional tolerancePct: use payload if present; otherwise leave for model default
        ...(typeof (payload as any).tolerancePct === "number"
          ? { tolerancePct: (payload as any).tolerancePct }
          : {}),
        items: (payload.items as PayloadItem[]).map((it) => {
          const line = byFO.get(String((it as any).farmerOrderId));
          const n = normalizeItem(it, line);

          const pricePerKg = Number.isFinite((it as any).pricePerUnit)
            ? Number((it as any).pricePerUnit)
            : Number((line as any)?.pricePerUnit ?? 0);

          const snapshot: any = {};
          const snapAvg = n.avg || line?.estimates?.avgWeightPerUnitKg;
          if (Number.isFinite(snapAvg) && (snapAvg as number) > 0)
            snapshot.avgWeightPerUnitKg = snapAvg;
          const snapSd = line?.estimates?.sdKg;
          if (Number.isFinite(snapSd) && (snapSd as number) > 0)
            snapshot.stdDevKg = snapSd;

          return {
            itemId: toOID((it as any).itemId),
            name: (it as any).name,
            imageUrl: (it as any).imageUrl ?? "",
            category: (it as any).category ?? "",
            pricePerUnit: pricePerKg, // per KG (legacy name in schema)
            pricePerKg,               // keep explicit too if your model stores it
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
            sourceFarmerName: (it as any).sourceFarmerName,
            sourceFarmName: (it as any).sourceFarmName,
            farmerOrderId: toOID((it as any).farmerOrderId),
          };
        }),
      };

      const created = await Order.create([orderPayload], { session });
      orderDoc = created[0];

      // 4) Link FarmerOrders with estimated kg for this order
      for (const it of payload.items as PayloadItem[]) {
        const line = byFO.get(String((it as any).farmerOrderId));
        const n = normalizeItem(it, line);
        const estKg = computeEstimatedKgNormalized(n);
        await addOrderIdToFarmerOrder(
          orderDoc._id,
          toOID((it as any).farmerOrderId),
          estKg,
          { session }
        );
      }

      // 5) Audit trail
      orderDoc.addAudit(
        customerOID,
        "ORDER_CREATED",
        "Customer placed an order",
        { itemsCount: payload.items.length }
      );
      await orderDoc.save({ session });

      // 6) Mint (or reuse) an order token/QR inside the same txn
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

// ───────────────────────────────────────────────────────────────────────────────
// List latest 15 orders
// ───────────────────────────────────────────────────────────────────────────────
export async function listOrdersForCustomer(userId: IdLike, limit = 15) {
  const customerOID = toOID(userId);

  const docs = await Order.find({ customerId: customerOID })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 15)))
    .lean()
    .exec();

  return docs;
}

// ───────────────────────────────────────────────────────────────────────────────
// Orders summary (for admin dashboard) - latest orders for a given logistics center
// ───────────────────────────────────────────────────────────────────────────────
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

  // find timezone for LC (reuse your pattern from getNextAvailableShifts)
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
  if (currentShiftName === "none") {
    // no active shift now — still return next N shifts only
    const nextShifts = await getNextAvailableShifts({
      logisticCenterId,
      count,
    });
    const summaries = await Promise.all(
      nextShifts.map(async (s) => {
        const { startUTC, endUTC } = dayRangeUtc(tz, s.date);
        const docs = await Order.find(
          {
            LogisticsCenterId: new Types.ObjectId(logisticCenterId),
            shiftName: s.name,
            deliveryDate: { $gte: startUTC, $lt: endUTC },
          },
          { _id: 1, status: 1 }
        )
          .lean()
          .exec();

        const ids = docs.map((d) => String(d._id));
        const problemCount = docs.filter((d) => d.status === "problem").length;

        return {
          date: s.date,
          shiftName: s.name,
          count: ids.length,
          problemCount,
        } as SummaryEntry;
      })
    );

    return {
      current: null,
      next: summaries,
      tz,
      lc: logisticCenterId,
    };
  }

  // current date (today in tz)
  const todayYmd = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");

  // next N shifts after now
  const nextShifts = await getNextAvailableShifts({ logisticCenterId, count });

  // build the 1 (current) + N (next) targets
  const targets: Array<{ date: string; name: SummaryEntry["shiftName"] }> = [
    { date: todayYmd, name: currentShiftName as any },
    ...nextShifts.map((s) => ({ date: s.date, name: s.name })),
  ];

  // query each window in parallel
  const results = await Promise.all(
    targets.map(async (t) => {
      const { startUTC, endUTC } = dayRangeUtc(tz, t.date);
      const docs = await Order.find(
        {
          LogisticsCenterId: new Types.ObjectId(logisticCenterId),
          shiftName: t.name,
          deliveryDate: { $gte: startUTC, $lt: endUTC },
        },
        { _id: 1, status: 1 }
      )
        .lean()
        .exec();

      const ids = docs.map((d) => String(d._id));
      const problemCount = docs.filter((d) => d.status === "problem").length;

      return {
        date: t.date,
        shiftName: t.name,
        count: ids.length,
        problemCount,
      } as SummaryEntry;
    })
  );

  const [current, ...next] = results;
  return {
    current,
    next,
    tz,
    lc: logisticCenterId,
  };
}

export async function listOrdersForShift(params: {
  logisticCenterId: string;
  date: string; // yyyy-LL-dd in LC timezone
  shiftName: ShiftName;
  status?: string; // optional filter by status
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
    limit = 50, //change that later
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
  if (status) q.status = status;

  const projection =
    Array.isArray(fields) && fields.length
      ? fields.reduce((acc, f) => ((acc[f] = 1), acc), {} as Record<string, 1>)
      : undefined;

  const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

  const [items, total] = await Promise.all([
    Order.find(q, projection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Order.countDocuments(q),
  ]);

  const problemCount = await Order.countDocuments({ ...q, status: "problem" });

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
    items, // array of orders (projected if fields provided)
  };
}
