// src/services/ItemPacking.service.ts
import { FilterQuery, UpdateQuery, ClientSession } from "mongoose";
import ApiError from "../utils/ApiError";
import { ItemPacking, ItemPackingDoc, ItemPackingCreateInput } from "../models/ItemPacking";
import { type ItemCategory } from "../models/Item.model";

/** ---------- Types ---------- */
export type ListParams = {
  page?: number;            // 1-based
  limit?: number;           // per-page
  sort?: string;            // e.g. "-createdAt" or "createdAt"
  populate?: boolean;       // include joined Item + PackageSize info
  // Filters
  type?: string;
  variety?: string;
  category?: ItemCategory;
  itemId?: string;
  fragility?: "very_fragile" | "fragile" | "normal" | "sturdy";
  allowMixing?: "true" | "false";
  requiresVentedBox?: "true" | "false";
};

const toBool = (v?: string) =>
  typeof v === "string" ? v.toLowerCase() === "true" : undefined;

/** ---------- Basic filter for direct fields (no Item join needed) ---------- */
function buildDirectFilter(q: ListParams): FilterQuery<ItemPackingDoc> {
  const filter: FilterQuery<ItemPackingDoc> = {};
  const elem: any = {};

  if (q.itemId) elem.itemId = q.itemId; // cast to ObjectId by Mongoose
  if (q.fragility) elem["packing.fragility"] = q.fragility;
  if (q.allowMixing !== undefined) elem["packing.allowMixing"] = toBool(q.allowMixing);
  if (q.requiresVentedBox !== undefined) elem["packing.requiresVentedBox"] = toBool(q.requiresVentedBox);

  if (Object.keys(elem).length) filter.items = { $elemMatch: elem };
  return filter;
}

/** ---------- Should we run an aggregate? ---------- */
function needsItemJoin(q: ListParams) {
  return Boolean(q.type || q.variety || q.category || q.populate);
}

/** ---------- List (find or aggregate) ---------- */
export async function list(params: ListParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  // If we need to filter by Item fields or populate Items, use aggregate + $lookup
  if (needsItemJoin(params)) {
    const matchItems: any = {};
    if (params.type) matchItems.type = params.type;
    if (params.variety) matchItems.variety = params.variety;
    if (params.category) matchItems.category = params.category;

    const matchPacking: any = {};
    if (params.itemId) matchPacking["items.itemId"] = { $toObjectId: params.itemId }; // handle string ids
    if (params.fragility) matchPacking["items.packing.fragility"] = params.fragility;
    if (params.allowMixing !== undefined) matchPacking["items.packing.allowMixing"] = toBool(params.allowMixing);
    if (params.requiresVentedBox !== undefined) matchPacking["items.packing.requiresVentedBox"] = toBool(params.requiresVentedBox);

    // Build pipeline
    const pipeline: any[] = [
      ...(Object.keys(matchPacking).length ? [{ $match: matchPacking }] : []),
      { $unwind: "$items" },
      {
        $lookup: {
          from: "items", // collection name for your Item model
          localField: "items.itemId",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: "$item" },
      ...(Object.keys(matchItems).length ? [{ $match: { "item": matchItems } }] : []),
    ];

    // Optionally join PackageSize if populating
    if (params.populate) {
      pipeline.push(
        {
          $lookup: {
            from: "packagesizes", // collection of PackageSize
            localField: "items.packing.minBoxType",
            foreignField: "key",
            as: "minBoxTypeDocs",
          },
        }
      );
    }

    // Re-group to documents; when populating, keep joined item inline for each entry
    pipeline.push({
      $group: {
        _id: "$_id",
        root: { $first: "$$ROOT" },
        items: {
          $push: {
            itemId: "$items.itemId",
            packing: "$items.packing",
            ...(params.populate ? { item: "$item" } : {}),
          },
        },
      },
    });

    pipeline.push({
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            "$root",
            { items: "$items" },
            ...(params.populate ? [{ minBoxTypeDocs: "$root.minBoxTypeDocs" }] : []),
          ],
        },
      },
    });

    // Sorting
    if (params.sort) {
      // allow simple sort on top-level fields like createdAt / updatedAt
      const dir = params.sort.startsWith("-") ? -1 : 1;
      const field = params.sort.replace(/^-/, "");
      pipeline.push({ $sort: { [field]: dir } });
    } else {
      pipeline.push({ $sort: { updatedAt: -1 } });
    }

    // Pagination with total
    pipeline.push(
      { $skip: skip },
      { $limit: limit }
    );

    const countPipeline = [
      ...(Object.keys(matchPacking).length ? [{ $match: matchPacking }] : []),
      { $unwind: "$items" },
      {
        $lookup: {
          from: "items",
          localField: "items.itemId",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: "$item" },
      ...(Object.keys(matchItems).length ? [{ $match: { "item": matchItems } }] : []),
      { $group: { _id: "$_id" } },
      { $count: "total" },
    ];

    const [items, countRes] = await Promise.all([
      ItemPacking.aggregate(pipeline),
      ItemPacking.aggregate(countPipeline),
    ]);

    const total = countRes?.[0]?.total ?? 0;

    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  // Simple path: no item join needed
  const filter = buildDirectFilter(params);
  const query = ItemPacking.find(filter);

  if (params.sort) query.sort(params.sort);
  else query.sort("-updatedAt");

  query.skip(skip).limit(limit);

  // When no join is needed but populate requested, we can populate itemId refs
  if (params.populate) {
    query.populate("items.itemId").populate({ path: "minBoxTypeDocs" });
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

/** ---------- Get by ID ---------- */
export async function getById(id: string, populate = false) {
  const q = ItemPacking.findById(id);
  if (populate) {
    q.populate("items.itemId").populate({ path: "minBoxTypeDocs" });
  }
  const doc = await q;
  if (!doc) throw new ApiError(404, "ItemPacking not found");
  return doc.toJSON();
}

/** ---------- Create (supports session) ---------- */
export async function create(
  payload: ItemPackingCreateInput,
  opts?: { session?: ClientSession }
) {
  const [doc] = await ItemPacking.create([payload], { session: opts?.session });
  return doc.toJSON();
}

/** ---------- Update ---------- */
export async function update(id: string, patch: UpdateQuery<ItemPackingDoc>) {
  const doc = await ItemPacking.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw new ApiError(404, "ItemPacking not found");
  return doc.toJSON();
}

/** ---------- Remove ---------- */
export async function remove(id: string) {
  const doc = await ItemPacking.findByIdAndDelete(id);
  if (!doc) throw new ApiError(404, "ItemPacking not found");
  return { id: doc.id, deleted: true };
}
