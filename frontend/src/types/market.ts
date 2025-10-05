// src/types/market.ts
import { z } from "zod";

/* -----------------------------------------------------------------------------
 * SHARED ENUMS
 * -------------------------------------------------------------------------- */

export const ShiftNameSchema = z.enum(["morning", "afternoon", "evening", "night"]);
export type ShiftName = z.infer<typeof ShiftNameSchema>;

export const ItemStatusSchema = z.enum(["active", "soldout", "removed"]);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

/* -----------------------------------------------------------------------------
 * BACKEND-ALIGNED SCHEMAS (exact field names from availableMarketStock.model)
 *  - Use these ONLY inside the API adapter layer.
 *  - Do NOT import these into UI components.
 * -------------------------------------------------------------------------- */

export const AvailableShiftFlatSchema = z.object({
  shift: ShiftNameSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marketStockId: z.string(),      // mapped from BackendShiftRow.docId
  slotLabel: z.string().optional(), // mapped from BackendShiftRow.deliverySlotLabel
});
export type AvailableShiftFlat = z.infer<typeof AvailableShiftFlatSchema>;


export const MarketStockLineBackendSchema = z.object({
  _id: z.string(), // subdocument id
  itemId: z.string(),
  displayName: z.string(),
  imageUrl: z.string().url().optional(),
  category: z.string(),
  pricePerUnit: z.number().nonnegative(),
  avgWeightPerUnitKg: z.number().nonnegative().optional(), // NEW: to be added in backend
  originalCommittedQuantityKg: z.number().nonnegative(),
  currentAvailableQuantityKg: z.number().nonnegative(),
  farmerID: z.string(),
  farmerName: z.string(),
  farmName: z.string().optional(),
  farmLogo: z.string().url().optional(),
  status: ItemStatusSchema.optional(), // default behavior handled server-side
  farmerOrderId: z.string().optional(),
});
export type MarketStockLineBackend = z.infer<typeof MarketStockLineBackendSchema>;

export const MarketStockDocBackendSchema = z.object({
  _id: z.string(), // marketStockId
  availableDate: z.union([z.string(), z.date()]), // normalized to YYYY-MM-DD in API layer
  availableShift: ShiftNameSchema,
  LCid: z.string(),
  items: z.array(MarketStockLineBackendSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type MarketStockDocBackend = z.infer<typeof MarketStockDocBackendSchema>;

/* -----------------------------------------------------------------------------
 * NORMALIZED FRONTEND SCHEMAS (stable, app-wide internal contract)
 *  - API layer maps BACKEND -> NORMALIZED (no UI-specific renames here).
 *  - Keep backend semantics but unify names we use throughout the app.
 * -------------------------------------------------------------------------- */

export const MarketStockLineSchema = z.object({
  lineId: z.string(), // from backend._id
  stockId: z.string(), // computed "<itemId>_<farmerID>"
  itemId: z.string(),
  displayName: z.string(),
  imageUrl: z.string().url().optional(),
  category: z.string(),
  pricePerUnit: z.number().nonnegative(),
  avgWeightPerUnitKg: z.number().nonnegative().optional(),
  originalCommittedQuantityKg: z.number().nonnegative(),
  currentAvailableQuantityKg: z.number().nonnegative(),
  farmerID: z.string(),
  farmerName: z.string(),
  farmName: z.string().optional(),
  farmLogo: z.string().url().optional(),
  status: ItemStatusSchema.optional(),
  farmerOrderId: z.string().optional(),
});
export type MarketStockLine = z.infer<typeof MarketStockLineSchema>;

export const MarketStockDocSchema = z.object({
  _id: z.string(), // == marketStockId
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // normalized from availableDate
  shift: ShiftNameSchema, // from availableShift
  logisticCenterId: z.string(), // from LCid
  lines: z.array(MarketStockLineSchema), // from items[]
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type MarketStockDoc = z.infer<typeof MarketStockDocSchema>;

/* -----------------------------------------------------------------------------
 * UI-FLAT ITEM (what cards/grid/search receive)
 *  - This is the only item shape components should use.
 *  - Friendly names; derived from MarketStockDoc + MarketStockLine.
 * -------------------------------------------------------------------------- */

export const MarketItemSchema = z.object({
  docId: z.string(), // doc._id
  lineId: z.string(), // line.lineId
  stockId: z.string(), // "<itemId>_<farmerID>"
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: ShiftNameSchema,
  logisticCenterId: z.string(),

  itemId: z.string(),
  name: z.string(), // from displayName
  imageUrl: z.string().url().optional(),
  category: z.string(),

  pricePerUnit: z.number().nonnegative(),
  avgWeightPerUnitKg: z.number().nonnegative().optional(),

  availableKg: z.number().nonnegative(), // from currentAvailableQuantityKg

  farmerId: z.string(), // farmerID -> farmerId
  farmerName: z.string(),
  farmName: z.string().optional(),
  farmLogo: z.string().url().optional(),

  status: ItemStatusSchema.optional(),
});
export type MarketItem = z.infer<typeof MarketItemSchema>;

/* -----------------------------------------------------------------------------
 * HELPERS
 *  - Map normalized doc -> UI-flat items for consumption by the UI.
 *  - Keep mapping logic here type-safe to prevent drift.
 * -------------------------------------------------------------------------- */

export function flattenMarketDocToItems(doc: MarketStockDoc): MarketItem[] {
  return (doc.lines ?? []).map((ln) => ({
    docId: doc._id,
    lineId: ln.lineId,
    stockId: ln.stockId,
    date: doc.date,
    shift: doc.shift,
    logisticCenterId: doc.logisticCenterId,

    itemId: ln.itemId,
    name: ln.displayName,
    imageUrl: ln.imageUrl,
    category: ln.category,

    pricePerUnit: ln.pricePerUnit,
    avgWeightPerUnitKg: ln.avgWeightPerUnitKg,

    availableKg: ln.currentAvailableQuantityKg,

    farmerId: ln.farmerID,
    farmerName: ln.farmerName,
    farmName: ln.farmName,
    farmLogo: ln.farmLogo,

    status: ln.status,
  }));
}

/* -----------------------------------------------------------------------------
 * ALSO EXPOSED FOR CONVENIENCE IN API LAYER:
 *  - Use to validate lists returned from endpoints that already return flat items
 *    (if you add such endpoints later) or to parse cached payloads.
 * -------------------------------------------------------------------------- */
export const MarketItemListSchema = z.array(MarketItemSchema);
export type MarketItemList = z.infer<typeof MarketItemListSchema>;

// --- NEW: "lite" shift result for endpoints that don't provide docId yet ---
export const AvailableShiftLiteSchema = z.object({
  shift: ShiftNameSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  LCid: z.string(),                 // backend returns LCid for context
  slotLabel: z.string().optional(), // if/when backend adds deliverySlotLabel, we accept it
});
export type AvailableShiftLite = z.infer<typeof AvailableShiftLiteSchema>;

// --- NEW: small helper to make a stable synthetic key (safe for list/radios) ---
export function makeShiftKey(date: string, shift: ShiftName): string {
  // date is already validated to YYYY-MM-DD by the schema
  return `${date}__${shift}`;
}

// --- NEW: type guard to discriminate between "flat" (with id) and "lite" ---
export function isAvailableShiftFlat(
  value: unknown
): value is AvailableShiftFlat {
  try {
    // Will throw if required props (including marketStockId) are missing
    AvailableShiftFlatSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}
