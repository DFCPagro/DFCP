import { api } from "./config";
import { z } from "zod";
import type { Item, ItemCategory, ItemsListResponse } from "@/types/items";

export const itemCategories: ItemCategory[] = ["fruit", "vegetable", "egg_dairy", "other"];

const abcSchema = z
  .object({
    A: z.string().trim().optional().nullable(),
    B: z.string().trim().optional().nullable(),
    C: z.string().trim().optional().nullable(),
  })
  .partial()
  .optional();

/* ---------- QS schemas ---------- */
const QualityStandardsProduceZ = z.object({
  brix: abcSchema,
  acidityPercentage: abcSchema,
  pressure: abcSchema,
  colorDescription: abcSchema,
  colorPercentage: abcSchema,
  weightPerUnit: abcSchema,
  weightPerUnitG: abcSchema,
  diameterMM: abcSchema,
  qualityGrade: abcSchema,
  maxDefectRatioLengthDiameter: abcSchema,
  rejectionRate: abcSchema,
}).partial().optional();

const QualityStandardsEggDairyZ = z.object({
  freshnessDays: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()),
  grade: z.enum(["A","B","C"]).nullable().optional(),
  fatPercentage: z.preprocess(numericOrNull, z.number().min(0).max(100).nullable().optional()),
}).partial().optional();

/* ---------- Packing ---------- */
export const PackingInfoZ = z.object({
  bulkDensityKgPerL: z.preprocess(numericOrNull, z.number().positive().nullable().optional()),
  litersPerKg: z.preprocess(numericOrNull, z.number().positive().nullable().optional()),
  fragility: z.enum(["very_fragile","fragile","normal","sturdy"]).nullable().optional(),
  allowMixing: z.boolean().optional(),
  requiresVentedBox: z.boolean().optional(),
  minBoxType: z.string().trim().nullable().optional(),
  maxWeightPerBoxKg: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()),
  notes: z.string().trim().nullable().optional(),
}).transform((v) => {
  const out = { ...v };
  if (out.bulkDensityKgPerL && !out.litersPerKg) out.litersPerKg = Number((1 / out.bulkDensityKgPerL).toFixed(3));
  if (out.litersPerKg && !out.bulkDensityKgPerL) out.bulkDensityKgPerL = Number((1 / out.litersPerKg).toFixed(3));
  const empty = Object.values(out).every(x => x == null || x === "" || x === false);
  return (empty ? undefined : out) as typeof out | undefined;
});

/* ---------- Sell modes ---------- */
const SellModesZ = z.object({
  byKg: z.boolean().optional(),                  // default true (backend enforces)
  byUnit: z.boolean().optional(),                // default false
  unitBundleSize: z.preprocess(numericOrNull, z.number().int().min(1).optional()), // default 1
}).partial().optional();

/* ---------- Base schema (no transform!) ---------- */
const itemFormBase = z.object({
  category: z.enum(["fruit","vegetable","egg_dairy","other"], { required_error: "Category is required" }),
  type: z.string().min(1, "Type is required"),
  variety: z.string().trim().min(1, "Variety is required"),

  season: z.string().trim().optional().transform(v => v === "" ? undefined : v),

  tolerance: z.string().trim().optional().nullable()
    .or(z.literal("").transform(() => undefined)),

  caloriesPer100g: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().nonnegative().optional()
  ).optional(),

  imageUrl: z.string().url("Must be a valid URL (http/https)").optional().nullable()
    .or(z.literal("").transform(() => undefined)),

  price: z.object({
    a: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()),
    b: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()),
    c: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()),
  }).partial().optional(),

  pricePerUnitOverride: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()).optional(),

  qualityStandards: QualityStandardsProduceZ,
  qualityStandardsEggDairy: QualityStandardsEggDairyZ,

  packing: PackingInfoZ.optional(),

  sellModes: SellModesZ,   // << add to form
});

/* ---------- Final schema with category rules + transform ---------- */
const REQUIRE_EGG_UNIT_PRICE = true;

