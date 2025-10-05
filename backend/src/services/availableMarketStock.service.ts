import { FilterQuery, ClientSession, Types } from "mongoose";
import {
  AvailableMarketStockModel,
  AvailableStockItem,
  AvailableMarketStock,
} from "../models/availableMarketStock.model";
import { SHIFT_NAMES } from "../models/availableMarketStock.model";
import ItemModel from "../models/Item.model";
import { getNextAvailableShifts, getShiftConfigByKey } from "./shiftConfig.service";
import { DateTime } from "luxon";
import { normalizeWindow } from "../utils/time";

type ShiftName = (typeof SHIFT_NAMES)[number];
type ItemsOnly = { _id: Types.ObjectId; items: AvailableStockItem[] };

/* ------------------------------ time helpers ------------------------------ */

function normalizeDateUTC(d: Date | string): Date {
  const dd = typeof d === "string" ? new Date(d) : new Date(d);
  dd.setUTCHours(0, 0, 0, 0);
  return dd;
}

function toDateTime(tz: string, dateISO: string, minutesFromMidnight: number) {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return DateTime.fromISO(dateISO, { zone: tz }).set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
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

/** returns full on shifts stock */
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

/**
 * For the next 5 shifts (by LC timezone), return only those that have
 * a stock doc with items, plus the delivery time-slot label for that shift.
 */
export async function nextFiveShiftsWithStock(params: {
  LCid: string;
  fromTs?: number;
}): Promise<Array<{ date: string; shift: ShiftName; docId: string; deliverySlotLabel: string }>> {
  const { LCid, fromTs } = params;

  // 1) Next exactly 5 shifts from shiftConfig (ordered)
  const upcoming = await getNextAvailableShifts({ logisticCenterId: LCid, count: 5, fromTs }); // [{date, name}]

  // 2) Single Mongo query for any existing docs among those 5
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

  // 3) Index found docs by (dateISO|shift)
  const key = (d: Date, s: string) => `${d.toISOString()}|${s}`;
  const byKey = new Map<string, { _id: Types.ObjectId; items: any[] }>();

  for (const d of docs) {
    byKey.set(key(d.availableDate, d.availableShift), {
      _id: d._id as Types.ObjectId,
      items: (d as any).items ?? [],
    });
  }

  // 4) Build output in the same order, only if doc has items
  const out: Array<{ date: string; shift: ShiftName; docId: string; deliverySlotLabel: string }> = [];
  for (const s of upcoming) {
    const hit = byKey.get(`${normalizeDateUTC(s.date).toISOString()}|${s.name}`);
    if (hit && hit.items.length > 0) {
      const deliverySlotLabel = await getDeliverySlotLabel({ LCid, shift: s.name as ShiftName });
      out.push({
        date: s.date,
        shift: s.name as ShiftName,
        docId: String(hit._id),
        deliverySlotLabel,
      });
    }
  }
  return out;
}

/* -------------------------- pricing & conversion helpers -------------------------- */

/**
 * Fetch price.a (price per KG) and unit conversion fields from Item.
 * - pricePerKg is required on AMS lines
 * - returns a derived pricePerUnit (or null if not applicable)
 * - returns sell-by-unit config for unitMode
 */
async function fetchItemPricingAndUnitConfig(itemId: string | Types.ObjectId): Promise<{
  pricePerKg: number;
  // unit projection
  byUnit: boolean;
  unitBundleSize: number;
  avgWeightPerUnitGr: number | null;
  sdWeightPerUnitGr: number;
  pricePerUnitDerived: number | null; // override respected
}> {
  const _id = typeof itemId === "string" ? new Types.ObjectId(itemId) : itemId;

  const it = await ItemModel.findById(_id, {
    price: 1,
    sellModes: 1,
    avgWeightPerUnitGr: 1,
    sdWeightPerUnitGr: 1,
    pricePerUnitOverride: 1,
  }).lean();

  if (!it || !it.price || typeof (it as any).price.a !== "number") {
    throw new Error("Item price.a not found");
  }

  const pricePerKg = Number((it as any).price.a);

  const byUnit = !!(it as any).sellModes?.byUnit;
  const unitBundleSize = Math.max(1, (it as any).sellModes?.unitBundleSize ?? 1);
  const avg = (it as any).avgWeightPerUnitGr ?? null;
  const sd = (it as any).sdWeightPerUnitGr ?? 0;

  // derive pricePerUnit from avg unless override exists
  let pricePerUnitDerived: number | null = null;
  if (byUnit) {
    const override = (it as any).pricePerUnitOverride;
    if (typeof override === "number" && override >= 0) {
      pricePerUnitDerived = override;
    } else if (avg && pricePerKg) {
      pricePerUnitDerived = pricePerKg * (avg / 1000);
    }
  }

  return {
    pricePerKg,
    byUnit,
    unitBundleSize,
    avgWeightPerUnitGr: avg,
    sdWeightPerUnitGr: sd,
    pricePerUnitDerived,
  };
}

/** Conservative estimate of how many units are obtainable from available KG. */
function conservativeUnitsEstimate(args: {
  availableKg: number;
  avgGr: number;
  sdGr?: number;
  zScore?: number;
  shrinkagePct?: number;
  bundle?: number;
}) {
  const { availableKg, avgGr, sdGr = 0, zScore = 1.28, shrinkagePct = 0.02, bundle = 1 } = args;
  if (!availableKg || !avgGr) return 0;

  const effKgPerUnit = (avgGr + zScore * sdGr) / 1000;
  const est = Math.floor(availableKg / (effKgPerUnit * (1 + shrinkagePct)));
  return Math.max(0, Math.floor(est / bundle) * bundle);
}

/* ----------------------------- atomic qty adjustment ----------------------------- */

/**
 * Atomically adjust quantity by deltaKg for a specific line in items[].
 * - deltaKg < 0 => reserve (decrement)
 * - deltaKg > 0 => release (increment)
 *
 * If `enforceEnoughForReserve` is true (default), a reserve (negative delta) will only succeed
 * when currentAvailableQuantityKg >= |deltaKg|.
 *
 * NOW session-aware: pass the same session used in your cart transaction.
 */
export async function adjustAvailableQtyAtomic(params: {
  docId: string;
  lineId: string;
  deltaKg: number;
  enforceEnoughForReserve?: boolean;
  session?: ClientSession | null;
}) {
  const { docId, lineId, deltaKg, enforceEnoughForReserve = true, session } = params;
  if (!deltaKg || !Number.isFinite(deltaKg)) throw new Error("deltaKg must be a non-zero finite number");

  const _docId = new Types.ObjectId(docId);
  const _lineId = new Types.ObjectId(lineId);

  const filter: any = { _id: _docId };

  if (deltaKg < 0 && enforceEnoughForReserve) {
    const need = Math.abs(deltaKg);
    filter.items = {
      $elemMatch: { _id: _lineId, currentAvailableQuantityKg: { $gte: need } },
    };
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
                          {
                            $min: [
                              "$$it.originalCommittedQuantityKg",
                              {
                                $add: ["$$it.currentAvailableQuantityKg", deltaKg],
                              },
                            ],
                          },
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

  if (result.matchedCount === 0) {
    if (deltaKg < 0 && enforceEnoughForReserve) throw new Error("Not enough available quantity to reserve");
    throw new Error("Document not found or lineId invalid");
  }

  // Best-effort: recompute the units estimate for that line (non-atomic follow-up).
  try {
    const doc = await AvailableMarketStockModel.findById(_docId, {
      items: { $elemMatch: { _id: _lineId } },
    }).lean();

    const line = (doc as any)?.items?.[0];
    if (line?.unitMode?.enabled && line?.unitMode?.avgWeightPerUnitGr) {
      const estimate = conservativeUnitsEstimate({
        availableKg: line.currentAvailableQuantityKg,
        avgGr: line.unitMode.avgWeightPerUnitGr,
        sdGr: line.unitMode.sdWeightPerUnitGr ?? 0,
        zScore: line.unitMode.zScore ?? 1.28,
        shrinkagePct: line.unitMode.shrinkagePct ?? 0.02,
        bundle: Math.max(1, line.unitMode.unitBundleSize ?? 1),
      });

      await AvailableMarketStockModel.updateOne(
        { _id: _docId, "items._id": _lineId },
        { $set: { "items.$.estimates.availableUnitsEstimate": estimate } }
      ).exec();
    }
  } catch {
    // swallow silently; not critical
  }

  return { ok: true };
}

/* ------------------------------ add/update/remove ------------------------------ */

export async function addItemToAvailableMarketStock(params: {
  docId: string;
  item: {
    itemId: string;
    displayName: string;
    imageUrl?: string | null;
    category: string;
    pricePerUnit?: number; // optional: if omitted we derive it
    originalCommittedQuantityKg: number;
    currentAvailableQuantityKg: number;
    farmerOrderId?: string | null;
    farmerID: string;
    farmerName: string;
    farmName: string;
    farmLogo?: string | null; // optional
    status?: "active" | "soldout" | "removed";
  };
}) {
  const { docId, item } = params;

  // --- Fetch item for pricing & unit info ---
  const itemDoc = await ItemModel.findById(item.itemId, {
    price: 1,
    avgWeightPerUnitGr: 1,
    sdWeightPerUnitGr: 1,
    sellModes: 1,
  }).lean();

  if (!itemDoc || !itemDoc.price || typeof (itemDoc as any).price.a !== "number") {
    throw new Error("Item price.a not found");
  }

  const pricePerKg: number = (itemDoc as any).price.a;
  const avgGr: number | null = (itemDoc as any).avgWeightPerUnitGr ?? null;
  const sdGr: number | null = (itemDoc as any).sdWeightPerUnitGr ?? null;

  // --- Derive pricePerUnit if not provided ---
  // If we have avg weight: pricePerUnit = pricePerKg * (avgGr/1000)
  // Else fallback to pricePerKg just to satisfy legacy requirement
  let pricePerUnit = item.pricePerUnit;
  if (pricePerUnit == null) {
    pricePerUnit =
      avgGr && avgGr > 0 ? pricePerKg * (avgGr / 1000) : pricePerKg;
  }

  // --- Determine unitMode (kg | unit | mixed) ---
  // Prefer sellModes if present; otherwise infer from avg weight
  let unitMode: "kg" | "unit" | "mixed" = "kg";
  const byUnit = !!(itemDoc as any).sellModes?.byUnit;
  const byKg = (itemDoc as any).sellModes?.byKg !== false; // default true

  if (byUnit && byKg) unitMode = "mixed";
  else if (byUnit) unitMode = "unit";
  else unitMode = avgGr && avgGr > 0 ? "unit" : "kg";

  // --- Compute estimates (kg-based) ---
  const avgWeightPerUnitKg =
    avgGr && avgGr > 0 ? avgGr / 1000 : null;
  const stdDevKg =
    sdGr && sdGr > 0 ? sdGr / 1000 : null;
  const availableUnitsEstimate =
    avgWeightPerUnitKg
      ? Math.floor(item.currentAvailableQuantityKg / avgWeightPerUnitKg)
      : null;

  // --- Build payload aligned to your current AMS model ---
  const payload: any = {
    itemId: new Types.ObjectId(item.itemId),
    displayName: item.displayName,
    imageUrl: item.imageUrl ?? null,
    category: item.category,

    // legacy required field (UI can still read this)
    pricePerUnit,

    // canonical inventory
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
      stdDevKg,
      availableUnitsEstimate,
    },

    status: item.status ?? "active",
  };

  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    docId,
    { $push: { items: payload } },
    { new: true }
  );

  const newLine = (updated as any)?.items?.at?.(-1);
  if (newLine?._id) console.log("new lineId:", newLine._id.toString());
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

    // keep estimates in sync if unit mode is enabled
    if (line.unitMode?.enabled && line.unitMode?.avgWeightPerUnitGr) {
      const est = conservativeUnitsEstimate({
        availableKg: line.currentAvailableQuantityKg,
        avgGr: line.unitMode.avgWeightPerUnitGr,
        sdGr: line.unitMode.sdWeightPerUnitGr ?? 0,
        zScore: line.unitMode.zScore ?? 1.28,
        shrinkagePct: line.unitMode.shrinkagePct ?? 0.02,
        bundle: Math.max(1, line.unitMode.unitBundleSize ?? 1),
      });
      if (!line.estimates) line.estimates = {};
      line.estimates.availableUnitsEstimate = est;
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
  return updated;
}
