// src/services/availableMarketStock.service.ts
import { FilterQuery, ClientSession, Types } from "mongoose";
import {
  AvailableMarketStockModel,
  AvailableMarketStock,
  AmsItem,
  SHIFT_NAMES,
} from "../models/availableMarketStock.model";
import ItemModel from "../models/Item.model";
// import { getItemByItemId } from "./items.service";
import { getNextAvailableShifts, getShiftConfigByKey } from "./shiftConfig.service";
import { normalizeWindow } from "../utils/time";

export type ShiftName = (typeof SHIFT_NAMES)[number];
type ItemsOnly = { _id: Types.ObjectId; items: AmsItem[] };

/* ------------------------------ DEBUG helper ------------------------------ */
const DEBUG_AMS = !!(process.env.DEBUG_AMS && String(process.env.DEBUG_AMS) !== "0");
function dbg(...args: any[]) {
  if (DEBUG_AMS) console.log("AMS:", ...args);
}
function warn(...args: any[]) {
  console.warn("AMS[WARN]:", ...args);
}

/* ------------------------------ time helpers ------------------------------ */

function normalizeDateUTC(d: Date | string): Date {
  const dd = typeof d === "string" ? new Date(d) : new Date(d);
  dd.setUTCHours(0, 0, 0, 0);
  return dd;
}

const fmtHHMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

async function getDeliverySlotLabel(params: { LCid: string; shift: ShiftName }): Promise<string> {
  const cfg = await getShiftConfigByKey({ logisticCenterId: params.LCid, name: params.shift });
  const slot = normalizeWindow(cfg.deliveryTimeSlotStartMin, cfg.deliveryTimeSlotEndMin);
  return `${fmtHHMM(slot.startMin)}–${fmtHHMM(slot.endMin)}`;
}

/* ------------------------------ stock find/create ------------------------------ */

export async function findOrCreateAvailableMarketStock(params: {
  LCid: string;
  date: string | Date;
  shift: ShiftName;
  createdById?: string | Types.ObjectId | null;
}) {
  const { LCid, date, shift, createdById = null } = params;
  const availableDate = normalizeDateUTC(date);

  const existing = await AvailableMarketStockModel.findOne({
    LCid,
    availableDate,
    availableShift: shift,
  });
  if (existing) return existing;

  return AvailableMarketStockModel.create({
    LCid,
    availableDate,
    availableShift: shift,
    createdById: createdById ? new Types.ObjectId(createdById) : null,
    items: [],
  });
}

export async function getAvailableMarketStockByKey(params: {
  LCid: string;
  date: string | Date;
  shift: ShiftName;
}) {
  const { LCid, date, shift } = params;
  const availableDate = normalizeDateUTC(date);
  return AvailableMarketStockModel.findOne({
    LCid,
    availableDate,
    availableShift: shift,
  });
}

/** Get an AvailableMarketStock document by its _id (stock id). */
export async function getAvailableMarketStockById(docId: string) {
  const _docId = new Types.ObjectId(docId);
  const doc = await AvailableMarketStockModel.findById(_docId).lean<AvailableMarketStock | null>();
  if (!doc) throw new Error("AvailableMarketStock not found");
  return doc;
}

/* ---------------------------- list upcoming stocks ---------------------------- */

export async function listUpcomingAvailableMarketStock(params: {
  LCid: string;
  count?: number;
  fromDate?: string | Date;
}) {
  const { LCid, count = 6, fromDate } = params;
  const start = normalizeDateUTC(fromDate ?? new Date());
  const q: FilterQuery<any> = { LCid, availableDate: { $gte: start } };
  return AvailableMarketStockModel.find(q)
    .sort({ availableDate: 1, availableShift: 1 })
    .limit(count)
    .lean();
}

