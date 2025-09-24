import { FilterQuery, Types } from "mongoose";
import ApiError from "../utils/ApiError";
import {
  DemandStaticsModel,
  DemandStatics,
  DemandStaticsDoc,
} from "../models/DemandStatics.model";
import { PUBLIC_ITEM_PROJECTION } from "../models/Item.model"

function buildFilter(day?: string, part?: string): FilterQuery<DemandStatics> {
  const f: FilterQuery<DemandStatics> = {};
  if (day) f.slotKey = new RegExp(`^${day}-`, "i");
  if (part) f.slotKey = f.slotKey ? new RegExp(`^${day}-${part}$`, "i") : new RegExp(`-${part}$`, "i");
  return f;
}

/** Accepts normalized {slotKey, items} or raw {"monday-afternoon": { items }} */
export function normalizeBody(payload: any): DemandStatics {
  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "Body must be an object");
  }
  if (payload.slotKey && payload.items) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    return {
      slotKey: String(payload.slotKey).toLowerCase().trim(),
      items: items.map((it: any) => ({
        itemId: new Types.ObjectId(it.itemId),
        itemDisplayName: it.itemDisplayName ?? null,
        averageDemandQuantityKg: Number(it.averageDemandQuantityKg ?? 0),
      })),
    };
  }
  // raw dynamic-key input
  return DemandStaticsModel.fromRaw(payload);
}

export async function createSlot(data: DemandStatics): Promise<DemandStaticsDoc> {
  try {
    return await DemandStaticsModel.create(data);
  } catch (err: any) {
    if (err?.code === 11000) throw new ApiError(409, `slotKey "${data.slotKey}" already exists`);
    throw err;
  }
}

export async function upsertSlot(data: DemandStatics): Promise<DemandStaticsDoc> {
  const doc = await DemandStaticsModel.findOneAndUpdate(
    { slotKey: data.slotKey },
    { $set: { items: data.items } },
    { new: true, upsert: true, runValidators: true }
  );
  if (!doc) throw new ApiError(500, "Failed to upsert slot");
  return doc;
}

function projectItemsForResponse(slot: any) {
  // slot.items[].itemId may be populated doc or ObjectId
  slot.items = (slot.items ?? []).map((it: any) => {
    const itemDoc = (it.itemId && typeof it.itemId === "object" && "_id" in it.itemId) ? it.itemId : null;
    const display = it.itemDisplayName ?? itemDoc?.name ?? null; // Item.name virtual
    return {
      itemId: itemDoc?._id?.toString?.() ?? it.itemId?.toString?.(),
      itemDisplayName: display,
      averageDemandQuantityKg: it.averageDemandQuantityKg,
    };
  });
  return slot;
}

export async function listSlots(opts: {
  page?: number;
  limit?: number;
  day?: string;
  part?: string;
}) {
  const page = Math.max(1, Number(opts.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(opts.limit ?? 20)));
  const filter = buildFilter(opts.day, opts.part);

  const [docs, total] = await Promise.all([
    DemandStaticsModel.find(filter)
      .sort({ slotKey: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate({ path: "items.itemId", select: PUBLIC_ITEM_PROJECTION }) // include Item name virtuals
      .lean(),
    DemandStaticsModel.countDocuments(filter),
  ]);

  const items = docs.map(projectItemsForResponse);

  return { items, page, limit, total, pages: Math.ceil(total / limit) || 1 };
}

export async function getBySlotKey(slotKey: string) {
  const doc = await DemandStaticsModel.findOne({ slotKey: slotKey.toLowerCase() })
    .populate({ path: "items.itemId", select: PUBLIC_ITEM_PROJECTION })
    .lean();
  if (!doc) throw new ApiError(404, "Slot not found");
  return projectItemsForResponse(doc);
}

export async function replaceItems(slotKey: string, items: DemandStatics["items"]) {
  const normalized = (items ?? []).map((it: any) => ({
    itemId: new Types.ObjectId(it.itemId),
    itemDisplayName: it.itemDisplayName ?? null,
    averageDemandQuantityKg: Number(it.averageDemandQuantityKg ?? 0),
  }));

  const doc = await DemandStaticsModel.findOneAndUpdate(
    { slotKey: slotKey.toLowerCase() },
    { $set: { items: normalized } },
    { new: true, runValidators: true }
  )
    .populate({ path: "items.itemId", select: PUBLIC_ITEM_PROJECTION })
    .lean();
  if (!doc) throw new ApiError(404, "Slot not found");
  return projectItemsForResponse(doc);
}

export async function removeSlot(slotKey: string) {
  const res = await DemandStaticsModel.findOneAndDelete({ slotKey: slotKey.toLowerCase() }).lean();
  if (!res) throw new ApiError(404, "Slot not found");
  return res;
}

/** Bulk import: array like your sample input (raw dynamic keys or normalized) */
export async function bulkImportRaw(rawArray: any[]) {
  if (!Array.isArray(rawArray)) throw new ApiError(400, "Body must be an array");
  const normalized = rawArray.map((raw) => normalizeBody(raw));
  const ops = normalized.map((d) => ({
    updateOne: { filter: { slotKey: d.slotKey }, update: { $set: { items: d.items } }, upsert: true },
  }));
  const result = await DemandStaticsModel.bulkWrite(ops);
  return { upserted: result.upsertedCount, modified: result.modifiedCount, matched: result.matchedCount };
}
