import { FilterQuery, ProjectionType, QueryOptions, UpdateQuery, Types } from "mongoose";
import ItemModel, {
  itemCategories,
  type Item as ItemType,
  type ItemCategory,
} from "../models/Item.model";

export type ListItemsFilters = {
  category?: ItemCategory;
  type?: string;
  variety?: string;
  q?: string;
  minCalories?: number;
  maxCalories?: number;
};

export type ListItemsOptions = {
  page?: number;
  limit?: number;
  sort?: string;
  projection?: ProjectionType<ItemType>;
  lean?: boolean;
};

const DEFAULT_LIMIT = 20;

export async function createItem(payload: Partial<ItemType>): Promise<ItemType> {
  // _id will be auto-generated (ObjectId)
  const doc = await ItemModel.create(payload as any);
  return doc.toObject ? (doc.toObject() as ItemType) : (doc as unknown as ItemType);
}

export async function getItemByItemId(_id: string, projection?: ProjectionType<ItemType>) {
  // Let Mongoose cast valid hex strings to ObjectId; return null for invalid to avoid CastError
  if (!Types.ObjectId.isValid(_id)) return null;
  return ItemModel.findById(_id, projection).exec();
}

export async function getItemByMongoId(id: string, projection?: ProjectionType<ItemType>) {
  if (!Types.ObjectId.isValid(id)) return null;
  return ItemModel.findById(id, projection).exec();
}

export async function listItems(
  filters: ListItemsFilters = {},
  opts: ListItemsOptions = {}
) {
  const {
    category, type, variety, q, minCalories, maxCalories,
  } = filters;

  const query: FilterQuery<ItemType> = {};

  if (category) query.category = category;
  if (type) query.type = new RegExp(`^${escapeRegex(type)}$`, "i");
  if (variety) query.variety = new RegExp(`^${escapeRegex(variety)}$`, "i");

  if (q) {
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
    ItemModel.find(query, projection, { sort, skip, limit, lean } as QueryOptions).exec(),
    ItemModel.countDocuments(query).exec(),
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
  update: UpdateQuery<ItemType>,
  opts: { upsert?: boolean; returnNew?: boolean } = {}
) {
  if (!Types.ObjectId.isValid(_id)) return null;
  const { upsert = false, returnNew = true } = opts;
  const doc = await ItemModel.findOneAndUpdate(
    { _id },
    update,
    { upsert, new: returnNew, runValidators: true }
  ).exec();
  return doc;
}

export async function replaceItemByItemId(
  _id: string,
  replacement: Partial<ItemType>
) {
  if (!Types.ObjectId.isValid(_id)) return null;
  const doc = await ItemModel.findOneAndReplace(
    { _id },
    // ensure client-sent _id (if any) doesn't conflict
    { ...replacement, _id } as any,
    { new: true, upsert: false, runValidators: true }
  ).exec();
  return doc;
}

export async function deleteItemByItemId(_id: string) {
  if (!Types.ObjectId.isValid(_id)) return { deletedCount: 0 };
  const res = await ItemModel.deleteOne({ _id }).exec();
  return { deletedCount: res.deletedCount ?? 0 };
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSort(input: string) {
  return input.split(",").reduce<Record<string, 1 | -1>>((acc, tokenRaw) => {
    const token = tokenRaw.trim();
    if (!token) return acc;
    if (token.startsWith("-")) acc[token.substring(1)] = -1;
    else acc[token] = 1;
    return acc;
  }, {});
}