export async function nextFiveShiftsWithStock(params: {
  LCid: string;
  fromTs?: number;
}): Promise<Array<{ date: string; shift: ShiftName; docId: string; deliverySlotLabel: string }>> {
  const { LCid, fromTs } = params;
  const upcoming = await getNextAvailableShifts({ logisticCenterId: LCid, count: 5, fromTs });

  const orPairs = upcoming.map((s) => ({
    LCid,
    availableDate: normalizeDateUTC(s.date),
    availableShift: s.name as ShiftName,
  }));
  if (orPairs.length === 0) return [];

  const docs = await AvailableMarketStockModel.find(
    { $or: orPairs },
    { _id: 1, availableDate: 1, availableShift: 1, items: 1 }
  ).lean();

  const key = (d: Date, s: string) => `${d.toISOString()}|${s}`;
  const byKey = new Map<string, { _id: Types.ObjectId; items: any[] }>();
  for (const d of docs)
    byKey.set(key(d.availableDate, d.availableShift), {
      _id: d._id as Types.ObjectId,
      items: (d as any).items ?? [],
    });

  const out: Array<{ date: string; shift: ShiftName; docId: string; deliverySlotLabel: string }> = [];
  for (const s of upcoming) {
    const hit = byKey.get(`${normalizeDateUTC(s.date).toISOString()}|${s.name}`);
    if (hit && hit.items.length > 0) {
      const deliverySlotLabel = await getDeliverySlotLabel({ LCid, shift: s.name as ShiftName });
      out.push({ date: s.date, shift: s.name as ShiftName, docId: String(hit._id), deliverySlotLabel });
    }
  }
  return out;
}

/* -------------------------- conversion helpers -------------------------- */

function conservativeUnitsFromKg(
  availableKg: number,
  avgKg: number,
  sdKg = 0,
  zScore = 1.28,
  shrinkagePct = 0.02,
  bundle = 1
) {
  if (!availableKg || !avgKg) return 0;
  const effKgPerUnit = avgKg + zScore * sdKg;
  const raw = Math.floor(availableKg / (effKgPerUnit * (1 + shrinkagePct)));
  return Math.max(0, Math.floor(raw / Math.max(1, bundle)) * Math.max(1, bundle));
}

function unitsToKgDelta({
  unitsDelta, // negative => reserve, positive => release
  avgKg,
  sdKg = 0,
  zScore = 1.28,
  shrinkagePct = 0.02,
  bundle = 1,
}: {
  unitsDelta: number;
  avgKg: number;
  sdKg?: number;
  zScore?: number;
  shrinkagePct?: number;
  bundle?: number;
}) {
  if (!Number.isFinite(unitsDelta) || unitsDelta === 0) return 0;
  const sign = unitsDelta < 0 ? -1 : 1;
  let u = Math.abs(Math.trunc(unitsDelta)); // natural
  u = Math.max(0, Math.floor(u / Math.max(1, bundle)) * Math.max(1, bundle));
  if (u === 0) return 0;

  const effKgPerUnit = avgKg + zScore * sdKg;
  const kg = u * effKgPerUnit * (1 + shrinkagePct);
  const rounded = sign < 0 ? -Math.ceil(kg * 1000) / 1000 : Math.floor(kg * 1000) / 1000;

  dbg("unitsToKgDelta", { unitsDelta, avgKg, sdKg, zScore, shrinkagePct, bundle, effKgPerUnit, kg, rounded });
  return rounded;
}

/* ----------------------------- FO-centric atomic qty adjustment ----------------------------- */
/**
 * All operations below target an AMS line by `farmerOrderId` ONLY.
 * This matches your schema where subdocs use `{ _id: false }`.
 * We guard oversell and clamp `currentAvailableQuantityKg` to [0 .. originalCommittedQuantityKg].
 * After updates, we recompute `estimates.availableUnitsEstimate` for unit/mixed lines.
 */

