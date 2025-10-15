// src/services/order.service.ts
import mongoose, { Types } from "mongoose";
import Order from "../models/order.model";
import { AvailableMarketStockModel } from "../models/availableMarketStock.model";
import { CreateOrderInput } from "../validations/orders.validation";
import { adjustAvailableQtyAtomic, adjustAvailableQtyByUnitsAtomic } from "./availableMarketStock.service";
import ShiftConfig from "../models/shiftConfig.model";
import { DateTime } from "luxon";
import { getCurrentShift, getNextAvailableShifts } from "./shiftConfig.service";

import { addOrderIdToFarmerOrder } from "./farmerOrder.service";

type ShiftName = "morning" | "afternoon" | "evening" | "night";

type IdLike = string | Types.ObjectId;
const toOID = (v: IdLike) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v)));

type AmsLine = {
  _id: Types.ObjectId;
  farmerOrderId?: Types.ObjectId;
  pricePerUnit?: number; // per KG in AMS
  unitMode?: "kg" | "unit" | "mixed";
  estimates?: {
    avgWeightPerUnitKg?: number | null;
    sdKg?: number | null;
  };
};

// ───────────────────────────────────────────────────────────────────────────────
// Backwards-compat helpers (support legacy {quantity} and new unitMode/units/quantityKg)
// ───────────────────────────────────────────────────────────────────────────────
type PayloadItem = CreateOrderInput["items"][number];

// legacy = has 'quantity' and no 'quantityKg'/'units'
const isLegacyItem = (it: any): boolean =>
  it && typeof it === "object" && "quantity" in it && !("quantityKg" in it) && !("units" in it);

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

    if ((unitMode === "unit" || unitMode === "mixed") && units > 0 && !(avg > 0)) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = [
        `Missing avgWeightPerUnitKg for item ${String((it as any).itemId)} while units > 0.`,
      ];
      throw e;
    }

    return { unitMode, quantityKg, units, avg };
  }
}

function computeEstimatedKgNormalized(n: { quantityKg: number; units: number; avg: number }): number {
  const eff = n.quantityKg + n.units * n.avg;
  return Math.max(0, Math.round(eff * 1000) / 1000);
}

// helper to compute a UI-only per-unit price snapshot
function deriveUnitPrice(pricePerKg: number | undefined, avgKg: number | undefined | null) {
  if (!Number.isFinite(pricePerKg) || !(pricePerKg! > 0)) return null;
  if (!Number.isFinite(avgKg) || !(avgKg! > 0)) return null;
  // round to cents for display; you can keep more precision if you prefer
  return Math.round(pricePerKg! * avgKg! * 100) / 100;
}

