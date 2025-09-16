import { FilterQuery, Types } from "mongoose";
import { AvailableMarketStockModel } from "../models/availableMarketStock.model";
import { SHIFT_NAMES } from "../models/availableMarketStock.model";
import ItemModel from "../models/Item.model"; // adjust import to your project path
import { getNextAvailableShifts } from "./shiftConfig.service"; // <-- use your actual path

type ShiftName = (typeof SHIFT_NAMES)[number];

function normalizeDateUTC(d: Date | string): Date {
  const dd = typeof d === "string" ? new Date(d) : new Date(d);
  dd.setUTCHours(0, 0, 0, 0);
  return dd;
}

export async function findOrCreateAvailableMarketStock(params: {
  LCid: string;
  date: string | Date;       // "YYYY-MM-DD" or Date
  shift: ShiftName;
  createdById?: string | Types.ObjectId | null;
}) {
  const { LCid, date, shift, createdById = null } = params;
  const availableDate = normalizeDateUTC(date);

  const existing = await AvailableMarketStockModel.findOne({ LCid, availableDate, availableShift: shift });
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
  return AvailableMarketStockModel.findOne({ LCid, availableDate, availableShift: shift });
}


//returns full on shifts stock
export async function listUpcomingAvailableMarketStock(params: {
  LCid: string;
  count?: number;
  fromDate?: string | Date; // default today
}) {
  const { LCid, count = 6, fromDate } = params;
  const start = normalizeDateUTC(fromDate ?? new Date());

  // Upcoming = today and later, any shift, same LC
  const q: FilterQuery<any> = { LCid, availableDate: { $gte: start } };
  return AvailableMarketStockModel
    .find(q)
    .sort({ availableDate: 1, availableShift: 1 })
    .limit(count)
    .lean();
}


/**
 * For the next 5 shifts (by LC timezone), return only those that have
 * an AvailableMarketStock doc WITH at least 1 item.
 * Output: [{ date: "YYYY-MM-DD", shift: "morning|...", docId: "<ObjectId>" }]
 */
export async function nextFiveShiftsWithStock(params: {
  LCid: string;
  fromTs?: number; // optional for tests
}): Promise<Array<{ date: string; shift: ShiftName; docId: string }>> {
  const { LCid, fromTs } = params;

  // 1) Get exactly the next 5 shifts
  const upcoming = await getNextAvailableShifts({
    logisticCenterId: LCid,
    count: 5,
    fromTs,
  }); // [{ date, name }]

  // 2) Build an $or for a single Mongo query
  const orPairs = upcoming.map((s) => ({
    LCid,
    availableDate: normalizeDateUTC(s.date),
    availableShift: s.name as ShiftName,
  }));

  // If LC has fewer than 4 defined shifts, avoid empty $or
  if (orPairs.length === 0) return [];

  // 3) Fetch all matching docs at once (only what we need)
  const docs = await AvailableMarketStockModel.find(
    { $or: orPairs },
    { _id: 1, availableDate: 1, availableShift: 1, items: 1 }
  ).lean();

  // 4) Index by (dateISO + "|" + shift) for O(1) lookup preserving original order
  const key = (d: Date, s: string) => `${d.toISOString()}|${s}`;
  const byKey = new Map<string, { _id: Types.ObjectId; items: any[] }>();
  for (const d of docs) {
    const k = key(normalizeDateUTC(d.availableDate), d.availableShift);
    byKey.set(k, { _id: d._id as Types.ObjectId, items: d.items ?? [] });
  }

  // 5) Map the 5 shifts, keep only those with stock items
  const out: Array<{ date: string; shift: ShiftName; docId: string }> = [];
  for (const s of upcoming) {
    const k = key(normalizeDateUTC(s.date), s.name);
    const hit = byKey.get(k);
    if (hit && hit.items.length > 0) {
      out.push({
        date: s.date,
        shift: s.name as ShiftName,
        docId: String(hit._id),
      });
    }
  }

  return out;
}


// If caller doesn't pass pricePerUnit, compute from Item.price.a * 1.2
async function computePriceFromItem(itemId: string | Types.ObjectId): Promise<number> {
  const _id = typeof itemId === "string" ? new Types.ObjectId(itemId) : itemId;
  const it = await ItemModel.findById(_id, { price: 1 }).lean();
  if (!it || !it.price || typeof it.price.a !== "number") {
    throw new Error("Item price.a not found");
  }
  // price.a * 1.2 (catalog base A → retail)
  return Number((it.price.a * 1.2).toFixed(2));
}

export async function addItemToAvailableMarketStock(params: {
  docId: string;
  item: {
    itemId: string;
    displayName: string;
    imageUrl?: string | null;
    category: string;
    pricePerUnit?: number; // optional -> will be computed if missing
    originalCommittedQuantityKg: number;
    currentAvailableQuantityKg: number;
    farmerOrderId?: string | null;
    farmerID: string;
    farmerName: string;
    farmName: string;
    status?: "active" | "soldout" | "removed";
  };
}) {
  const { docId, item } = params;

  // derive price if needed
  let pricePerUnit = item.pricePerUnit;
  if (pricePerUnit == null) {
    pricePerUnit = await computePriceFromItem(item.itemId);
  }

  const payload = {
    itemId: new Types.ObjectId(item.itemId),
    displayName: item.displayName,
    imageUrl: item.imageUrl ?? null,
    category: item.category,
    pricePerUnit,
    originalCommittedQuantityKg: item.originalCommittedQuantityKg,
    currentAvailableQuantityKg: item.currentAvailableQuantityKg,
    farmerOrderId: item.farmerOrderId ? new Types.ObjectId(item.farmerOrderId) : null,
    farmerID: new Types.ObjectId(item.farmerID),
    farmerName: item.farmerName,
    farmName: item.farmName,
    status: item.status ?? "active",
  };

  const updated = await AvailableMarketStockModel.findByIdAndUpdate(
    docId,
    { $push: { items: payload } },
    { new: true }
  );
  return updated;
}

export async function updateItemQtyStatus(params: {
  docId: string;
  lineId: string; // subdoc _id
  currentAvailableQuantityKg?: number;
  status?: "active" | "soldout" | "removed";
}) {
  const { docId, lineId, currentAvailableQuantityKg, status } = params;

  const doc = await AvailableMarketStockModel.findById(docId);
  if (!doc) throw new Error("AvailableMarketStock not found");

  const line = doc.items.id(lineId);
  if (!line) throw new Error("Line item not found");

  if (typeof currentAvailableQuantityKg === "number") {
    if (currentAvailableQuantityKg < 0) throw new Error("Quantity cannot be negative");
    if (currentAvailableQuantityKg > line.originalCommittedQuantityKg) {
      throw new Error("currentAvailableQuantityKg cannot exceed originalCommittedQuantityKg");
    }
    line.currentAvailableQuantityKg = currentAvailableQuantityKg;
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