/** Reserve/release KG by FarmerOrderId (negative = reserve, positive = release) */
export async function adjustAvailableKgByFOAtomic(args: {
  docId: string;
  farmerOrderId: string;
  deltaKg: number;
  enforceEnoughForReserve?: boolean;
  session?: ClientSession | null;
}) {
  const { docId, farmerOrderId, deltaKg, enforceEnoughForReserve = true, session } = args;

  if (!Number.isFinite(deltaKg) || deltaKg === 0) {
    throw Object.assign(new Error("BadRequest"), { name: "BadRequest", details: ["deltaKg must be non-zero finite"] });
  }

  const elemFilter: any = { farmerOrderId: new Types.ObjectId(farmerOrderId) };
  if (enforceEnoughForReserve && deltaKg < 0) {
    elemFilter["currentAvailableQuantityKg"] = { $gte: Math.abs(deltaKg) };
  }

  // $inc then clamp to [0..originalCommittedQuantityKg]
  const res = await AvailableMarketStockModel.updateOne(
    { _id: new Types.ObjectId(docId) },
    {
      $inc: { "items.$[elem].currentAvailableQuantityKg": deltaKg },
      $set: {
        "items.$[elem].currentAvailableQuantityKg": {
          $cond: [
            { $gt: ["$items.$[elem].currentAvailableQuantityKg", "$items.$[elem].originalCommittedQuantityKg"] },
            "$items.$[elem].originalCommittedQuantityKg",
            {
              $cond: [
                { $lt: ["$items.$[elem].currentAvailableQuantityKg", 0] },
                0,
                "$items.$[elem].currentAvailableQuantityKg",
              ],
            },
          ],
        },
      },
    } as any,
    {
      arrayFilters: [{ elem: elemFilter }],
      session: session ?? undefined,
    }
  );

  if (res.matchedCount === 0 || res.modifiedCount === 0) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = [
      `Failed to update AMS.kg for farmerOrderId=${farmerOrderId} (delta=${deltaKg}).`,
    ];
    throw e;
  }

  // Recompute availableUnitsEstimate if unit/mixed
  try {
    const doc = await AvailableMarketStockModel.findOne(
      { _id: new Types.ObjectId(docId), "items.farmerOrderId": new Types.ObjectId(farmerOrderId) },
      { "items.$": 1 }
    ).lean();

    const line = (doc as any)?.items?.[0];
    if (!line) return { ok: true };

    const unity = line.unitMode === "unit" || line.unitMode === "mixed";
    const avg = line.estimates?.avgWeightPerUnitKg ?? null;
    if (unity && avg) {
      const est = conservativeUnitsFromKg(
        line.currentAvailableQuantityKg,
        avg,
        line.estimates?.sdKg ?? 0,
        line.estimates?.zScore ?? 1.28,
        line.estimates?.shrinkagePct ?? 0.02,
        Math.max(1, line.estimates?.unitBundleSize ?? 1)
      );

      await AvailableMarketStockModel.updateOne(
        { _id: new Types.ObjectId(docId) },
        { $set: { "items.$[elem].estimates.availableUnitsEstimate": est } },
        { arrayFilters: [{ elem: { farmerOrderId: new Types.ObjectId(farmerOrderId) } }] }
      ).exec();
    }
  } catch (e) {
    warn("adjustAvailableKgByFOAtomic.reestimate.error", e);
  }

  return { ok: true };
}

/** Reserve/release UNITS by FarmerOrderId (negative = reserve, positive = release) */
export async function adjustAvailableUnitsByFOAtomic(args: {
  docId: string;
  farmerOrderId: string;
  unitsDelta: number; // negative => reserve
  enforceEnoughForReserve?: boolean;
  session?: ClientSession | null;
}) {
  const { docId, farmerOrderId, unitsDelta, enforceEnoughForReserve = true, session } = args;

  if (!Number.isFinite(unitsDelta) || unitsDelta === 0) return { ok: true };

  // We need avg/sd/bundle to convert units → kg
  const doc = await AvailableMarketStockModel.findOne(
    { _id: new Types.ObjectId(docId), "items.farmerOrderId": new Types.ObjectId(farmerOrderId) },
    { "items.$": 1 }
  ).lean();

  const line = (doc as any)?.items?.[0];
  if (!line) throw new Error("AMS line not found for farmerOrderId");

  const unity = line.unitMode === "unit" || line.unitMode === "mixed";
  const avg = line.estimates?.avgWeightPerUnitKg ?? null;
  if (!unity || !avg) {
    throw Object.assign(new Error("BadRequest"), {
      name: "BadRequest",
      details: ["This item is not sold by unit or missing avgWeightPerUnitKg"],
    });
  }

  const kgDelta = unitsToKgDelta({
    unitsDelta,
    avgKg: avg,
    sdKg: line.estimates?.sdKg ?? 0,
    zScore: line.estimates?.zScore ?? 1.28,
    shrinkagePct: line.estimates?.shrinkagePct ?? 0.02,
    bundle: Math.max(1, line.estimates?.unitBundleSize ?? 1),
  });

  if (kgDelta === 0) return { ok: true };

  return adjustAvailableKgByFOAtomic({
    docId,
    farmerOrderId,
    deltaKg: kgDelta,
    enforceEnoughForReserve,
    session,
  });
}

/* ------------------------------ add/update/remove ------------------------------ */

