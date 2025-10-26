import { FilterQuery, UpdateQuery } from "mongoose";
import ApiError from "../utils/ApiError";
import { ItemPacking, ItemPackingDoc } from "../models/ItemPacking";

/** ---------- Types ---------- */
export type ListParams = {
  page?: number;            // 1-based
  limit?: number;           // per-page
  sort?: string;            // e.g. "-createdAt" or "items.type"
  populate?: boolean;       // populate refs?
  // Filters (applied using $elemMatch on items)
  type?: string;
  variety?: string;
  category?: "fruit" | "vegetable";
  itemId?: string;
  fragility?: "very_fragile" | "fragile" | "normal" | "sturdy";
  allowMixing?: "true" | "false";
  requiresVentedBox?: "true" | "false";
};

const toBool = (v?: string) =>
  typeof v === "string" ? v.toLowerCase() === "true" : undefined;

/** Build Mongo filter */
function buildFilter(q: ListParams): FilterQuery<ItemPackingDoc> {
  const elem: any = {};
  if (q.type) elem.type = q.type;
  if (q.variety) elem.variety = q.variety;
  if (q.category) elem.category = q.category;
  if (q.itemId) elem.itemId = q.itemId; // string OK; Mongoose casts to ObjectId
  if (q.fragility) elem["packing.fragility"] = q.fragility;
  if (q.allowMixing !== undefined) elem["packing.allowMixing"] = toBool(q.allowMixing);
  if (q.requiresVentedBox !== undefined) elem["packing.requiresVentedBox"] = toBool(q.requiresVentedBox);

  const filter: FilterQuery<ItemPackingDoc> = {};
  if (Object.keys(elem).length) {
    filter.items = { $elemMatch: elem };
  }
  return filter;
}

export async function list(params: ListParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const filter = buildFilter(params);
  const query = ItemPacking.find(filter);

  if (params.sort) query.sort(params.sort);
  query.skip(skip).limit(limit);

  if (params.populate) {
    // CHANGED: also populate the virtual relation to PackageSize
    query
      .populate("items.itemId")
      .populate({ path: "minBoxTypeDocs" }); // virtual populate
  }

  const [items, total] = await Promise.all([
    query.lean({ virtuals: true }),
    ItemPacking.countDocuments(filter),
  ]);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function getById(id: string, populate = false) {
  const q = ItemPacking.findById(id);
  if (populate) {
    // CHANGED: also include virtual populate
    q.populate("items.itemId").populate({ path: "minBoxTypeDocs" });
  }
  const doc = await q;
  if (!doc) throw new ApiError(404, "ItemPacking not found");
  return doc.toJSON();
}

export async function create(payload: Partial<ItemPackingDoc>) {
  const doc = await ItemPacking.create(payload);
  return doc.toJSON();
}

export async function update(id: string, patch: UpdateQuery<ItemPackingDoc>) {
  const doc = await ItemPacking.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw new ApiError(404, "ItemPacking not found");
  return doc.toJSON();
}

export async function remove(id: string) {
  const doc = await ItemPacking.findByIdAndDelete(id);
  if (!doc) throw new ApiError(404, "ItemPacking not found");
  return { id: doc.id, deleted: true };
}



