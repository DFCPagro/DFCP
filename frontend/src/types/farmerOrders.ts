// src/types/farmerOrders.ts
import { z } from "zod";

/** Shared enums (single source of truth) */
export const ShiftEnum = z.enum(["morning", "afternoon", "evening", "night"]);
export type Shift = z.infer<typeof ShiftEnum>;

export const FarmerOrderStatusEnum = z.enum(["pending", "ok", "problem"]);
export type FarmerOrderStatus = z.infer<typeof FarmerOrderStatusEnum>;

/** One row of aggregated counts for a (date, shift) */
export const FarmerOrderSumSchema = z.object({
  /** "YYYY-MM-DD" local date */
  date: z.string().max(10),
  shiftName: ShiftEnum,
  count: z.number().min(0),
  problemCount: z.number().min(0),

  /** farmer orders grouped by their farmerStatus */
  okFO: z.number().min(0),
  pendingFO: z.number().min(0),
  problemFO: z.number().min(0),

  /** unique farmers by their top-level status within the period */
  okFarmers: z.number().min(0),
  pendingFarmers: z.number().min(0),
  problemFarmers: z.number().min(0),
});
export type FarmerOrderSum = z.infer<typeof FarmerOrderSumSchema>;

/** API shape: current + upcoming shifts summary for an LC in a TZ */
export const FarmerOrdersSummarySchema = z.object({
  current: FarmerOrderSumSchema,
  next: z.array(FarmerOrderSumSchema),
  tz: z.string(), // IANA timezone name
  lc: z.string(), // logistics center ID
});
export type FarmerOrdersSummary = z.infer<typeof FarmerOrdersSummarySchema>;
