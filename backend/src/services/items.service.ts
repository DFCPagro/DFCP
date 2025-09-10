import { FilterQuery, ProjectionType, QueryOptions, UpdateQuery } from "mongoose";
import Item, { IItem, ItemCategory } from "../models/Item.model";

export type ListItemsFilters = {
  category?: ItemCategory;
  type?: string;
  variety?: string;
  q?: string;                 // full-text over type/variety
  minCalories?: number;
  maxCalories?: number;
};

export type ListItemsOptions = {
  page?: number;              // 1-based
  limit?: number;             // per page
  sort?: string;              // e.g. "-updatedAt" or "type"
  projection?: ProjectionType<IItem>;
  lean?: boolean;
};

const DEFAULT_LIMIT = 20;

export async function createItem(payload: Partial<IItem>): Promise<IItem> {
  // Mongoose will enforce required fields from schema
  const doc = await Item.create(payload as any);
  return doc;
}

export async function getItemByItemId(_id: string, projection?: ProjectionType<IItem>) {
  return Item.findOne({ _id }, projection).exec();
}

export async function getItemByMongoId(id: string, projection?: ProjectionType<IItem>) {
  return Item.findById(id, projection).exec();
}

export async function listItems(
  filters: ListItemsFilters = {},
  opts: ListItemsOptions = {}
) {
  const {
    category, type, variety, q, minCalories, maxCalories,
  } = filters;

  const query: FilterQuery<IItem> = {};

  if (category) query.category = category;
  if (type) query.type = new RegExp(`^${escapeRegex(type)}$`, "i");
  if (variety) query.variety = new RegExp(`^${escapeRegex(variety)}$`, "i");

  if (q) {
    // simple case-insensitive search over type/variety
    const re = new RegExp(escapeRegex(q), "i");
    query.$or = [{ type: re }, { variety: re }];
  }

  if (minCalories != null || maxCalories != null) {
    query.caloriesPer100g = {};
    if (minCalories != null) (query.caloriesPer100g as any).$gte = minCalories;
    if (maxCalories != null) (query.caloriesPer100g as any).$lte = maxCalories;
  }

  const page = Math.max(1, Number(opts.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(opts.limit ?? DEFAULT_LIMIT)));
  const skip = (page - 1) * limit;

  const sort = normalizeSort(opts.sort ?? "-updatedAt");
  const projection = opts.projection;
  const lean = opts.lean ?? true;

  const [items, total] = await Promise.all([
    Item.find(query, projection, { sort, skip, limit, lean } as QueryOptions).exec(),
    Item.countDocuments(query).exec(),
  ]);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function updateItemByItemId(
  _id: string,
  update: UpdateQuery<IItem>,
  opts: { upsert?: boolean; returnNew?: boolean } = {}
) {
  const { upsert = false, returnNew = true } = opts;
  // pre('findOneAndUpdate') hook in your schema will sync lastUpdated
  const doc = await Item.findOneAndUpdate(
    { _id },
    update,
    { upsert, new: returnNew, runValidators: true }
  ).exec();
  return doc;
}

export async function replaceItemByItemId(
  _id: string,
  replacement: Partial<IItem>
) {
  const doc = await Item.findOneAndReplace(
    { _id },
    replacement as any,
    { new: true, upsert: false, runValidators: true }
  ).exec();
  return doc;
}

export async function deleteItemByItemId(_id: string) {
  const res = await Item.deleteOne({ _id }).exec();
  return { deletedCount: res.deletedCount ?? 0 };
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSort(input: string) {
  // e.g., "-updatedAt,type" -> { updatedAt: -1, type: 1 }
  return input.split(",").reduce<Record<string, 1 | -1>>((acc, tokenRaw) => {
    const token = tokenRaw.trim();
    if (!token) return acc;
    if (token.startsWith("-")) acc[token.substring(1)] = -1;
    else acc[token] = 1;
    return acc;
  }, {});
}
