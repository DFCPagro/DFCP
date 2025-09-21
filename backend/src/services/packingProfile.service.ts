import { FilterQuery, UpdateQuery } from "mongoose";
import ApiError from "../utils/ApiError";
import { PackingProfile, PackingProfileDoc } from "../models/PackingProfile";

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
function buildFilter(q: ListParams): FilterQuery<PackingProfileDoc> {
  const elem: any = {};
  if (q.type) elem.type = q.type;
  if (q.variety) elem.variety = q.variety;
  if (q.category) elem.category = q.category;
  if (q.itemId) elem.itemId = q.itemId;
  if (q.fragility) elem["packing.fragility"] = q.fragility;
  if (q.allowMixing !== undefined) elem["packing.allowMixing"] = toBool(q.allowMixing);
  if (q.requiresVentedBox !== undefined) elem["packing.requiresVentedBox"] = toBool(q.requiresVentedBox);

  const filter: FilterQuery<PackingProfileDoc> = {};
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
  const query = PackingProfile.find(filter);

  if (params.sort) query.sort(params.sort);
  query.skip(skip).limit(limit);

  if (params.populate) {
    query
      .populate("items.itemId")
      .populate("items.packing.minBoxType");
  }

  const [items, total] = await Promise.all([
    query.lean({ virtuals: true }),
    PackingProfile.countDocuments(filter),
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
  const q = PackingProfile.findById(id);
  if (populate) q.populate("items.itemId").populate("items.packing.minBoxType");
  const doc = await q;
  if (!doc) throw new ApiError(404, "PackingProfile not found");
  return doc.toJSON();
}

export async function create(payload: Partial<PackingProfileDoc>) {
  const doc = await PackingProfile.create(payload);
  return doc.toJSON();
}

export async function update(id: string, patch: UpdateQuery<PackingProfileDoc>) {
  const doc = await PackingProfile.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw new ApiError(404, "PackingProfile not found");
  return doc.toJSON();
}

export async function remove(id: string) {
  const doc = await PackingProfile.findByIdAndDelete(id);
  if (!doc) throw new ApiError(404, "PackingProfile not found");
  return { id: doc.id, deleted: true };
}
