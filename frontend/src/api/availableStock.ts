// src/api/availableStock.ts
import { z } from "zod";
import { api } from "./config";
import type { Shift } from "@/types/farmerOrders";

export const InitAvailableStockInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  shiftName: z.enum(["morning", "afternoon", "evening", "night"]),
});
export type InitAvailableStockInput = z.infer<
  typeof InitAvailableStockInputSchema
>;

export const InitAvailableStockResultSchema = z.object({
  amsId: z.string().min(1),
});
export type InitAvailableStockResult = z.infer<
  typeof InitAvailableStockResultSchema
>;

/**
 * Initialize available stock (AMS) for a (date, shift).
 * Backend infers the logistics center from the JWT.
 * POST /available-stock/init  { date, shiftName }
 */
export async function initAvailableStock(input: {
  date: string;
  shiftName: Shift;
}): Promise<InitAvailableStockResult> {
  const payload = InitAvailableStockInputSchema.parse(input);
  const { data } = await api.post("/available-stock/init", payload);
  // Support { data: {...} } or bare payload:
  const body = data?.data ?? data;
  return InitAvailableStockResultSchema.parse(body);
}
