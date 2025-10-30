import mongoose, {
  FilterQuery,
  ProjectionType,
  QueryOptions,
  UpdateQuery,
  Types,
} from "mongoose";
import ApiError from "../utils/ApiError";
import ItemModel, {
  itemCategories,
  type Item as ItemType,
  type ItemCategory,
  PUBLIC_ITEM_PROJECTION,
  Item,
} from "../models/Item.model";
import { getFarmerBioByUserId } from "./farmer.service";
import * as packingSvc from "./ItemPacking.service";
import { validatePackingInput } from "../validations/items.validation";
import ItemPacking from "@/models/ItemPacking";

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
// DEMAND → KG helper
// ───────────────────────────────────────────────────────────────────────────────
export type DemandInput =
  | { qtyKg: number; qtyUnits?: never }
  | { qtyKg?: never; qtyUnits: number };

export type DemandResolution = {
  mode: "kg" | "unit";
  requiredKg: number; // kg needed to fulfill request
  qtyKg?: number | null; // echo if user sent kg
  qtyUnits?: number | null; // echo if user sent units (pre-rounding)
  roundedUnits?: number | null; // rounded to bundle multiple when byUnit
  unitBundleSize?: number | null; // from item
  notes: string[]; // e.g., "rounded to bundle multiple"
};

// ───────────────────────────────────────────────────────────────────────────────
// Normalizers / Validators
// ───────────────────────────────────────────────────────────────────────────────
function normalizeTolerance(input: unknown): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  const pctMatch = raw.match(/([+-]?\d+(\.\d+)?)\s*%/);
  if (pctMatch) {
    const val = Number(pctMatch[1]) / 100;
    return Number.isFinite(val) ? val.toString() : null;
  }
  const plusMinusMatch = raw.replace(/[±]|(\+\/-)/g, "").trim();
  const asNum = Number(plusMinusMatch);
  if (Number.isFinite(asNum)) {
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
  if (copy.avgWeightPerUnitGr == null && copy.weightPerUnitG != null) {
    copy.avgWeightPerUnitGr = copy.weightPerUnitG;
  }
  if (copy.sdWeightPerUnitGr == null) copy.sdWeightPerUnitGr = 0;
  return copy;
}

