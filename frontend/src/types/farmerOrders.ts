// src/types/farmerOrders.ts
import { z } from "zod";

/** Shared enums (single source of truth) */
export const ShiftEnum = z.enum(["morning", "afternoon", "evening", "night"]);
export type Shift = z.infer<typeof ShiftEnum>;

/** Optional: UI buckets (not used in the summary payload directly, but kept for app-wide consistency) */
export const FarmerOrderStatusEnum = z.enum(["pending", "ok", "problem"]);
export type FarmerOrderStatus = z.infer<typeof FarmerOrderStatusEnum>;

/** Strict local date "YYYY-MM-DD" */
export const IsoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export type IsoDateString = z.infer<typeof IsoDateString>;

/** One row of aggregated counts for a (date, shift) */
export const FarmerOrderSumSchema = z.object({
  /** "YYYY-MM-DD" local date */
  date: IsoDateString,
  shiftName: ShiftEnum,

  /** totals for this (date,shift) */
  count: z.number().int().min(0),
  problemCount: z.number().int().min(0),

  /** farmer orders grouped by their farmerStatus */
  okFO: z.number().int().min(0),
  pendingFO: z.number().int().min(0),
  problemFO: z.number().int().min(0),

  /** unique farmers by their top-level status within the period */
  okFarmers: z.number().int().min(0),
  pendingFarmers: z.number().int().min(0),
  problemFarmers: z.number().int().min(0),
});
export type FarmerOrderSum = z.infer<typeof FarmerOrderSumSchema>;

/** API shape: current + upcoming shifts summary for an LC in a TZ */
export const FarmerOrdersSummarySchema = z.object({
  current: FarmerOrderSumSchema,
  next: z.array(FarmerOrderSumSchema),
  tz: z.string(), // IANA timezone name, e.g. "Asia/Jerusalem"
  lc: z.string(), // logistics center ID used for the aggregation
});
export type FarmerOrdersSummary = z.infer<typeof FarmerOrdersSummarySchema>;

/* -------------------------------------------------------------------------- */
/* Aliases to match hook-friendly names (so hooks don’t need to change)       */
/* -------------------------------------------------------------------------- */

export type ShiftRollup = FarmerOrderSum;
export type FarmerOrdersSummaryResponse = FarmerOrdersSummary;

export interface FarmerOrderDTO {
  id: string;

  // item identity & labels (you said type/variety won’t be empty)
  itemId: string;
  type: string;
  variety: string;
  pictureUrl?: string | null;

  // status & quantities
  farmerStatus: FarmerOrderStatus;
  forcastedQuantityKg: number; // <-- exact name per your request
  finalQuantityKg?: number | null;

  // scheduling
  pickUpDate: string; // "YYYY-MM-DD" (local)
  shift: Shift;
}