// ───────────────────────────────────────────────────────────────────────────────
// Create order
// ───────────────────────────────────────────────────────────────────────────────
export async function createOrderForCustomer(userId: IdLike, payload: CreateOrderInput) {
  const session = await mongoose.startSession();

  const customerOID = toOID(userId);
  const amsOID = toOID(payload.amsId);
  const lcOID = toOID(payload.logisticsCenterId);

  let orderDoc: any;

  try {
    await session.withTransaction(async () => {
      // 1) Load AMS for line lookups
      const ams = await AvailableMarketStockModel.findById(amsOID, { items: 1, availableShift: 1 })
        .lean(false)
        .session(session);
      if (!ams) {
        const err: any = new Error("AvailableMarketStock not found");
        err.name = "NotFound";
        throw err;
      }

      const itemsArr: AmsLine[] = Array.isArray((ams as any).items) ? ((ams as any).items as any) : [];
      const byFO = new Map<string, AmsLine>();
      for (const line of itemsArr) {
        const fo = (line as any).farmerOrderId ? String((line as any).farmerOrderId) : "";
        if (fo) byFO.set(fo, line);
      }

      // 2) Reserve AMS using AMS' own conservative logic for units
      for (const it of payload.items as PayloadItem[]) {
        const foId = String((it as any).farmerOrderId);
        const line = byFO.get(foId);
        if (!line || !line._id) {
          const err: any = new Error(`AMS line not found for farmerOrderId ${(it as any).farmerOrderId}`);
          err.name = "BadRequest";
          err.details = ["Ensure AMS has a line whose farmerOrderId matches the requested item."]; // helpful to caller
          throw err;
        }

        // Normalize once to know what we’re reserving
        const n = normalizeItem(it, line);

        // 2a) Reserve any KG directly (exact kg requested)
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

        // 2b) Reserve any UNITS using AMS' conservative conversion (bundle/z/shrink)
        if (n.units > 0) {
          await adjustAvailableQtyByUnitsAtomic({
            docId: amsOID.toString(),
            lineId: String(line._id),
            unitsDelta: -n.units, // negative => reserve
            enforceEnoughForReserve: true,
            session,
          });
        }

        // Guard: at least one of kg/units must be positive
        if (!(n.quantityKg > 0 || n.units > 0)) {
          const err: any = new Error(`Invalid item quantities for item ${(it as any).itemId}`);
          err.name = "BadRequest";
          throw err;
        }
      }

      // 3) Create Order (new shape) — legacy items are auto-normalized
      const orderPayload = {
        customerId: customerOID,
        deliveryAddress: payload.deliveryAddress,
        deliveryDate: payload.deliveryDate,
        LogisticsCenterId: lcOID,
        shiftName: (ams as any).availableShift,
        amsId: amsOID,
        items: (payload.items as PayloadItem[]).map((it) => {
          const line = byFO.get(String((it as any).farmerOrderId));
          const n = normalizeItem(it, line);

          // Take per-KG price from payload if provided, else snapshot from AMS line
          const pricePerKg = Number.isFinite((it as any).pricePerUnit)
            ? Number((it as any).pricePerUnit)
            : Number((line as any)?.pricePerUnit ?? 0);

          // Keep legacy name for billing math (per KG)
          const pricePerUnit = pricePerKg;

          // Optional UI helper for unit/mixed
          const derivedUnitPrice =
            (n.unitMode === "unit" || n.unitMode === "mixed")
              ? deriveUnitPrice(pricePerKg, n.avg || line?.estimates?.avgWeightPerUnitKg || null)
              : null;

          const snapshot: any = {};
          const snapAvg = n.avg || line?.estimates?.avgWeightPerUnitKg;
          if (Number.isFinite(snapAvg) && (snapAvg as number) > 0) {
            snapshot.avgWeightPerUnitKg = snapAvg;
          }
          const snapSd = line?.estimates?.sdKg;
          if (Number.isFinite(snapSd) && (snapSd as number) > 0) {
            snapshot.stdDevKg = snapSd;
          }

          return {
            itemId: toOID((it as any).itemId),
            name: (it as any).name,
            imageUrl: (it as any).imageUrl ?? "",
            pricePerUnit,                 // per KG (legacy field used by totals)
            pricePerKg,                   // explicit duplicate for clarity/analytics
            derivedUnitPrice,             // optional UI helper

            unitMode: n.unitMode,
            quantityKg: n.quantityKg,
            units: n.units,

            estimatesSnapshot: Object.keys(snapshot).length ? snapshot : undefined,

            category: (it as any).category ?? "",
            sourceFarmerName: (it as any).sourceFarmerName,
            sourceFarmName: (it as any).sourceFarmName,

            farmerOrderId: toOID((it as any).farmerOrderId),
          };
        }),
      };

      [orderDoc] = await Order.create([orderPayload], { session });

      // 4) Link each FarmerOrder using **estimated kg** (avg-based; fine for expectations/tolerance)
      for (const it of payload.items as PayloadItem[]) {
        const line = byFO.get(String((it as any).farmerOrderId));
        const n = normalizeItem(it, line);
        const estKg = computeEstimatedKgNormalized(n);
        await addOrderIdToFarmerOrder(orderDoc._id, toOID((it as any).farmerOrderId), estKg, { session });
      }

      // 5) Audit & save
      orderDoc.addAudit(customerOID, "ORDER_CREATED", "Customer placed an order", {
        itemsCount: payload.items.length,
      });
      await orderDoc.save({ session });
    });

    return orderDoc.toJSON();
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
  date: string;              // yyyy-LL-dd in LC tz
  shiftName: "morning" | "afternoon" | "evening" | "night";
  orderIds: string[];
  count: number;
  problemCount: number;
};

const dayRangeUtc = (tz: string, ymd: string) => {
  const start = DateTime.fromFormat(ymd, "yyyy-LL-dd", { zone: tz }).startOf("day");
  const end = start.plus({ days: 1 });
  return { startUTC: start.toUTC().toJSDate(), endUTC: end.toUTC().toJSDate() };
};

export async function ordersSummarry(params: OrdersSummaryParams) {
  const { logisticCenterId, count = 5 } = params;

  // find timezone for LC (reuse your pattern from getNextAvailableShifts)
  const anyCfg = await ShiftConfig
    .findOne({ logisticCenterId }, { timezone: 1 })
    .lean<{ timezone?: string }>()
    .exec();

  if (!anyCfg) throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = anyCfg.timezone || "Asia/Jerusalem";

  // current shift (name) in tz
  const currentShiftName = await getCurrentShift();
  if (currentShiftName === "none") {
    // no active shift now — still return next N shifts only
    const nextShifts = await getNextAvailableShifts({ logisticCenterId, count });
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
        ).lean().exec();

        const ids = docs.map(d => String(d._id));
        const problemCount = docs.filter(d => d.status === "problem").length;

        return {
          date: s.date,
          shiftName: s.name,
          orderIds: ids,
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
    ...nextShifts.map(s => ({ date: s.date, name: s.name })),
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
      ).lean().exec();

      const ids = docs.map(d => String(d._id));
      const problemCount = docs.filter(d => d.status === "problem").length;

      return {
        date: t.date,
        shiftName: t.name,
        orderIds: ids,
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
  date: string;                // yyyy-LL-dd in LC timezone
  shiftName: ShiftName;
  status?: string;             // optional filter by status
  page?: number;               // default 1
  limit?: number;              // default 50
  fields?: string[];           // optional projection
}) {
  const {
    logisticCenterId,
    date,
    shiftName,
    status,
    page = 1,
    limit = 50,//change that later 
    fields,
  } = params;

  // Resolve timezone for this LC (same approach as summary)
  const cfg = await ShiftConfig.findOne({ logisticCenterId }, { timezone: 1 }).lean().exec();
  if (!cfg) throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = cfg.timezone || "Asia/Jerusalem";

  // Convert date (in LC tz) to UTC day window
  const start = DateTime.fromFormat(date, "yyyy-LL-dd", { zone: tz }).startOf("day");
  if (!start.isValid) throw new Error(`Invalid date '${date}', expected yyyy-LL-dd`);
  const end = start.plus({ days: 1 });

  const q: any = {
    LogisticsCenterId: new Types.ObjectId(logisticCenterId),
    shiftName,
    deliveryDate: { $gte: start.toUTC().toJSDate(), $lt: end.toUTC().toJSDate() },
  };
  if (status) q.status = status;

  const projection =
    Array.isArray(fields) && fields.length
      ? fields.reduce((acc, f) => ((acc[f] = 1), acc), {} as Record<string, 1>)
      : undefined;

  const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

  const [items, total] = await Promise.all([
    Order.find(q, projection).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
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