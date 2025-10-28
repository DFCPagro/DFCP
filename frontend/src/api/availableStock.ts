// src/api/availableStock.ts
import { z } from "zod";
import { api } from "./config";

/* -------------------------------------------------------------------------- */
/* Types aligned to backend (robust to minor drift)                           */
/* -------------------------------------------------------------------------- */

// Only morning/afternoon/evening
export const ShiftSchema = z.enum(["morning", "afternoon", "evening", "night"]);
export type Shift = z.infer<typeof ShiftSchema>;

export const InitAvailableStockInputSchema = z.object({
  LCid: z.string().min(1, "LCid is required"),
  // backend accepts full ISO; we accept YYYY-MM-DD or ISO and send whatever you pass
  date: z.string().min(1, "date is required"),
  shift: ShiftSchema,
});
export type InitAvailableStockInput = z.infer<
  typeof InitAvailableStockInputSchema
>;

/** Embedded estimates object (kept permissive) */
export const EstimatesSchema = z.object({
  avgWeightPerUnitKg: z.number().optional(),
  sdKg: z.number().optional(),
  availableUnitsEstimate: z.number().nullable().optional(),
  unitBundleSize: z.number().optional(),
  zScore: z.number().optional(),
  shrinkagePct: z.number().optional(),
});

/** Items inside the AvailableMarketStock document */
export const AvailableMarketStockItemSchema = z.object({
  itemId: z.string().optional(),
  displayName: z.string().optional(),
  category: z.string().optional(),
  pricePerKg: z.number().optional(),
  pricePerUnit: z.number().nullable().optional(),
  currentAvailableQuantityKg: z.number().optional(),
  originalCommittedQuantityKg: z.number().optional(),
  farmerOrderId: z.string().optional(),
  farmerID: z.string().optional(),
  farmerName: z.string().optional(),
  farmName: z.string().optional(),
  farmLogo: z.string().nullable().optional(),
  unitMode: z.enum(["kg", "unit", "mixed"]).optional(),
  estimates: EstimatesSchema.optional(),
  status: z.enum(["active", "soldout", "removed"]).optional(),
});

/** Strict, normalized AMS type we want to expose to the app */
export const AvailableMarketStockSchema = z.object({
  id: z.string(),
  LCid: z.string(),
  availableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  availableShift: ShiftSchema,
  items: z.array(AvailableMarketStockItemSchema).default([]),
});
export type AvailableMarketStock = z.infer<typeof AvailableMarketStockSchema>;

/** Raw response shape from BE (permissive: id/_id, date string in any format) */
const RawAvailableMarketStockSchema = z.object({
  _id: z.string().optional(),
  id: z.string().optional(),
  LCid: z.string(),
  availableDate: z.string(), // may be 'YYYY-MM-DD' or ISO datetime
  availableShift: ShiftSchema,
  items: z.array(AvailableMarketStockItemSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  createdById: z.string().optional(),
});

/** Normalize BE drift: id→_id and date→YYYY-MM-DD */
function normalizeAms(
  raw: z.infer<typeof RawAvailableMarketStockSchema>
): AvailableMarketStock {
  const id = raw._id ?? raw.id;
  if (!id) {
    throw new Error("Missing id/_id in AvailableMarketStock response");
  }

  // Coerce availableDate to YYYY-MM-DD safely
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(raw.availableDate)
    ? raw.availableDate
    : new Date(raw.availableDate).toISOString().slice(0, 10);

  const normalized = {
    id,
    LCid: raw.LCid,
    availableDate: dateStr,
    availableShift: raw.availableShift,
    items: raw.items ?? [],
  };

  // Final strict validation to catch anything else
  return AvailableMarketStockSchema.parse(normalized);
}

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Initialize (or find) Available Market Stock document
 * NOTE: Based on your log, the live endpoint is `/market/available-stock/init`
 * If your gateway exposes `/api/available-stock/init`, flip the path below.
 */
export async function initAvailableStock(
  input: InitAvailableStockInput
): Promise<AvailableMarketStock> {
  const payload = InitAvailableStockInputSchema.parse(input);

  // Your console output showed this path working:
  const { data } = await api.post("/market/available-stock/init", payload);

  const body = data?.data ?? data;

  // First parse as a *raw* response (permissive)...
  const raw = RawAvailableMarketStockSchema.parse(body);

  // ...then normalize to the strict app shape
  return normalizeAms(raw);
}

/* -------------------------------------------------------------------------- */
/* TODOs                                                                      */
/* -------------------------------------------------------------------------- */
// TODO: If backend eventually standardizes on `_id` and `YYYY-MM-DD`, we can remove the normalizer.
// TODO: If you need a slimmer DTO for UI, add a pick/transform layer here.
