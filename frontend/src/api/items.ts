// (same file where you had: import { api } from "./config";)
import { api } from "./config";
import { z } from "zod";
import type { Item, ItemCategory, ItemsListResponse } from "@/types/items";

export const itemCategories: ItemCategory[] = ["fruit", "vegetable"];

// ABC zod
const abcSchema = z
  .object({
    A: z.string().trim().optional().nullable(),
    B: z.string().trim().optional().nullable(),
    C: z.string().trim().optional().nullable(),
  })
  .partial()
  .optional();

export const itemFormSchema = z.object({
  category: z.enum(["fruit", "vegetable"], {
    required_error: "Category is required",
  }),
  type: z.string().min(1, "Type is required"),
  variety: z.string().trim().min(1, "Variety is required"),

  season: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),

  tolerance: z
    .string()
    .trim()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined)),

  caloriesPer100g: z
    .preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z.number().nonnegative().optional()
    )
    .optional(),

  imageUrl: z
    .string()
    .url("Must be a valid URL (http/https)")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined)),

  price: z
    .object({
      a: z.preprocess(
        numericOrNull,
        z.number().nonnegative().nullable().optional()
      ),
      b: z.preprocess(
        numericOrNull,
        z.number().nonnegative().nullable().optional()
      ),
      c: z.preprocess(
        numericOrNull,
        z.number().nonnegative().nullable().optional()
      ),
    })
    .partial()
    .optional(),

  qualityStandards: z
    .object({
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
    })
    .partial()
    .optional(),
});

function numericOrNull(v: any) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export type ListQuery = {
  page?: number;
  limit?: number;
  sort?: string; // e.g. "-updatedAt,type"
  category?: ItemCategory;
  q?: string; // searches type/variety
  minCalories?: number;
  maxCalories?: number;
};

// --- API calls ---
export async function listItems(params: ListQuery): Promise<ItemsListResponse> {
  const { data } = await api.get<ItemsListResponse>("/items", { params });
  return data;
}

export async function createItem(payload: ItemFormValues): Promise<Item> {
  const { data } = await api.post<Item>("/items", payload);
  return data;
}

export async function updateItemPartial(
  id: string,
  payload: Partial<ItemFormValues>
): Promise<Item> {
  const { data } = await api.patch<Item>(`/items/${id}`, payload);
  return data;
}

export async function replaceItem(
  id: string,
  payload: ItemFormValues
): Promise<Item> {
  const { data } = await api.put<Item>(`/items/${id}`, payload);
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  await api.delete<void>(`/items/${id}`);
}
