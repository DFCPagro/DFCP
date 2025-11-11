// src/types/farmerOrders.ts
import { z } from "zod";
import { ShiftEnum, IsoDateString } from "@/types/shifts";

/* ------------ Shared helpers (safe for Mongoose/ISO strings) ------------ */
const IsoDateLike = z.union([z.string(), z.date()]); // accepts ISO or Date
const UserRefLoose = z.union([
  z.string(), // plain ObjectId string
  z.object({
    id: z.string(),
    name: z.string().optional(),
    role: z.string().optional(),
  }),
]);

/* -------------------- FarmerOrder stage visual states -------------------- */
export const StageStateEnum = z
  .enum(["pending", "current", "done", "problem"])
  .catch("pending");
export const FarmerOrderStageSchema = z.object({
  key: z.string(), // one of FARMER_ORDER_STAGE_KEYS
  label: z.string().optional(),
  status: StageStateEnum.optional(), // for timeline UI
  expectedAt: IsoDateLike.optional(),
  startedAt: IsoDateLike.optional(),
  completedAt: IsoDateLike.optional(),
  timestamp: IsoDateLike.optional(),
  note: z.string().optional(),
  meta: z.record(z.any()).optional(),
});
export type FarmerOrderStage = z.infer<typeof FarmerOrderStageSchema>;

