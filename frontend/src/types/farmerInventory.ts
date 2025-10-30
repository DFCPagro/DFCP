// src/types/demand.ts
import { z } from "zod";

/* -----------------------------------------------------------------------------
 * Farmer Inventory (as you provided)
 * -------------------------------------------------------------------------- */

export const FarmerInventoryItemSchema = z.object({
  _id: z.string(), // inventory row id
  farmerUserId: z.string(), // show ID for now (no name lookup)
  farmLogo: z.string().optional().nullable(),
  farmName: z.string().optional().nullable(),
  farmerName: z.string().optional().nullable(),
  itemId: z.string(),
  logisticCenterId: z.string(),
  agreementAmountKg: z.number().nonnegative(),
  currentAvailableAmountKg: z.number().nonnegative(),
  createdAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid ISO timestamp",
  }), // ISO timestamp
  updatedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid ISO timestamp",
  }), // ISO timestamp (used as "last updated")
  // NOTE: "forecasted" is intentionally ignored for now per product decision.
});
export type FarmerInventoryItem = z.infer<typeof FarmerInventoryItemSchema>;

export const FarmerInventoryResponseSchema = z.object({
  data: z.array(FarmerInventoryItemSchema),
});
export type FarmerInventoryResponse = z.infer<
  typeof FarmerInventoryResponseSchema
>;

/* -----------------------------------------------------------------------------
 * Demand Statistics
 * Sample:
 * {
 *   "items": [
 *     { "slotKey": "monday-afternoon", "items": [ { itemId, itemDisplayName, averageDemandQuantityKg } ] },
 *     { "slotKey": "monday-night", "items": [] }
 *   ],
 *   "page": 1, "limit": 20, "total": 2, "pages": 1
 * }
 * -------------------------------------------------------------------------- */

// NOTE: fixed the name to DemandStatistics (was DemandStatics)
export const DemandStatisticsItemSchema = z.object({
  itemId: z.string(),
  itemDisplayName: z.string(),
  averageDemandQuantityKg: z.number().nonnegative(),
  category: z.string().optional(),
  type: z.string().optional(),
  variety: z.string().optional(),
  imageUrl: z.string().url().optional(),
});
export type DemandStatisticsItem = z.infer<typeof DemandStatisticsItemSchema>;

export const DemandStatisticsSlotSchema = z.object({
  slotKey: z.string(), // e.g., "monday-afternoon"
  items: z.array(DemandStatisticsItemSchema),
});
export type DemandStatisticsSlot = z.infer<typeof DemandStatisticsSlotSchema>;

export const DemandStatisticsResponseSchema = z.object({
  items: z.array(DemandStatisticsSlotSchema),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  pages: z.number().int().min(0),
});
export type DemandStatisticsResponse = z.infer<
  typeof DemandStatisticsResponseSchema
>;

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

/* -----------------------------------------------------------------------------
 * Optional helpers
 * -------------------------------------------------------------------------- */

/** Parse & validate a demand statistics payload (throws ZodError on failure). */
export function parseDemandStatisticsResponse(
  input: unknown
): DemandStatisticsResponse {
  return DemandStatisticsResponseSchema.parse(input);
}

/** Safe parse variant (no throw). */
export function safeDemandStatisticsResponse(
  input: unknown
): z.SafeParseReturnType<unknown, DemandStatisticsResponse> {
  return DemandStatisticsResponseSchema.safeParse(input);
}

/* -----------------------------------------------------------------------------
 * TODOs
 * - If your API ever adds more shifts (e.g., "late-night"), update ShiftEnum and SlotKeySchema.
 * - If the backend changes pagination keys, mirror that here to keep types in sync.
 * - If you want to allow partial weekdays (e.g., locale-based), refactor WeekdayEnum accordingly.
 * -------------------------------------------------------------------------- */
