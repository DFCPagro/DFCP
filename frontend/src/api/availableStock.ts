// src/api/availableStock.ts
import { z } from "zod";
import { api } from "./config";

/* ----------------------------- Schemas & types ----------------------------- */

export const ShiftSchema = z.enum(["morning", "afternoon", "evening", "night"]);
export type Shift = z.infer<typeof ShiftSchema>;

export const InitAvailableStockInputSchema = z.object({
  date: z.string().min(1, "date is required"),
  shift: ShiftSchema,
});
export type InitAvailableStockInput = z.infer<typeof InitAvailableStockInputSchema>;

export const EstimatesSchema = z.object({
  avgWeightPerUnitKg: z.number().optional(),
  sdKg: z.number().optional(),
  availableUnitsEstimate: z.number().nullable().optional(),
  unitBundleSize: z.number().optional(),
  zScore: z.number().optional(),
  shrinkagePct: z.number().optional(),
});

export const AvailableMarketStockItemSchema = z.object({
  itemId: z.string().optional(),
  displayName: z.string().optional(),
  category: z.string().optional(),
  pricePerKg: z.number().optional(),
  pricePerUnit: z.number().nullable().optional(),
  currentAvailableQuantityKg: z.number().optional(),
  originalCommittedQuantityKg: z.number().optional(),
  farmerOrderId: z.string().optional(),
  farmerID: z.string().optional(), // tolerate both
  farmerId: z.string().optional(),
  farmerName: z.string().optional(),
  farmName: z.string().optional(),
  farmLogo: z.string().nullable().optional(),
  unitMode: z.enum(["kg", "unit", "mixed"]).optional(),
  estimates: EstimatesSchema.optional(),
  status: z.enum(["active", "soldout", "removed"]).optional(),
});

export const AvailableMarketStockSchema = z.object({
  id: z.string(),
  availableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  availableShift: ShiftSchema,
  items: z.array(AvailableMarketStockItemSchema).default([]),
});
export type AvailableMarketStock = z.infer<typeof AvailableMarketStockSchema>;

/* ------------------------------ Helper utils ------------------------------- */

function extractDoc(payload: any) {
  // Handle common wrappers
  const maybe =
    payload?.data?.doc ??
    payload?.data ??
    payload?.doc ??
    payload?.result ??
    payload;

  return maybe;
}

/** Permissive raw schema—allow unknown props and missing strict fields */
const RawAvailableMarketStockSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),

    // Accept multiple possible keys for date/shift; we’ll normalize later
    availableDate: z.string().optional(),
    date: z.string().optional(),
    pickUpDate: z.string().optional(),
    available_date: z.string().optional(),

    availableShift: ShiftSchema.optional(),
    shift: ShiftSchema.optional(),
    available_shift: ShiftSchema.optional(),

    items: z.array(AvailableMarketStockItemSchema).optional(),
    stockItems: z.array(AvailableMarketStockItemSchema).optional(),

    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    createdById: z.string().optional(),
  })
  .passthrough();

function toYYYYMMDD(s: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(+d)) throw new Error(`Unparseable date: ${s}`);
  return d.toISOString().slice(0, 10);
}


/** Normalize BE drift: id→_id, date/shift key variants → strict keys */
function normalizeAms(raw: z.infer<typeof RawAvailableMarketStockSchema>): AvailableMarketStock {
  // --- robust id coercion ---
  let id: string | undefined;
  if (typeof raw._id === "string") {
    id = raw._id;
  } else if (raw._id && typeof raw._id === "object") {
    // Handle ObjectId or Extended JSON { $oid: "..." }
    if (typeof (raw._id as any).$oid === "string") {
      id = (raw._id as any).$oid;
    } else if (typeof (raw._id as any).toString === "function") {
      const s = (raw._id as any).toString();
      if (s && s !== "[object Object]") id = s;
    }
  } else if (typeof raw.id === "string") {
    id = raw.id;
  }

  if (!id) {
    throw new Error("Missing id/_id in AvailableMarketStock response");
  }

  // --- date coercion ---
  const dateRaw =
    raw.availableDate ?? raw.date ?? raw.pickUpDate ?? raw.available_date;
  if (!dateRaw) throw new Error("Missing availableDate/date in response");

  const shiftRaw =
    raw.availableShift ?? raw.shift ?? raw.available_shift;
  if (!shiftRaw) throw new Error("Missing availableShift/shift in response");

  const items = raw.items ?? raw.stockItems ?? [];

  const normalized = {
    id,
    availableDate: toYYYYMMDD(dateRaw),
    availableShift: shiftRaw,
    items,
  };

  return AvailableMarketStockSchema.parse(normalized);
}


/* ----------------------------------- API ----------------------------------- */

/**
 * Initialize (or find) Available Market Stock document
 * NOTE: Based on your log, the live endpoint is `/market/available-stock/init`
 * If your gateway exposes `/api/available-stock/init`, flip the path below.
 */

export async function initAvailableStock(
  input: InitAvailableStockInput
): Promise<AvailableMarketStock> {
  const payload = InitAvailableStockInputSchema.parse(input);

  // Your server log shows the v1 path; keep this unless your gateway differs.
  const { data } = await api.post("/market/available-stock/init", payload);

  const body = extractDoc(data);
  const raw = RawAvailableMarketStockSchema.parse(body);
  return normalizeAms(raw);
}
/* -------------------------------------------------------------------------- */
/* TODOs                                                                      */
/* -------------------------------------------------------------------------- */
// TODO: If backend eventually standardizes on `_id` and `YYYY-MM-DD`, we can remove the normalizer.
// TODO: If you need a slimmer DTO for UI, add a pick/transform layer here.
