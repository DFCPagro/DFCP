import { api } from "./config";
import { z } from "zod";
import type { Item, ItemCategory, ItemsListResponse } from "@/types/items";

export const itemCategories: ItemCategory[] = ["fruit", "vegetable"];

export const itemFormSchema = z.object({
  category: z.enum(["fruit", "vegetable"], { required_error: "Category is required" }),
  type: z.string().min(1, "Type is required"),
  variety: z.string().trim().min(1, "Variety is required"),
  caloriesPer100g: z
    .preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().nonnegative().optional())
    .optional(),
  imageUrl: z
    .string()
    .url("Must be a valid URL (http/https)")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => undefined)),
  price: z
    .object({
      a: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()),
      b: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()),
      c: z.preprocess(numericOrNull, z.number().nonnegative().nullable().optional()),
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
  sort?: string;          // e.g. "-updatedAt,type"
  category?: ItemCategory;
  q?: string;             // searches type/variety
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