/* --------------------------------- Audit --------------------------------- */
export const AuditEventSchema = z.object({
  action: z.string(), // e.g. "created" | "stage:ok" | "inspection:passed"
  note: z.string().optional(),
  by: UserRefLoose.optional(),
  at: IsoDateLike.optional(),
  timestamp: IsoDateLike.optional(), // some BE structs use 'timestamp'
  meta: z.record(z.any()).optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

/* -------------------------- QS & Inspection types ------------------------- */
// BE: export const GRADES = ["A","B","C"] as const;
export const QSGradeEnum = z.enum(["A", "B", "C"]);

export const VisualInspectionSchema = z.object({
  status: z.enum(["ok", "problem", "pending"]).optional(), // BE default "pending" handled server-side
  note: z.string().optional(),
  timestamp: IsoDateLike.optional(),
});
export type VisualInspection = z.infer<typeof VisualInspectionSchema>;

// If you already have a strict QSInput type, import it instead of this fallback:
const QSInputLooseSchema = z
  .record(z.union([z.number(), z.string(), z.boolean()]))
  .optional();

export const QSReportSchema = z.object({
  values: QSInputLooseSchema, // replace with your strict QSInputSchema when available
  perMetricGrades: z.record(z.any()).default({}).optional(), // { brix: "B", colorDescription: "A", ... }
  overallGrade: z
    .union([QSGradeEnum, z.literal("")])
    .default("")
    .optional(),
  note: z.string().optional(),
  byUserId: UserRefLoose.optional(),
  timestamp: IsoDateLike.optional(),
});
export type QSReport = z.infer<typeof QSReportSchema>;

/* --------------------------- Containers & orders -------------------------- */
export const ContainerLineSchema = z.object({
  type: z.string().optional(), // "crate" | "bin" | "pallet" | ...
  count: z.number().nonnegative().optional(),
  estWeightKg: z.number().nonnegative().optional(),
  note: z.string().optional(),
});
export type ContainerLine = z.infer<typeof ContainerLineSchema>;

export const LinkedOrderSummarySchema = z.object({
  _id: z.string(),
  buyerName: z.string().optional(),
  quantityKg: z.number().nonnegative().optional(),
  status: z.string().optional(), // tighten later if you have an enum
});
export type LinkedOrderSummary = z.infer<typeof LinkedOrderSummarySchema>;

/* --------------------------------- Enums --------------------------------- */

export const FarmerOrderStatusEnum = z.enum(["pending", "ok", "problem"]);
export type FarmerOrderStatus = z.infer<typeof FarmerOrderStatusEnum>;

// -------- FarmerOrder stages (keys + labels + order) --------
export const FARMER_ORDER_STAGES = [
  { key: "farmerAck", label: "Farmer Acknowledged" }, // 1
  { key: "farmerQSrep", label: "Quality Check" }, // 2
  { key: "loadedToTruck", label: "Loaded to Truck" }, // 3
  { key: "inTransit", label: "In-Transit" }, // 4
  { key: "received", label: "Received in LC" }, // 5 (BE spelling intentional)
  { key: "inspection", label: "Inspection" }, // 6
  { key: "sorting", label: "Sorting" }, // 7
  { key: "atWarehouse", label: "Warehouse" }, // 8
] as const;

export type FarmerOrderStageKey = (typeof FARMER_ORDER_STAGES)[number]["key"];

export const FARMER_ORDER_STAGE_KEYS = FARMER_ORDER_STAGES.map(
  (s) => s.key
) as ReadonlyArray<FarmerOrderStageKey>;

export const FARMER_ORDER_STAGE_LABELS: Record<FarmerOrderStageKey, string> =
  Object.fromEntries(
    FARMER_ORDER_STAGES.map((s) => [s.key, s.label])
  ) as Record<FarmerOrderStageKey, string>;

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

export const GetFarmerOrderByShiftRequestSchema = z.object({
  date: IsoDateString,
  shiftName: ShiftEnum,
});
export type GetFarmerOrderByShiftRequest = z.infer<
  typeof GetFarmerOrderByShiftRequestSchema
>;

/* ---------------- Get Farmer Orders by Shift (LIST RESPONSE) -------------- */

/** Minimal row used in the shift list endpoint */
export const FarmerOrderShiftListItemSchema = z.object({
  _id: z.string().min(1),

  // Labels / farmer display
  farmerName: z.string().min(1),
  farmName: z.string().min(1),
  type: z.string().min(1),
  variety: z.string().min(1),

  // Status (reuses our enum)
  farmerStatus: FarmerOrderStatusEnum,
});
export type FarmerOrderShiftListItem = z.infer<
  typeof FarmerOrderShiftListItemSchema
>;

/** Pagination + context metadata */
export const FarmerOrderShiftListMetaSchema = z.object({
  lc: z.string().min(1),
  date: IsoDateString,
  shiftName: ShiftEnum,
  tz: z.string().min(1),

  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),

  /** number of farmers with status=problem (server-computed) */
  problemCount: z.number().int().min(0),

  /** total pages (allow 0 for empty result sets just in case) */
  pages: z.number().int().min(0),
});
export type FarmerOrderShiftListMeta = z.infer<
  typeof FarmerOrderShiftListMetaSchema
>;

/** Full response: { meta, items } */
export const GetFarmerOrderByShiftResponseSchema = z.object({
  meta: FarmerOrderShiftListMetaSchema,
  items: z.array(FarmerOrderShiftListItemSchema),
});
export type GetFarmerOrderByShiftResponse = z.infer<
  typeof GetFarmerOrderByShiftResponseSchema
>;

/**
 * Farmer Order DTO returned from backend (single order).
 * Matches the fields you provided. We keep some fields as generic strings
 * (e.g., inspectionStatus) since only "pending" was specified.
 */
export const FarmerOrderDTOSchema = z.object({
  _id: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
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
  farmLogo: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .nullable()
    .optional(),
  // Scheduling
  shift: ShiftEnum,
  pickUpDate: IsoDateString,
  pickUpTime: z.string().min(1).optional(),

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

/** Query params for GET /api/farmer-orders/by-shift */
export const ShiftFarmerOrdersQuerySchema = z.object({
  date: IsoDateString,
  shiftName: ShiftEnum,
  // v1 shows all; keep optional page/limit for future compatibility
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});
export type ShiftFarmerOrdersQuery = z.infer<
  typeof ShiftFarmerOrdersQuerySchema
>;

export const ShiftFarmerOrderItemSchema = z.object({
  // core fields used by the table
  _id: z.string(),
  farmerName: z.string().min(1),
  farmName: z.string().optional(),
  farmLogo: z.string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .nullable()
    .optional(),
  type: z.string().optional(),
  variety: z.string().optional(),
  farmerStatus: FarmerOrderStatusEnum, // "ok" | "pending" | "problem"

  // additional fields returned by the API (kept optional for now)
  farmerId: z.string().optional(),
  itemId: z.string().optional(),
  logisticCenterId: z.string().optional(),

  shift: ShiftEnum.optional(),
  pickUpDate: IsoDateString.optional(),

  pictureUrl: z.string().url().optional(),

  // quantities (preserve BE misspelling but also expose canonical alias)
  forcastedQuantityKg: z.number().nonnegative().optional(),
  forecastedQuantityKg: z.number().nonnegative().optional(), // NEW alias for FE convenience
  finalQuantityKg: z.number().nonnegative().optional(),
  sumOrderedQuantityKg: z.number().nonnegative().optional(),

  // --- inspection status tightened to BE enum ---
  inspectionStatus: z.enum(["pending", "passed", "failed"]).optional(),

  // --- stages now typed (was unknown[]) ---
  stageKey: z.string().nullable().optional(),
  stages: z.array(FarmerOrderStageSchema).optional(),

  // --- QS reports (farmer & inspection) ---
  farmersQSreport: QSReportSchema.optional(),
  inspectionQSreport: QSReportSchema.optional(),

  // --- quick visual inspection struct ---
  visualInspection: VisualInspectionSchema.optional(),

  // --- audit typed (if BE provides audit/auditTrail) ---
  audit: z.array(AuditEventSchema).optional(),

  // --- containers & orders typed (were unknown[]) ---
  containers: z.array(ContainerLineSchema).optional(),
  orders: z.array(LinkedOrderSummarySchema).optional(),

  // metadata (accept Date or ISO)
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  __v: z.number().optional(),
});
export type ShiftFarmerOrderItem = z.infer<typeof ShiftFarmerOrderItemSchema>;

/** Meta for the response. Counts will be computed client-side. */
export const ShiftFarmerOrdersResponseMetaSchema = z.object({
  lc: z.string().optional(), // inferred from token server-side; may be echoed
  date: IsoDateString,
  shiftName: ShiftEnum,
  tz: z.string().optional(), // e.g., "Asia/Jerusalem"
  // pagination fields optional for future use
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).optional(),
  total: z.number().int().min(0).optional(),
  pages: z.number().int().min(0).optional(),
  /** @deprecated v1 computes counts on client. Keep optional if BE returns it. */
  problemCount: z.number().int().min(0).optional(),
});
export type ShiftFarmerOrdersResponseMeta = z.infer<
  typeof ShiftFarmerOrdersResponseMetaSchema
>;

/** Full response shape for by-shift listing. */
export const ShiftFarmerOrdersResponseSchema = z.object({
  meta: ShiftFarmerOrdersResponseMetaSchema,
  items: z.array(ShiftFarmerOrderItemSchema),
});
export type ShiftFarmerOrdersResponse = z.infer<
  typeof ShiftFarmerOrdersResponseSchema
>;