export const itemFormSchema = itemFormBase
  .superRefine((val, ctx) => {
    // Enforce QS by category
    if (val.category === "egg_dairy") {
      if (val.qualityStandards && hasAnyABCRow(val.qualityStandards)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["qualityStandards"], message: "Use egg/dairy QS for this category." });
      }
      if (REQUIRE_EGG_UNIT_PRICE && (val.pricePerUnitOverride == null || val.pricePerUnitOverride <= 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pricePerUnitOverride"], message: "Egg/Dairy requires a per-unit price." });
      }
      // Optional: sellModes guard for egg/dairy
      if (val.sellModes?.byKg === true) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sellModes","byKg"], message: "Egg/Dairy cannot be sold by kg." });
      }
    } else {
      if (val.qualityStandardsEggDairy && hasAnyEggRow(val.qualityStandardsEggDairy)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["qualityStandardsEggDairy"], message: "Egg/Dairy QS only allowed for egg_dairy." });
      }
    }
  })
  .transform((val) => normalizeItemPayload(val));

/* ---------- helpers ---------- */
function numericOrNull(v: any) {
  if (v === "" || v == null) return null;
  const n = Number(typeof v === "string" ? v.replace(/\s/g, "").replace(",", ".") : v);
  return Number.isFinite(n) ? n : v;
}

function hasAnyABCRow(qs?: unknown) {
  if (!qs || typeof qs !== "object") return false;
  for (const row of Object.values(qs as Record<string, any>)) {
    if (row && (row.A || row.B || row.C)) return true;
  }
  return false;
}
function hasAnyEggRow(qs?: { freshnessDays?: any; grade?: any; fatPercentage?: any }) {
  if (!qs) return false;
  return qs.freshnessDays != null || qs.grade != null || qs.fatPercentage != null;
}

/** No generics here → avoids circular type constraint */
function normalizeItemPayload(v: z.infer<typeof itemFormBase>) {
  const out: any = { ...v };

  if (out.category === "egg_dairy") {
    out.qualityStandards = undefined;
    if (out.price) out.price = { a: null, b: null, c: null };

    // normalize sellModes: byUnit true, byKg false, default bundle 12
    out.sellModes = {
      ...(out.sellModes ?? {}),
      byKg: false,
      byUnit: true,
      unitBundleSize: Math.max(1, out.sellModes?.unitBundleSize ?? 12),
    };
  } else {
    out.qualityStandardsEggDairy = undefined;
    // ensure at least one sell mode (defaults)
    const byKg = out.sellModes?.byKg !== false;
    const byUnit = !!out.sellModes?.byUnit;
    if (!byKg && !byUnit) {
      out.sellModes = { ...(out.sellModes ?? {}), byKg: true, byUnit: false, unitBundleSize: Math.max(1, out.sellModes?.unitBundleSize ?? 1) };
    } else if (byUnit) {
      out.sellModes = { ...(out.sellModes ?? {}), unitBundleSize: Math.max(1, out.sellModes?.unitBundleSize ?? 1) };
    }
  }
  return out;
}

/* ---------- types/export ---------- */
export type ItemFormValues = z.infer<typeof itemFormSchema>;

export type ListQuery = {
  page?: number;
  limit?: number;
  sort?: string;
  category?: ItemCategory;
  q?: string;
  minCalories?: number;
  maxCalories?: number;
};

/* ---------- API ---------- */
export async function listItems(params: ListQuery): Promise<ItemsListResponse> {
  const { data } = await api.get<ItemsListResponse>("/items", { params });
  return data;
}
export async function createItem(payload: ItemFormValues): Promise<Item> {
  const { data } = await api.post<Item>("/items", payload);
  return data;
}
export async function updateItemPartial(id: string, payload: Partial<ItemFormValues>): Promise<Item> {
  const { data } = await api.patch<Item>(`/items/${id}`, payload);
  return data;
}
export async function replaceItem(id: string, payload: ItemFormValues): Promise<Item> {
  const { data } = await api.put<Item>(`/items/${id}`, payload);
  return data;
}
export async function deleteItem(id: string): Promise<void> {
  await api.delete<void>(`/items/${id}`);
}



const ItemCatalogEntrySchema = z.object({
  _id: z.string(),
  category: z.string(),
  type: z.string(),
  variety: z.string().optional(),
  imageUrl: z.string().url().optional(),
});
export const ItemCatalogResponseSchema = z.object({
  data: z.array(ItemCatalogEntrySchema),
});
export type ItemCatalogEntry = z.infer<typeof ItemCatalogEntrySchema>;

export async function getItemsCatalog(): Promise<ItemCatalogEntry[]> {
  const { data } = await api.get("/items/public"); // 👈 adjust path if different
  return ItemCatalogResponseSchema.parse(data).data;
}
