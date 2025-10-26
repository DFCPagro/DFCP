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
  deltaKg: number;                  // negative => reserve, positive => release
  enforceEnoughForReserve?: boolean;
  session?: ClientSession | null;
}) {
  const { docId, farmerOrderId, deltaKg, enforceEnoughForReserve = true, session } = args;

  if (!Number.isFinite(deltaKg) || deltaKg === 0) {
    const err: any = new Error("deltaKg must be a non-zero finite number");
    err.name = "BadRequest";
    throw err;
  }

  const _docId = new Types.ObjectId(docId);
  const _foId  = new Types.ObjectId(farmerOrderId);

  // 1) Atomic $inc with preconditions in the FILTER (never in $set value)
  const filter: any = { _id: _docId, "items.farmerOrderId": _foId };

  // For reservations, ensure enough stock BEFORE we $inc negatively
  if (enforceEnoughForReserve && deltaKg < 0) {
    filter["items.currentAvailableQuantityKg"] = { $gte: Math.abs(deltaKg) };
  }

  const incRes = await AvailableMarketStockModel.updateOne(
    filter,
    { $inc: { "items.$.currentAvailableQuantityKg": deltaKg } },
    { session: session ?? undefined }
  );

  if (incRes.matchedCount === 0 || incRes.modifiedCount === 0) {
    const err: any = new Error(
      `Failed to update AMS.kg for farmerOrderId=${farmerOrderId} (delta=${deltaKg}).`
    );
    err.name = "BadRequest";
    if (enforceEnoughForReserve && deltaKg < 0) {
      err.details = ["Not enough KG available to reserve"];
    }
    throw err;
  }

  // 2) Clamp in a SECOND step using a numeric literal (no expressions in the value)
  //    Read the line, compute clamped number, write that number back if needed.
  try {
    const doc = await AvailableMarketStockModel.findOne(
      { _id: _docId, "items.farmerOrderId": _foId },
      { "items.$": 1 }
    ).lean();

    const line = (doc as any)?.items?.[0];
    if (!line) return { ok: true };

    const orig = Number(line.originalCommittedQuantityKg) || 0;
    let cur   = Number(line.currentAvailableQuantityKg)   || 0;

    // Clamp to [0 .. original]
    if (cur < 0 || cur > orig) {
      const clamped = Math.max(0, Math.min(cur, orig));

      await AvailableMarketStockModel.updateOne(
        { _id: _docId, "items.farmerOrderId": _foId },
        { $set: { "items.$.currentAvailableQuantityKg": clamped } },
        { session: session ?? undefined }
      );
      cur = clamped;
    }

    // Recompute availableUnitsEstimate if unit/mixed with an avg defined
    const unity = line.unitMode === "unit" || line.unitMode === "mixed";
    const avg   = line?.estimates?.avgWeightPerUnitKg ?? null;
    if (unity && Number.isFinite(avg) && avg > 0) {
      const est = conservativeUnitsFromKg(
        cur,
        avg,
        line?.estimates?.sdKg ?? 0,
        line?.estimates?.zScore ?? 1.28,
        line?.estimates?.shrinkagePct ?? 0.02,
        Math.max(1, line?.estimates?.unitBundleSize ?? 1)
      );

      await AvailableMarketStockModel.updateOne(
        { _id: _docId, "items.farmerOrderId": _foId },
        { $set: { "items.$.estimates.availableUnitsEstimate": est } },
        { session: session ?? undefined }
      );
    }
  } catch (e) {
    warn("adjustAvailableKgByFOAtomic.postClampOrEstimate.error", e);
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

  const _docId = new Types.ObjectId(docId);
  const _foId  = new Types.ObjectId(farmerOrderId);

  // Read the line to compute kgDelta (we need avg/sd/bundle)
  const doc = await AvailableMarketStockModel.findOne(
    { _id: _docId, "items.farmerOrderId": _foId },
    { "items.$": 1 }
  ).lean();

  const line = (doc as any)?.items?.[0];
  if (!line) {
    const err: any = new Error("AMS line not found for farmerOrderId");
    err.name = "BadRequest";
    throw err;
  }

  const unity = line.unitMode === "unit" || line.unitMode === "mixed";
  const avg   = line?.estimates?.avgWeightPerUnitKg ?? null;
  if (!unity || !(Number.isFinite(avg) && avg > 0)) {
    const err: any = new Error("This item is not sold by unit or missing avgWeightPerUnitKg");
    err.name = "BadRequest";
    err.details = ["Expected unit/mixed mode with estimates.avgWeightPerUnitKg > 0"];
    throw err;
  }

  const kgDelta = unitsToKgDelta({
    unitsDelta,
    avgKg: avg,
    sdKg: line?.estimates?.sdKg ?? 0,
    zScore: line?.estimates?.zScore ?? 1.28,
    shrinkagePct: line?.estimates?.shrinkagePct ?? 0.02,
    bundle: Math.max(1, line?.estimates?.unitBundleSize ?? 1),
  });

  if (kgDelta === 0) return { ok: true };

  // Delegate to the KG helper (which does atomic $inc + safe clamp)
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

    // Caller-sent pricePerUnit is ignored (authoritative from Item)
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
  function round2(n: number | null | undefined) {
    return typeof n === "number" && isFinite(n)
      ? Math.round(n * 100) / 100
      : null;
  }

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

  if (!it) throw new Error("Item not found");

  const category = String(it?.category ?? "").toLowerCase();

  // 1a) Determine reliable pricePerKg
  let pricePerKg: number | null = null;
  const a = (it as any)?.price?.a;
  if (category !== "egg_dairy" && typeof a === "number" && isFinite(a) && a >= 0) {
    pricePerKg = a;
  } else if (category === "egg_dairy") {
    const perUnitOverride = (it as any)?.pricePerUnitOverride;
    const avgGr = (it as any)?.avgWeightPerUnitGr;
    if (
      typeof perUnitOverride === "number" &&
      perUnitOverride >= 0 &&
      typeof avgGr === "number" &&
      isFinite(avgGr) &&
      avgGr > 0
    ) {
      pricePerKg = perUnitOverride / (avgGr / 1000);
    }
  }
  if (!Number.isFinite(pricePerKg) || (pricePerKg as number) < 0) {
    throw new Error("Item price.a not found");
  }
  pricePerKg = Number(pricePerKg);

  // 2) Determine selling mode (new + legacy fallback)
  let byUnit: boolean = !!(it as any).sellModes?.byUnit;
  let byKg: boolean = (it as any).sellModes?.byKg !== false;
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

  // 3) Compute pricePerUnit
  const avgGr: number | null = (it as any).avgWeightPerUnitGr ?? null;
  const sdGr: number = (it as any).sdWeightPerUnitGr ?? 0;
  const hasAvg = typeof avgGr === "number" && avgGr > 0;

  let pricePerUnit: number | null = null;
  if (unitMode === "unit" || unitMode === "mixed") {
    const override = (it as any).pricePerUnitOverride;
    if (typeof override === "number" && override >= 0) {
      pricePerUnit = override;
    } else if (hasAvg) {
      pricePerUnit = pricePerKg * (avgGr! / 1000);
    }
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

  // 5) Bundle enrichments — all inside estimates (schema-safe)
  const isBundle = (unitMode === "unit" || unitMode === "mixed");
  const bundleWeightKg =
    isBundle && typeof avgWeightPerUnitKg === "number"
      ? unitBundleSize * avgWeightPerUnitKg
      : null;

  const perBundlePrice =
    typeof pricePerUnit === "number"
      ? pricePerUnit * unitBundleSize
      : typeof bundleWeightKg === "number"
      ? pricePerKg * bundleWeightKg
      : null;

  const bundleNote =
    isBundle
      ? [
          "Bundle:",
          `${Math.max(1, unitBundleSize)}×`,
          typeof avgWeightPerUnitKg === "number" ? `~${round2(avgWeightPerUnitKg)} kg` : null,
          typeof bundleWeightKg === "number" ? `≈ ${round2(bundleWeightKg)} kg` : null,
          typeof perBundlePrice === "number" ? `, ~${round2(perBundlePrice)} per bundle` : null,
        ].filter(Boolean).join(" ")
      : null;

  // 6) Payload — fully schema-safe
  const payload: any = {
    itemId: new Types.ObjectId(item.itemId),
    displayName: item.displayName,
    imageUrl: it?.imageUrl ?? item.imageUrl ?? null,
    category: it?.category ?? item.category,

    pricePerKg: pricePerKg * 1.2,
    pricePerUnit: pricePerUnit * 1.2 ?? null,

    originalCommittedQuantityKg: item.originalCommittedQuantityKg,
    currentAvailableQuantityKg: item.currentAvailableQuantityKg,

    farmerOrderId: item.farmerOrderId ? new Types.ObjectId(item.farmerOrderId) : null,
    farmerID: new Types.ObjectId(item.farmerID),
    farmerName: item.farmerName,
    farmName: item.farmName,
    farmLogo: item.farmLogo ?? null,

    unitMode,

    estimates: {
      avgWeightPerUnitKg,
      sdKg,
      availableUnitsEstimate,
      unitBundleSize,
      zScore,
      shrinkagePct,
      // new bundle enrichments (safe inside estimates)
      bundleWeightKg: typeof bundleWeightKg === "number" ? round2(bundleWeightKg) : null,
      perBundlePrice: typeof perBundlePrice === "number" ? round2(perBundlePrice) : null,
      bundleNote, // new textual note (safe nested property)
    },

    status: item.status ?? "active",
  };

  // 7) Persist
  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    docId,
    { $push: { items: payload } },
    { new: true }
  );

  if (!updated) throw new Error(`Failed to update AvailableMarketStock ${docId}`);

  dbg("AMS addItem> saved", {
    farmerOrderId: payload.farmerOrderId?.toString() ?? null,
    unitMode,
    pricePerKg,
    pricePerUnit,
    avgWeightPerUnitKg,
    availableUnitsEstimate,
    bundleWeightKg: payload.estimates.bundleWeightKg,
    perBundlePrice: payload.estimates.perBundlePrice,
  });

  return updated;
}



/** Update item quantity and/or status by FarmerOrderId */
export async function updateItemQtyStatusAtomic(params: {
  docId: string;
  farmerOrderId: string;
  currentAvailableQuantityKg?: number;             // absolute set (we will clamp)
  status?: "active" | "soldout" | "removed";
}) {
  const { docId, farmerOrderId, currentAvailableQuantityKg, status } = params;

  const _docId = new Types.ObjectId(docId);
  const _foId  = new Types.ObjectId(farmerOrderId);

  // Nothing to do?
  if (typeof currentAvailableQuantityKg !== "number" && !status) {
    return await AvailableMarketStockModel.findById(docId);
  }

  // Read line to know original for clamping
  const doc = await AvailableMarketStockModel.findOne(
    { _id: _docId, "items.farmerOrderId": _foId },
    { "items.$": 1 }
  ).lean();

  const line = (doc as any)?.items?.[0];
  if (!line) throw new Error("AvailableMarketStock not found or FO not matched");

  const updates: any = {};

  if (typeof currentAvailableQuantityKg === "number") {
    if (currentAvailableQuantityKg < 0) throw new Error("Quantity cannot be negative");
    const orig = Number(line.originalCommittedQuantityKg) || 0;
    const clamped = Math.max(0, Math.min(currentAvailableQuantityKg, orig));
    updates["items.$.currentAvailableQuantityKg"] = clamped;
  }

  if (status) {
    updates["items.$.status"] = status;
  }

  if (Object.keys(updates).length > 0) {
    await AvailableMarketStockModel.updateOne(
      { _id: _docId, "items.farmerOrderId": _foId },
      { $set: updates }
    );
  }

  // Recompute estimate if we touched quantity
  if (typeof currentAvailableQuantityKg === "number") {
    const fresh = await AvailableMarketStockModel.findOne(
      { _id: _docId, "items.farmerOrderId": _foId },
      { "items.$": 1 }
    ).lean();

    const ln = (fresh as any)?.items?.[0];
    if (ln) {
      const unity = ln.unitMode === "unit" || ln.unitMode === "mixed";
      const avg   = ln?.estimates?.avgWeightPerUnitKg ?? null;

      if (unity && Number.isFinite(avg) && avg > 0) {
        const est = conservativeUnitsFromKg(
          ln.currentAvailableQuantityKg,
          avg,
          ln?.estimates?.sdKg ?? 0,
          ln?.estimates?.zScore ?? 1.28,
          ln?.estimates?.shrinkagePct ?? 0.02,
          Math.max(1, ln?.estimates?.unitBundleSize ?? 1)
        );

        await AvailableMarketStockModel.updateOne(
          { _id: _docId, "items.farmerOrderId": _foId },
          { $set: { "items.$.estimates.availableUnitsEstimate": est } }
        );
      } else if (ln?.estimates) {
        await AvailableMarketStockModel.updateOne(
          { _id: _docId, "items.farmerOrderId": _foId },
          { $set: { "items.$.estimates.availableUnitsEstimate": null } }
        );
      }
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
