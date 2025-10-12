// src/services/availableMarketStock.service.ts
import { FilterQuery, ClientSession, Types } from "mongoose";
import {
  AvailableMarketStockModel,
  AvailableMarketStock,
  AmsItem,
  SHIFT_NAMES,
} from "../models/availableMarketStock.model";
import ItemModel from "../models/Item.model";
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

  if (!doc) {
    throw new Error("AvailableMarketStock not found");
  }

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
  for (const d of docs) byKey.set(key(d.availableDate, d.availableShift), {
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

/* ----------------------------- atomic qty adjustment ----------------------------- */

async function reserveOrReleaseByKgAtomic({
  docId,
  lineId,
  deltaKg,
  enforceEnoughForReserve = true,
  session,
}: {
  docId: string;
  lineId: string;
  deltaKg: number;
  enforceEnoughForReserve?: boolean;
  session?: ClientSession | null;
}) {
  if (!deltaKg || !Number.isFinite(deltaKg)) throw new Error("deltaKg must be a non-zero finite number");

  dbg("reserveOrReleaseByKgAtomic.start", { docId, lineId, deltaKg, enforceEnoughForReserve });

  const _docId = new Types.ObjectId(docId);
  const _lineId = new Types.ObjectId(lineId);
  const filter: any = { _id: _docId };

  if (deltaKg < 0 && enforceEnoughForReserve) {
    const need = Math.abs(deltaKg);
    filter.items = { $elemMatch: { _id: _lineId, currentAvailableQuantityKg: { $gte: need } } };
  }

  const q = AvailableMarketStockModel.updateOne(filter, [
    {
      $set: {
        items: {
          $map: {
            input: "$items",
            as: "it",
            in: {
              $cond: [
                { $eq: ["$$it._id", _lineId] },
                {
                  $mergeObjects: [
                    "$$it",
                    {
                      currentAvailableQuantityKg: {
                        $max: [
                          0,
                          { $min: ["$$it.originalCommittedQuantityKg", { $add: ["$$it.currentAvailableQuantityKg", deltaKg] }] },
                        ],
                      },
                    },
                  ],
                },
                "$$it",
              ],
            },
          },
        },
      },
    },
  ]);
  if (session) q.session(session);
  const result = await q.exec();

  dbg("reserveOrReleaseByKgAtomic.result", { matched: result.matchedCount, modified: (result as any).modifiedCount });

  if (result.matchedCount === 0) {
    if (deltaKg < 0 && enforceEnoughForReserve) throw new Error("Not enough available quantity to reserve");
    throw new Error("Document not found or lineId invalid");
  }

  // best-effort recompute units estimate
  try {
    const doc = await AvailableMarketStockModel.findOne(
      { _id: _docId, "items._id": _lineId },
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
        { _id: _docId, "items._id": _lineId },
        { $set: { "items.$.estimates.availableUnitsEstimate": est } }
      ).exec();

      dbg("reserveOrReleaseByKgAtomic.reestimate", {
        lineId,
        newKg: line.currentAvailableQuantityKg,
        estUnits: est,
      });
    }
  } catch (e) {
    warn("reserveOrReleaseByKgAtomic.reestimate.error", e);
  }

  return { ok: true };
}

export async function adjustAvailableQtyAtomic(params: {
  docId: string;
  lineId: string;
  deltaKg: number;
  enforceEnoughForReserve?: boolean;
  session?: ClientSession | null;
}) {
  return reserveOrReleaseByKgAtomic(params);
}

export async function adjustAvailableQtyByUnitsAtomic(params: {
  docId: string;
  lineId: string;
  unitsDelta: number;
  enforceEnoughForReserve?: boolean;
  session?: ClientSession | null;
}) {
  const { docId, lineId, unitsDelta, enforceEnoughForReserve = true, session } = params;
  dbg("adjustAvailableQtyByUnitsAtomic.start", { docId, lineId, unitsDelta });

  const doc = await AvailableMarketStockModel.findOne(
    { _id: new Types.ObjectId(docId), "items._id": new Types.ObjectId(lineId) },
    { "items.$": 1 }
  ).lean();

  const line = (doc as any)?.items?.[0];
  if (!line) throw new Error("Line item not found");

  const unity = line.unitMode === "unit" || line.unitMode === "mixed";
  const avg = line.estimates?.avgWeightPerUnitKg ?? null;
  if (!unity || !avg) {
    warn("adjustAvailableQtyByUnitsAtomic.rejected", { reason: "not unit/mixed or missing avg", unitMode: line.unitMode, avg });
    throw new Error("This item is not sold by unit");
  }

  const kgDelta = unitsToKgDelta({
    unitsDelta,
    avgKg: avg,
    sdKg: line.estimates?.sdKg ?? 0,
    zScore: line.estimates?.zScore ?? 1.28,
    shrinkagePct: line.estimates?.shrinkagePct ?? 0.02,
    bundle: Math.max(1, line.estimates?.unitBundleSize ?? 1),
  });
  if (kgDelta === 0) {
    dbg("adjustAvailableQtyByUnitsAtomic.noop", { reason: "bundle/natural alignment zeroed delta" });
    return { ok: true };
  }

  return reserveOrReleaseByKgAtomic({
    docId,
    lineId,
    deltaKg: kgDelta,
    enforceEnoughForReserve,
    session,
  });
}

/* ------------------------------ add/update/remove ------------------------------ */

// In: src/services/availableMarketStock.service.ts
// Requires: conservativeUnitsFromKg helper defined elsewhere in this file.

export async function addItemToAvailableMarketStock(params: {
  docId: string;
  item: {
    itemId: string;
    displayName: string;
    imageUrl?: string | null;
    category: string;

    // Optional: only used as a hard override, otherwise computed
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
  // Strip any accidental unitMode/estimates from callers
  const { unitMode: _ignoreUM, estimates: _ignoreEst, ...item } = params.item as any;

  // 1) Fetch authoritative data from Items
  const it = await ItemModel.findById(item.itemId, {
    price: 1,
    pricePerUnitOverride: 1,
    sellModes: 1,
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

  const byUnit: boolean = !!(it as any).sellModes?.byUnit;
  const byKg: boolean = (it as any).sellModes?.byKg !== false; // default true
  const unitBundleSize: number = Math.max(1, (it as any).sellModes?.unitBundleSize ?? 1);

  const avgGr: number | null = (it as any).avgWeightPerUnitGr ?? null; // grams
  const sdGr: number = (it as any).sdWeightPerUnitGr ?? 0;             // grams

  // 2) Determine unitMode from sellModes
  let unitMode: "kg" | "unit" | "mixed" = "kg";
  if (byUnit && byKg) unitMode = "mixed";
  else if (byUnit) unitMode = "unit";

  // 3) Compute pricePerUnit ONLY for unit/mixed
  const hasAvg = typeof avgGr === "number" && avgGr > 0;
  let pricePerUnit: number | null =
    unitMode === "unit" || unitMode === "mixed" ? null : null;

  if (unitMode === "unit" || unitMode === "mixed") {
    if (item.pricePerUnit != null && Number.isFinite(item.pricePerUnit)) {
      pricePerUnit = Number(item.pricePerUnit); // hard override from caller (if you want to allow)
    } else {
      const override = (it as any).pricePerUnitOverride;
      if (typeof override === "number" && override >= 0) {
        pricePerUnit = override;
      } else if (hasAvg) {
        pricePerUnit = pricePerKg * (avgGr! / 1000);
      } else {
        pricePerUnit = null; // no avg → can't compute meaningful unit price
      }
    }
  }

  // 4) Estimates (grams → kg once)
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

  // 5) Build payload aligned to AMS schema (now with pricePerKg always present)
  const payload: any = {
    itemId: new Types.ObjectId(item.itemId),
    displayName: item.displayName,
    imageUrl: item.imageUrl ?? null,
    category: item.category,

    pricePerKg,                 // <-- always
    pricePerUnit,               // <-- null unless unit/mixed (and computable/overridden)

    originalCommittedQuantityKg: item.originalCommittedQuantityKg,
    currentAvailableQuantityKg: item.currentAvailableQuantityKg,

    farmerOrderId: item.farmerOrderId ? new Types.ObjectId(item.farmerOrderId) : null,

    farmerID: new Types.ObjectId(item.farmerID),
    farmerName: item.farmerName,
    farmName: item.farmName,
    farmLogo: item.farmLogo ?? null,

    unitMode, // "kg" | "unit" | "mixed"

    estimates: {
      avgWeightPerUnitKg,       // e.g., 0.18 for 180g
      sdKg,                     // 0 if missing
      availableUnitsEstimate,   // conservative, bundle-aligned integer, or null
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

  const newLine = (updated as any)?.items?.at?.(-1);
  if (newLine?._id) {
    console.log("AMS addItem> saved", {
      lineId: newLine._id.toString(),
      unitMode,
      pricePerKg,
      pricePerUnit,
      avgWeightPerUnitKg,
      availableUnitsEstimate,
    });
  }

  return updated;
}


export async function updateItemQtyStatusAtomic(params: {
  docId: string;
  lineId: string;
  currentAvailableQuantityKg?: number;
  status?: "active" | "soldout" | "removed";
}) {
  const { docId, lineId, currentAvailableQuantityKg, status } = params;

  const doc = await AvailableMarketStockModel.findById(docId);
  if (!doc) throw new Error("AvailableMarketStock not found");

  const line = (doc as any).items.id(lineId);
  if (!line) throw new Error("Line item not found");

  if (typeof currentAvailableQuantityKg === "number") {
    if (currentAvailableQuantityKg < 0) throw new Error("Quantity cannot be negative");
    if (currentAvailableQuantityKg > line.originalCommittedQuantityKg) {
      throw new Error("Exceeds original committed quantity");
    }
    line.currentAvailableQuantityKg = currentAvailableQuantityKg;

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
      if (!line.estimates) line.estimates = {};
      line.estimates.availableUnitsEstimate = est;

      dbg("updateItemQtyStatusAtomic.reestimate", {
        lineId,
        newKg: line.currentAvailableQuantityKg,
        estUnits: est,
      });
    } else if (line.estimates) {
      line.estimates.availableUnitsEstimate = null;
    }
  }
  if (status) line.status = status;

  await doc.save();
  return doc;
}

export async function removeItemFromAvailableMarketStock(params: {
  docId: string;
  lineId: string;
}) {
  const { docId, lineId } = params;

  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    docId,
    { $pull: { items: { _id: new Types.ObjectId(lineId) } } },
    { new: true }
  );
  dbg("removeItem", { docId, lineId, ok: !!updated });
  return updated;
}