export async function addItemToAvailableMarketStock(params: {
  docId: string;
  item: {
    itemId: string;
    displayName: string;
    imageUrl?: string | null;
    category: string;

    // Caller-sent pricePerUnit is ignored (see below)
    pricePerUnit?: number | null;

    originalCommittedQuantityKg: number;
    currentAvailableQuantityKg: number;

    farmerOrderId?: string | null;
    farmerID: string;
    farmerName: string;
    farmName: string;
    farmLogo?: string | null;

    status?: "active" | "soldout" | "removed";
  };
}) {
  const { docId } = params;
  const { unitMode: _ignoreUM, estimates: _ignoreEst, ...item } = params.item as any;

  // 0) Ensure AMS exists
  const amsDoc = await AvailableMarketStockModel.findById(docId, { _id: 1 }).lean();
  if (!amsDoc) {
    throw new Error(`AvailableMarketStock not found for docId=${docId}`);
  }

  // 1) Fetch authoritative Item fields
  const it = await ItemModel.findById(item.itemId, {
    price: 1,
    pricePerUnitOverride: 1,
    sellModes: 1,
    unitMode: 1, // legacy
    mode: 1,     // legacy
    avgWeightPerUnitGr: 1,
    sdWeightPerUnitGr: 1,
    imageUrl: 1,
    category: 1,
    type: 1,
    variety: 1,
  }).lean();

  if (!it || !it.price || typeof (it as any).price.a !== "number") {
    throw new Error("Item price.a not found");
  }

  const pricePerKg: number = (it as any).price.a;

  // 2) Determine selling mode (new + legacy fallback)
  let byUnit: boolean = !!(it as any).sellModes?.byUnit;
  let byKg: boolean = (it as any).sellModes?.byKg !== false; // default true
  let unitBundleSize: number = Math.max(1, (it as any).sellModes?.unitBundleSize ?? 1);

  if (!(it as any).sellModes) {
    const legacy = String((it as any).unitMode ?? (it as any).mode ?? "").toLowerCase();
    if (legacy === "mixed") { byKg = true; byUnit = true; }
    else if (legacy === "unit") { byKg = false; byUnit = true; }
    else if (legacy === "kg") { byKg = true; byUnit = false; }
  }

  let unitMode: "kg" | "unit" | "mixed" = "kg";
  if (byUnit && byKg) unitMode = "mixed";
  else if (byUnit) unitMode = "unit";

  // 3) Compute pricePerUnit ONLY from Item (ignore caller)
  const avgGr: number | null = (it as any).avgWeightPerUnitGr ?? null; // grams
  const sdGr: number = (it as any).sdWeightPerUnitGr ?? 0;             // grams
  const hasAvg = typeof avgGr === "number" && avgGr > 0;

  let pricePerUnit: number | null = null;
  if (unitMode === "unit" || unitMode === "mixed") {
    const override = (it as any).pricePerUnitOverride;
    if (typeof override === "number" && override >= 0) {
      pricePerUnit = override;
    } else if (hasAvg) {
      pricePerUnit = pricePerKg * (avgGr! / 1000);
    } // else null
  }

  // 4) Estimates (grams → kg)
  const avgWeightPerUnitKg = hasAvg ? avgGr! / 1000 : null;
  const sdKg = sdGr > 0 ? sdGr / 1000 : 0;
  const zScore = 1.28;
  const shrinkagePct = 0.02;

  let availableUnitsEstimate: number | null = null;
  if ((unitMode === "unit" || unitMode === "mixed") && avgWeightPerUnitKg) {
    availableUnitsEstimate = conservativeUnitsFromKg(
      item.currentAvailableQuantityKg,
      avgWeightPerUnitKg,
      sdKg,
      zScore,
      shrinkagePct,
      unitBundleSize
    );
  }

  // 5) Payload — prefer authoritative category/image from Item
  const payload: any = {
    itemId: new Types.ObjectId(item.itemId),
    displayName: item.displayName,
    imageUrl: it?.imageUrl ?? item.imageUrl ?? null,
    category: it?.category ?? item.category,

    pricePerKg,
    pricePerUnit,

    originalCommittedQuantityKg: item.originalCommittedQuantityKg,
    currentAvailableQuantityKg: item.currentAvailableQuantityKg,

    farmerOrderId: item.farmerOrderId ? new Types.ObjectId(item.farmerOrderId) : null,

    farmerID: new Types.ObjectId(item.farmerID),
    farmerName: item.farmerName,
    farmName: item.farmName,
    farmLogo: item.farmLogo ?? null,

    unitMode, // "kg" | "unit" | "mixed"

    estimates: {
      avgWeightPerUnitKg,
      sdKg,
      availableUnitsEstimate,
      unitBundleSize,
      zScore,
      shrinkagePct,
    },

    status: item.status ?? "active",
  };

  // 6) Persist
  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    docId,
    { $push: { items: payload } },
    { new: true }
  );

  if (!updated) throw new Error(`Failed to update AvailableMarketStock ${docId}`);

  // (no subdoc _id here by design)
  dbg("AMS addItem> saved", {
    farmerOrderId: payload.farmerOrderId?.toString() ?? null,
    unitMode,
    pricePerKg,
    pricePerUnit,
    avgWeightPerUnitKg,
    availableUnitsEstimate,
  });

  return updated;
}

