import { FilterQuery, ProjectionType, QueryOptions, UpdateQuery, Types } from "mongoose";
import ItemModel, {
  itemCategories,
  type Item as ItemType,
  type ItemCategory,
} from "../models/Item.model";
import { getFarmerBioByUserId } from "./farmer.service";

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
  const doc = await ItemModel.create(payload as any);
  return doc.toObject ? (doc.toObject() as ItemType) : (doc as unknown as ItemType);
}

export async function getItemByItemId(_id: string, projection?: ProjectionType<ItemType>) {
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
  const { category, type, variety, q, minCalories, maxCalories } = filters;

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

export type ItemBenefits = {
  customerInfo: string[];            
  caloriesPer100gr: number | null;
} | null;

export async function itemBenefits(_id: string): Promise<ItemBenefits> {
  if (!Types.ObjectId.isValid(_id)) return null;

  const doc = await ItemModel.findById(_id)
    .select({ customerInfo: 1, caloriesPer100gr: 1, _id: 0 })
    .lean();

  if (!doc) return null;

  const customerInfoArr =
    Array.isArray((doc as any).customerInfo)
      ? (doc as any).customerInfo.filter((s: unknown) => typeof s === "string")
      : [];

  return {
    customerInfo: customerInfoArr,
    caloriesPer100gr: typeof (doc as any).caloriesPer100gr === "number" ? (doc as any).caloriesPer100gr : null,
  };
}

export type MarketItemPageResult = {
  item: { customerInfo: string[]; caloriesPer100gr: number | null };  // <— array here
  farmer: { logo: string | null; farmName: string; farmLogo: string | null; farmerBio: string | null };
} | null;

/**
 * Returns both item benefits and farmer bio (by farmer's userId)
 */
export async function marketItemPageData(itemId: string, farmerUserId: string): Promise<MarketItemPageResult> {
  if (!Types.ObjectId.isValid(itemId) || !Types.ObjectId.isValid(farmerUserId)) return null;

  const [itemInfo, farmerInfo] = await Promise.all([
    itemBenefits(itemId),
    getFarmerBioByUserId(farmerUserId),
  ]);

  if (!itemInfo || !farmerInfo) return null;

  return {
    item: {
      customerInfo: itemInfo.customerInfo, // already string[]
      caloriesPer100gr: itemInfo.caloriesPer100gr,
    },
    farmer: {
      logo: farmerInfo.logo ?? null,
      farmName: farmerInfo.farmName,
      farmLogo: farmerInfo.farmLogo ?? null,
      farmerBio: farmerInfo.farmerBio ?? null,
    },
  };
}