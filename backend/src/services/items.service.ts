import { FilterQuery, ProjectionType, QueryOptions, UpdateQuery, Types } from "mongoose";
import ItemModel, {
  itemCategories,
  type Item as ItemType,
  type ItemCategory,
} from "../models/Item.model";
import { getFarmerBioByUserId } from "./farmer.service";

// ───────────────────────────────────────────────────────────────────────────────
// Filters & options
// ───────────────────────────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────────────────────────
// Normalizers for the new model fields
// ───────────────────────────────────────────────────────────────────────────────
function normalizeTolerance(input: unknown): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  // Accept "±2%", "+/-2%", "0.02", "2%" etc., store as "0.02"
  const pctMatch = raw.match(/([+-]?\d+(\.\d+)?)\s*%/);
  if (pctMatch) {
     const val = Number(pctMatch[1]) / 100;
     return Number.isFinite(val) ? val.toString() : null;
  }
  const plusMinusMatch = raw.replace(/[±]|(\+\/-)/g, "").trim();
  const asNum = Number(plusMinusMatch);
  if (Number.isFinite(asNum)) {
    // If value seems like 0.x keep as-is, if looks like 2, treat as 2%
    return (asNum > 1 ? asNum / 100 : asNum).toString();
  }
  return null;
}

function normalizeSellModes(input: any) {
  const defaults = { byKg: true, byUnit: false, unitBundleSize: 1 };
  if (!input || typeof input !== "object") return defaults;
  return {
    byKg: typeof input.byKg === "boolean" ? input.byKg : true,
    byUnit: typeof input.byUnit === "boolean" ? input.byUnit : false,
    unitBundleSize: Number.isFinite(Number(input.unitBundleSize))
      ? Number(input.unitBundleSize)
      : 1,
  };
}

function normalizeImageUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed || null;
}

function normalizeWeights(payload: any) {
  const copy = { ...payload };

  // Legacy alias support at payload level (your schema hook also covers nested QS)
  if ((copy.avgWeightPerUnitGr == null) && (copy.weightPerUnitG != null)) {
    copy.avgWeightPerUnitGr = copy.weightPerUnitG;
  }

  // Default sdWeightPerUnitGr to 0 if supplied as null/undefined
  if (copy.sdWeightPerUnitGr == null) copy.sdWeightPerUnitGr = 0;

  return copy;
}

function normalizeBeforeWrite(payload: Partial<ItemType>): Partial<ItemType> {
  const p: any = { ...payload };

  // tolerance → "0.02" style string
  if ("tolerance" in p) {
    const t = normalizeTolerance(p.tolerance);
    if (t != null) p.tolerance = t;
    else if (p.tolerance == null) {/* keep null/undefined */} 
    else delete p.tolerance; // bad format → drop and let model default
  }

  // sellModes defaults
  if ("sellModes" in p || p.sellModes == null) {
    p.sellModes = normalizeSellModes(p.sellModes);
  }

  // imageUrl cleanup
  if ("imageUrl" in p) {
    p.imageUrl = normalizeImageUrl(p.imageUrl) as any;
  }

  // weight helpers
  Object.assign(p, normalizeWeights(p));

  // keep price as given (schema validates min >= 0)
  return p;
}

// ───────────────────────────────────────────────────────────────────────────────
// CRUD
// ───────────────────────────────────────────────────────────────────────────────
export async function createItem(payload: Partial<ItemType>): Promise<ItemType> {
  const normalized = normalizeBeforeWrite(payload);
  const doc = await ItemModel.create(normalized as any);
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

  // normalize only $set payload (don’t mutate other operators)
  const nextUpdate: UpdateQuery<ItemType> = { ...update };
  if ((nextUpdate as any).$set) {
    (nextUpdate as any).$set = normalizeBeforeWrite((nextUpdate as any).$set);
  }

  const doc = await ItemModel.findOneAndUpdate(
    { _id },
    nextUpdate,
    { upsert, new: returnNew, runValidators: true }
  ).exec();
  return doc;
}

export async function replaceItemByItemId(
  _id: string,
  replacement: Partial<ItemType>
) {
  if (!Types.ObjectId.isValid(_id)) return null;
  const normalized = normalizeBeforeWrite(replacement);
  const doc = await ItemModel.findOneAndReplace(
    { _id },
    { ...normalized, _id } as any,
    { new: true, upsert: false, runValidators: true }
  ).exec();
  return doc;
}

export async function deleteItemByItemId(_id: string) {
  if (!Types.ObjectId.isValid(_id)) return { deletedCount: 0 };
  const res = await ItemModel.deleteOne({ _id }).exec();
  return { deletedCount: res.deletedCount ?? 0 };
}

// ───────────────────────────────────────────────────────────────────────────────
// utils
// ───────────────────────────────────────────────────────────────────────────────
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

// ───────────────────────────────────────────────────────────────────────────────
// MARKET PAGE helpers (fixed field names)
// ───────────────────────────────────────────────────────────────────────────────
/*
FOR MARKET PAGE
*/
export type ItemBenefits = {
  customerInfo: string[];
  caloriesPer100g: number | null;
} | null;

export async function itemBenefits(_id: string): Promise<ItemBenefits> {
  if (!Types.ObjectId.isValid(_id)) return null;

  // FIX: select the correct field name "caloriesPer100g"
  const doc = await ItemModel.findById(_id)
    .select({ customerInfo: 1, caloriesPer100g: 1, _id: 0 })
    .lean();

  if (!doc) return null;

  const customerInfoArr = Array.isArray((doc as any).customerInfo)
    ? (doc as any).customerInfo.filter((s: unknown) => typeof s === "string")
    : [];

  return {
    customerInfo: customerInfoArr,
    caloriesPer100g:
      typeof (doc as any).caloriesPer100g === "number" ? (doc as any).caloriesPer100g : null,
  };
}

export type MarketItemPageResult = {
  item: { customerInfo: string[]; caloriesPer100g: number | null };
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
  console.log("farmerBio:", farmerInfo.farmerBio);
  return {
    item: {
      customerInfo: itemInfo.customerInfo,
      caloriesPer100g: itemInfo.caloriesPer100g,
    },
    farmer: {
      logo: farmerInfo.logo ?? null,
      farmName: farmerInfo.farmName,
      farmLogo: farmerInfo.farmLogo ?? null,
      farmerBio: farmerInfo.farmerBio ?? null,
    },
  };
}