/** Update item quantity and/or status by FarmerOrderId */
export async function updateItemQtyStatusAtomic(params: {
  docId: string;
  farmerOrderId: string;
  currentAvailableQuantityKg?: number;
  status?: "active" | "soldout" | "removed";
}) {
  const { docId, farmerOrderId, currentAvailableQuantityKg, status } = params;

  // Validate and compute set object
  const updates: any = {};
  const filters: any[] = [{ elem: { farmerOrderId: new Types.ObjectId(farmerOrderId) } }];

  if (typeof currentAvailableQuantityKg === "number") {
    if (currentAvailableQuantityKg < 0) throw new Error("Quantity cannot be negative");

    // clamp in-place with $set + $cond, but also guard against exceeding original
    updates["items.$[elem].currentAvailableQuantityKg"] = {
      $cond: [
        { $gt: [currentAvailableQuantityKg, "$items.$[elem].originalCommittedQuantityKg"] },
        "$items.$[elem].originalCommittedQuantityKg",
        currentAvailableQuantityKg,
      ],
    };
  }

  if (status) {
    updates["items.$[elem].status"] = status;
  }

  if (Object.keys(updates).length === 0) {
    return await AvailableMarketStockModel.findById(docId); // nothing to do
  }

  const res = await AvailableMarketStockModel.updateOne(
    { _id: new Types.ObjectId(docId) },
    { $set: updates } as any,
    { arrayFilters: filters}
  );

  if (res.matchedCount === 0) throw new Error("AvailableMarketStock not found or FO not matched");

  // Recompute estimate if we changed quantity
  if (typeof currentAvailableQuantityKg === "number") {
    try {
      const doc = await AvailableMarketStockModel.findOne(
        { _id: new Types.ObjectId(docId), "items.farmerOrderId": new Types.ObjectId(farmerOrderId) },
        { "items.$": 1 }
      ).lean();

      const line = (doc as any)?.items?.[0];
      if (line) {
        const unity = line.unitMode === "unit" || line.unitMode === "mixed";
        const avg = line.estimates?.avgWeightPerUnitKg ?? null;
        if (unity && avg) {
          const est = conservativeUnitsFromKg(
            line.currentAvailableQuantityKg,
            avg,
            line.estimates?.sdKg ?? 0,
            line.estimates?.zScore ?? 1.28,
            line.estimates?.shrinkagePct ?? 0.02,
            Math.max(1, line.estimates?.unitBundleSize ?? 1)
          );

          await AvailableMarketStockModel.updateOne(
            { _id: new Types.ObjectId(docId) },
            { $set: { "items.$[elem].estimates.availableUnitsEstimate": est } },
            { arrayFilters: [{ elem: { farmerOrderId: new Types.ObjectId(farmerOrderId) } }] }
          ).exec();

          dbg("updateItemQtyStatusAtomic.reestimate", {
            farmerOrderId,
            newKg: line.currentAvailableQuantityKg,
            estUnits: est,
          });
        } else if (line.estimates) {
          await AvailableMarketStockModel.updateOne(
            { _id: new Types.ObjectId(docId) },
            { $set: { "items.$[elem].estimates.availableUnitsEstimate": null } },
            { arrayFilters: [{ elem: { farmerOrderId: new Types.ObjectId(farmerOrderId) } }] }
          ).exec();
        }
      }
    } catch (e) {
      warn("updateItemQtyStatusAtomic.reestimate.error", e);
    }
  }

  return await AvailableMarketStockModel.findById(docId);
}

/** Remove an item from AMS by FarmerOrderId */
export async function removeItemFromAvailableMarketStock(params: {
  docId: string;
  farmerOrderId: string;
}) {
  const { docId, farmerOrderId } = params;

  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    docId,
    { $pull: { items: { farmerOrderId: new Types.ObjectId(farmerOrderId) } } },
    { new: true }
  );
  dbg("removeItem", { docId, farmerOrderId, ok: !!updated });
  return updated;
}