function normalizeBeforeWrite(payload: Partial<ItemType>): Partial<ItemType> {
  const p: any = { ...payload };

  // tolerance → "0.02"
  if ("tolerance" in p) {
    const t = normalizeTolerance(p.tolerance);
    if (t != null) p.tolerance = t;
    else if (p.tolerance == null) {
      /* keep null/undefined */
    } else delete p.tolerance;
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

  // egg/dairy: UNIT-ONLY; clear KG prices
  if (p.category === "egg_dairy") {
    p.sellModes = {
      ...(p.sellModes || {}),
      byKg: false,
      byUnit: true,
      unitBundleSize: Math.max(1, Number(p.sellModes?.unitBundleSize ?? 12)),
    };
    if (p.price && typeof p.price === "object") {
      p.price = { a: null, b: null, c: null } as any;
    }
  }

  return p;
}

/** Merge existing + patch to get effective state for validation. */
function mergeEffective(
  existing: Partial<ItemType> | null,
  patch: Partial<ItemType>
): Partial<ItemType> {
  const base = existing ? { ...existing } : {};
  const next = { ...base, ...patch };
  if (patch.sellModes)
    next.sellModes = { ...(base as any).sellModes, ...patch.sellModes } as any;
  if (patch.price)
    next.price = { ...(base as any).price, ...patch.price } as any;
  return next;
}

/** Validate business rules; throw ApiError(400, "ValidationError: …") */
function validateItemBusinessRules(effective: Partial<ItemType>) {
  const issues: string[] = [];

  const category = effective.category as ItemCategory | undefined;
  const sell = (effective as any).sellModes || {};
  const byKg = sell.byKg !== false; // default true for non-eggs
  const byUnit = !!sell.byUnit;
  const unitBundleSize = Number(sell.unitBundleSize ?? 1);

  if (category && !itemCategories.includes(category)) {
    issues.push(`invalid category: ${category}`);
  }

  if (category === "egg_dairy") {
    if (byKg)
      issues.push(
        "egg_dairy items cannot be sold by KG (sellModes.byKg must be false)"
      );
    if (!byUnit)
      issues.push(
        "egg_dairy items must be sold by UNIT (sellModes.byUnit must be true)"
      );
    if (
      Number.isFinite((effective as any).price?.a) &&
      (effective as any).price?.a != null
    ) {
      issues.push(
        "egg_dairy items cannot set price.a (per KG) — use pricePerUnitOverride"
      );
    }
    if ((effective as any).pricePerUnitOverride == null) {
      issues.push(
        "egg_dairy items require pricePerUnitOverride (price per single unit)"
      );
    }
  } else {
    if (!byKg && !byUnit) {
      issues.push("at least one sell mode must be true (byKg or byUnit)");
    }
    if (byKg && (effective as any).price?.a == null) {
      issues.push("byKg=true requires price.a (price per KG)");
    }
    if (
      byUnit &&
      (effective as any).pricePerUnitOverride == null &&
      (effective as any).avgWeightPerUnitGr == null
    ) {
      issues.push(
        "byUnit=true requires either pricePerUnitOverride OR avgWeightPerUnitGr"
      );
    }
  }

  if (byUnit && (!Number.isFinite(unitBundleSize) || unitBundleSize < 1)) {
    issues.push(
      "sellModes.unitBundleSize must be a number >= 1 when byUnit=true"
    );
  }

  if (issues.length) {
    throw new ApiError(400, `ValidationError: ${issues.join("; ")}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// CREATE (Item + ItemPacking in one transaction)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Accepts a single payload that includes both item fields and a `packing` object.
 * Example body:
 * {
 *   category, type, variety, ...,
 *   packing: { bulkDensityKgPerL, litersPerKg, fragility, allowMixing, requiresVentedBox, minBoxType, ... }
 * }
 */
export type CreateItemWithPackingBody = Partial<ItemType> & {
  packing: {
    bulkDensityKgPerL: number;
    litersPerKg: number;
    fragility: "very_fragile" | "fragile" | "normal" | "sturdy";
    allowMixing: boolean;
    requiresVentedBox: boolean;
    minBoxType: string;
    maxWeightPerBoxKg?: number;
    notes?: string | null;
  };
};

export async function createItemWithPacking(body: CreateItemWithPackingBody) {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "ValidationError: Body must be an object");
  }

  const { packing, ...itemPayload } = body as CreateItemWithPackingBody;
  if (!packing || typeof packing !== "object") {
    throw new ApiError(
      400,
      "ValidationError: 'packing' is required and must be an object"
    );
  }

  // 1) validate item + packing
  const normalized = normalizeBeforeWrite(itemPayload);
  validateItemBusinessRules(normalized);

  const packingIssues = validatePackingInput(packing);
  if (packingIssues.length) {
    throw new ApiError(400, `ValidationError: ${packingIssues.join("; ")}`);
  }

  // 2) transaction
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // 2a) create item
    const [itemDoc] = await ItemModel.create([normalized as any], { session });

    // 2b) (optional but recommended) prevent duplicate packing for this item across docs
    const existing = await mongoose
      .model("ItemPacking")
      .findOne({ "items.itemId": itemDoc._id })
      .session(session)
      .lean();
    if (existing) {
      throw new ApiError(409, "Packing already exists for this item");
    }

    // 2c) create packing via the PACKING SERVICE (reused!)
    const { notes, ...rest } = packing;
    const packingDoc = await packingSvc.create(
      {
        items: [
          {
            itemId: itemDoc._id,
            packing: {
              ...rest,
              ...(notes == null ? {} : { notes }), // only include when it's a string
            },
          },
        ],
      },
      { session }
    );

    await session.commitTransaction();

    // Return both so the controller has everything
    return {
      item: itemDoc.toObject ? itemDoc.toObject() : (itemDoc as any),
      packing: packingDoc, // packingSvc.create returns toJSON()
    };
  } catch (err: any) {
    await session.abortTransaction();

    if (err?.name === "ValidationError") {
      const details = Object.values(err.errors || {})
        .map((e: any) => e?.message)
        .filter(Boolean);
      throw new ApiError(
        400,
        details.length
          ? `ValidationError: ${details.join("; ")}`
          : "ValidationError: invalid payload"
      );
    }
    throw err;
  } finally {
    session.endSession(); // single place to end the session
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// CRUD (rest) — unchanged except for business-rule validation on write paths
// ───────────────────────────────────────────────────────────────────────────────

export async function getItemByItemId(
  _id: string,
  projection?: ProjectionType<ItemType>
) {
  if (!Types.ObjectId.isValid(_id)) return null;
  return ItemModel.findById(_id, projection).exec();
}

export async function getItemByMongoId(
  id: string,
  projection?: ProjectionType<ItemType>
) {
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
    ItemModel.find(query, projection, {
      sort,
      skip,
      limit,
      lean,
    } as QueryOptions).exec(),
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

// ───────────────────────────────────────────────────────────────────────────────
// Items + Packing join (privileged views)
// ───────────────────────────────────────────────────────────────────────────────

export async function listItemsWithPacking(
  filters: ListItemsFilters = {},
  opts: ListItemsOptions = {}
) {
  const { category, type, variety, q, minCalories, maxCalories } = filters;

  const match: any = {};
  if (category) match.category = category;
  if (type) match.type = new RegExp(`^${escapeRegex(type)}$`, "i");
  if (variety) match.variety = new RegExp(`^${escapeRegex(variety)}$`, "i");

  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    match.$or = [{ type: re }, { variety: re }];
  }

  if (minCalories != null || maxCalories != null) {
    match.caloriesPer100g = {};
    if (minCalories != null) match.caloriesPer100g.$gte = minCalories;
    if (maxCalories != null) match.caloriesPer100g.$lte = maxCalories;
  }

  const page = Math.max(1, Number(opts.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(opts.limit ?? DEFAULT_LIMIT)));
  const skip = (page - 1) * limit;

  const sortObj = normalizeSort(opts.sort ?? "-updatedAt");

  // We aggregate from Items and attach the matching packing subdocument for *this* item
  const pipeline: any[] = [
    { $match: match },
    { $sort: sortObj },
    {
      $lookup: {
        from: ItemPacking.collection.name, // collection backing the ItemPacking model
        let: { itemId: "$_id" },
        pipeline: [
          { $unwind: "$items" },
          { $match: { $expr: { $eq: ["$items.itemId", "$$itemId"] } } },
          { $project: { _id: 0, packing: "$items.packing" } },
        ],
        as: "packingMatches",
      },
    },
    // take first match (there should be at most one)
    { $addFields: { packing: { $first: "$packingMatches.packing" } } },
    { $project: { packingMatches: 0 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const countPipeline: any[] = [{ $match: match }, { $count: "total" }];

  const [items, countRes] = await Promise.all([
    ItemModel.aggregate(pipeline).exec(),
    ItemModel.aggregate(countPipeline).exec(),
  ]);

  const total = countRes?.[0]?.total ?? 0;
  return {
    items, // each item now has a `packing` field (or undefined if none)
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function getItemWithPackingById(_id: string) {
  if (!Types.ObjectId.isValid(_id)) return null;

  const res = await ItemModel.aggregate([
    { $match: { _id: new Types.ObjectId(_id) } },
    {
      $lookup: {
        from: ItemPacking.collection.name,
        let: { itemId: "$_id" },
        pipeline: [
          { $unwind: "$items" },
          { $match: { $expr: { $eq: ["$items.itemId", "$$itemId"] } } },
          { $project: { _id: 0, packing: "$items.packing" } },
        ],
        as: "packingMatches",
      },
    },
    { $addFields: { packing: { $first: "$packingMatches.packing" } } },
    { $project: { packingMatches: 0 } },
  ]).exec();

  return res?.[0] ?? null;
}

export async function updateItemByItemId(
  _id: string,
  update: UpdateQuery<ItemType>,
  opts: { upsert?: boolean; returnNew?: boolean } = {}
) {
  if (!Types.ObjectId.isValid(_id)) return null;
  const { upsert = false, returnNew = true } = opts;

  // normalize only $set payload
  const nextUpdate: UpdateQuery<ItemType> = { ...update };
  if ((nextUpdate as any).$set) {
    (nextUpdate as any).$set = normalizeBeforeWrite((nextUpdate as any).$set);
  }

  // validate effective result (existing + $set)
  const existing = await ItemModel.findById(_id).lean<ItemType>().exec();
  if (!existing) return null;
  const setPayload = ((nextUpdate as any).$set ?? {}) as Partial<ItemType>;
  const effective = mergeEffective(existing, setPayload);
  validateItemBusinessRules(effective);

  const doc = await ItemModel.findOneAndUpdate({ _id }, nextUpdate, {
    upsert,
    new: returnNew,
    runValidators: true,
  }).exec();
  return doc;
}

export async function replaceItemByItemId(
  _id: string,
  replacement: Partial<ItemType>
) {
  if (!Types.ObjectId.isValid(_id)) return null;
  const normalized = normalizeBeforeWrite(replacement);
  validateItemBusinessRules(normalized);
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
// MARKET PAGE helpers
// ───────────────────────────────────────────────────────────────────────────────
export type ItemBenefits = {
  customerInfo: string[];
  caloriesPer100g: number | null;
} | null;

export async function itemBenefits(_id: string): Promise<ItemBenefits> {
  if (!Types.ObjectId.isValid(_id)) return null;

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
      typeof (doc as any).caloriesPer100g === "number"
        ? (doc as any).caloriesPer100g
        : null,
  };
}

export type MarketItemPageResult = {
  item: { customerInfo: string[]; caloriesPer100g: number | null };
  farmer: {
    logo: string | null;
    farmName: string;
    farmLogo: string | null;
    farmerBio: string | null;
  };
} | null;

export async function marketItemPageData(
  itemId: string,
  farmerUserId: string
): Promise<MarketItemPageResult> {
  if (!Types.ObjectId.isValid(itemId) || !Types.ObjectId.isValid(farmerUserId))
    return null;

  const [itemInfo, farmerInfo] = await Promise.all([
    itemBenefits(itemId),
    getFarmerBioByUserId(farmerUserId),
  ]);

  if (!itemInfo || !farmerInfo) return null;

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

// ───────────────────────────────────────────────────────────────────────────────
// general items list
// ───────────────────────────────────────────────────────────────────────────────
export async function getAllPublicItems(params?: { category?: string }) {
  const query: Record<string, any> = {};

  // optional filter by category (must be one of itemCategories)
  if (params?.category) {
    query.category = params.category;
  }

  const docs = await Item.find(query, PUBLIC_ITEM_PROJECTION)
    .sort({ category: 1, type: 1, variety: 1 })
    .lean();

  // normalize nulls consistently for frontend
  return docs.map((doc) => ({
    _id: doc._id,
    category: doc.category,
    type: doc.type,
    variety: doc.variety ?? null,
    imageUrl: doc.imageUrl ?? null,
  }));
}
export async function resolveDemandToKgForItem(
  itemId: string,
  demand: DemandInput
): Promise<DemandResolution> {
  if (!Types.ObjectId.isValid(itemId)) {
    throw new ApiError(400, "Invalid itemId");
  }
  if (!demand || typeof demand !== "object") {
    throw new ApiError(400, "Demand is required");
  }

  const item = await ItemModel.findById(itemId)
    .select({
      category: 1,
      sellModes: 1,
      avgWeightPerUnitGr: 1,
      "qualityStandards.weightPerUnit": 1,
      pricePerUnitOverride: 1,
      "sellModes.unitBundleSize": 1,
    })
    .lean();

  if (!item) throw new ApiError(404, "Item not found");

  const byKg = item.sellModes?.byKg !== false; // default true
  const byUnit = !!item.sellModes?.byUnit; // default false
  const bundle = Math.max(1, Number(item.sellModes?.unitBundleSize ?? 1));

  // EXACTLY one of qtyKg / qtyUnits must be provided
  const hasKg = (demand as any).qtyKg != null;
  const hasUnits = (demand as any).qtyUnits != null;
  if (hasKg === hasUnits) {
    throw new ApiError(400, "Provide exactly one of qtyKg or qtyUnits");
  }

  // KG path
  if (hasKg) {
    const qtyKg = Number((demand as any).qtyKg);
    if (!Number.isFinite(qtyKg) || qtyKg <= 0) {
      throw new ApiError(400, "qtyKg must be a positive number");
    }
    if (!byKg) {
      throw new ApiError(400, "This item cannot be sold by KG");
    }
    return {
      mode: "kg",
      requiredKg: qtyKg,
      qtyKg,
      qtyUnits: null,
      roundedUnits: null,
      unitBundleSize: null,
      notes: [],
    };
  }

  // UNIT path
  const qtyUnitsRaw = Number((demand as any).qtyUnits);
  if (!Number.isFinite(qtyUnitsRaw) || qtyUnitsRaw <= 0) {
    throw new ApiError(400, "qtyUnits must be a positive number");
  }
  if (!byUnit) {
    throw new ApiError(400, "This item cannot be sold by UNIT");
  }
  // round to bundle multiple
  const roundedUnits = Math.ceil(qtyUnitsRaw / bundle) * bundle;
  const notes: string[] = [];
  if (roundedUnits !== qtyUnitsRaw) {
    notes.push(
      `Rounded ${qtyUnitsRaw} units to bundle multiple ${roundedUnits} (bundle=${bundle}).`
    );
  }

  // derive avg grams per unit
  let gramsPerUnit =
    typeof item.avgWeightPerUnitGr === "number" && item.avgWeightPerUnitGr > 0
      ? item.avgWeightPerUnitGr
      : null;

  // optional fallback from QS if you store it there
  const qsGrams = (item as any)?.qualityStandards?.weightPerUnit as
    | number
    | undefined;
  if (!gramsPerUnit && typeof qsGrams === "number" && qsGrams > 0) {
    gramsPerUnit = qsGrams;
    notes.push(
      "Used qualityStandards.weightPerUnit as fallback for unit weight."
    );
  }

  if (!gramsPerUnit) {
    throw new ApiError(
      400,
      "Cannot convert units to kg: avgWeightPerUnitGr is missing (and no QS fallback)."
    );
  }

  const requiredKg = (roundedUnits * gramsPerUnit) / 1000;

  return {
    mode: "unit",
    requiredKg,
    qtyKg: null,
    qtyUnits: qtyUnitsRaw,
    roundedUnits,
    unitBundleSize: bundle,
    notes,
  };
}
