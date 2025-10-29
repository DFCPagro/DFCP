// src/types/farmerOrders.ts
import { z } from "zod";

/* --------------------------------- Enums --------------------------------- */

export const ShiftEnum = z.enum(["morning", "afternoon", "evening", "night"]);
export type Shift = z.infer<typeof ShiftEnum>;

export const FarmerOrderStatusEnum = z.enum(["pending", "ok", "problem"]);
export type FarmerOrderStatus = z.infer<typeof FarmerOrderStatusEnum>;

/** Strict local date "YYYY-MM-DD" */
export const IsoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export type IsoDateString = z.infer<typeof IsoDateString>;

/* ---------------------------- Summary (existing) --------------------------- */

export const FarmerOrderSumSchema = z.object({
  date: IsoDateString,
  shiftName: ShiftEnum,

  count: z.number().int().min(0),
  problemCount: z.number().int().min(0),

  okFO: z.number().int().min(0),
  pendingFO: z.number().int().min(0),
  problemFO: z.number().int().min(0),

  okFarmers: z.number().int().min(0),
  pendingFarmers: z.number().int().min(0),
  problemFarmers: z.number().int().min(0),
});
export type FarmerOrderSum = z.infer<typeof FarmerOrderSumSchema>;

export const FarmerOrdersSummarySchema = z.object({
  current: FarmerOrderSumSchema,
  next: z.array(FarmerOrderSumSchema),
  tz: z.string(),
  lc: z.string(),
});
export type FarmerOrdersSummary = z.infer<typeof FarmerOrdersSummarySchema>;

/* ----------------------------- Aliases (existing) ------------------------- */

export type ShiftRollup = FarmerOrderSum;
export type FarmerOrdersSummaryResponse = FarmerOrdersSummary;

/* ------------------------- Create Farmer Order (NEW) ---------------------- */

/**
 * Exact request body expected by backend.
 * Keep spelling of `forcastedQuantityKg` to match the API.
 */
export const CreateFarmerOrderRequestSchema = z.object({
  itemId: z.string().min(1),
  farmerId: z.string().min(1),
  shift: ShiftEnum,
  pickUpDate: IsoDateString,
  forcastedQuantityKg: z.number().finite(), // no FE cap per requirements
});
export type CreateFarmerOrderRequest = z.infer<
  typeof CreateFarmerOrderRequestSchema
>;

/**
 * Farmer Order DTO returned from backend (single order).
 * Matches the fields you provided. We keep some fields as generic strings
 * (e.g., inspectionStatus) since only "pending" was specified.
 */
export const FarmerOrderDTOSchema = z.object({
  _id: z.string().min(1),
  itemId: z.string().min(1),

  // Labels / item info
  type: z.string().min(1),
  variety: z.string().min(1),
  pictureUrl: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .nullable()
    .optional(),

  // Farmer identity
  farmerId: z.string().min(1),
  farmerName: z.string().min(1),
  farmName: z.string().min(1),

  // Scheduling
  shift: ShiftEnum,
  pickUpDate: IsoDateString,

  // LC and statuses
  logisticCenterId: z.string().min(1),
  farmerStatus: FarmerOrderStatusEnum,
  inspectionStatus: z.string().min(1), // only "pending" was specified; keep generic

  // Quantities
  sumOrderedQuantityKg: z.number().finite().default(0),
  forcastedQuantityKg: z.number().finite().default(0), // keep exact spelling
  finalQuantityKg: z.number().finite().nullable().default(null),

  // Timestamps (ISO strings). Using string instead of z.datetime() for leniency.
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

/** Unwrapped DTO type (without { data: ... } envelope) */
export type FarmerOrderDTO = z.infer<typeof FarmerOrderDTOSchema>;

/**
 * Some endpoints wrap the DTO as { data: ... } — expose a helper schema too.
 * If your API always wraps, you can switch consumers to this schema.
 */
export const CreateFarmerOrderResponseSchema = z.object({
  data: FarmerOrderDTOSchema,
});
export type CreateFarmerOrderResponse = z.infer<
  typeof CreateFarmerOrderResponseSchema
>;
