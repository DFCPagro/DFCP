// src/types/market.ts
import { z } from "zod";

// Accepts absolute URLs, but also tolerates "", null, or undefined by converting them to undefined
export const OptionalUrl = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().url().optional()
);
/* -----------------------------------------------------------------------------
 * SHARED ENUMS
 * -------------------------------------------------------------------------- */

export const ShiftNameSchema = z.enum(["morning", "afternoon", "evening", "night"]);
export type ShiftName = z.infer<typeof ShiftNameSchema>;

export const ItemStatusSchema = z.enum(["active", "soldout", "removed"]);
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

/** NEW: selling mode (introduced in new model) */
export const UnitModeSchema = z.enum(["kg", "unit", "mixed"]);
export type UnitMode = z.infer<typeof UnitModeSchema>;

/** NEW: estimates bag used by the backend for unit-mode presentation */
export const ItemEstimatesSchema = z.object({
  avgWeightPerUnitKg: z.number().nonnegative().nullable().optional(),
  sdKg: z.number().nonnegative().nullable().optional(),
  availableUnitsEstimate: z.number().nonnegative().nullable().optional(),
});

/* -----------------------------------------------------------------------------
 * BACKEND-ALIGNED SCHEMAS (exact field names from availableMarketStock.model)
 *  - Use these ONLY inside the API adapter layer.
 *  - Do NOT import these into UI components.
 * -------------------------------------------------------------------------- */

export const AvailableShiftFlatSchema = z.object({
  shift: ShiftNameSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marketStockId: z.string(),        // mapped from BackendShiftRow.docId
  slotLabel: z.string().optional(), // mapped from BackendShiftRow.deliverySlotLabel
});
export type AvailableShiftFlat = z.infer<typeof AvailableShiftFlatSchema>;

/**
 * NOTE:
 *  - New backend adds: unitMode + estimates{avgWeightPerUnitKg, sdKg, availableUnitsEstimate}
 *  - Older code (and possibly some old docs) had a flat avgWeightPerUnitKg at the line root.
 *  - To remain backward-compatible, we accept BOTH:
 *      - optional root-level avgWeightPerUnitKg (legacy)
 *      - optional estimates object (current)
 */
export const MarketStockLineBackendSchema = z.object({
  _id: z.string(), // subdocument id
  itemId: z.string(),
  displayName: z.string(),
  imageUrl: z.string().url().optional(),
  category: z.string(),

  // price per KG
  pricePerUnit: z.number().nonnegative(),

  // LEGACY (kept for compatibility; new backend moves this inside estimates)
  avgWeightPerUnitKg: z.number().nonnegative().optional(),

  originalCommittedQuantityKg: z.number().nonnegative(),
  currentAvailableQuantityKg: z.number().nonnegative(),

  farmerID: z.string(),
  farmerName: z.string(),
  farmName: z.string().optional(),
  farmLogo: OptionalUrl,        // allows "", null, undefined → undefined, or a valid absolute URL

  status: ItemStatusSchema.optional(), // default behavior handled server-side
  farmerOrderId: z.string().optional(),

  // NEW (optional to stay backward compatible with old documents)
  unitMode: UnitModeSchema.optional(),
  estimates: ItemEstimatesSchema.optional(),
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

  // Keep legacy top-level avgWeightPerUnitKg for existing UI
  avgWeightPerUnitKg: z.number().nonnegative().optional(),

  originalCommittedQuantityKg: z.number().nonnegative(),
  currentAvailableQuantityKg: z.number().nonnegative(),

  farmerID: z.string(),
  farmerName: z.string(),
  farmName: z.string().optional(),
  farmLogo: OptionalUrl,        // allows "", null, undefined → undefined, or a valid absolute URL

  status: ItemStatusSchema.optional(),
  farmerOrderId: z.string().optional(),

  /** NEW: additional fields—optional so current UI keeps working unchanged */
  unitMode: UnitModeSchema.optional(),
  estimates: ItemEstimatesSchema.optional(),
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
 *  - We keep existing fields intact; we only ADD optional fields for new data.
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

  // Keep legacy field; UI already expects it
  avgWeightPerUnitKg: z.number().nonnegative().optional(),

  // From currentAvailableQuantityKg
  availableKg: z.number().nonnegative(),

  farmerId: z.string(), // farmerID -> farmerId
  farmerName: z.string(),
  farmName: z.string().optional(),
  farmLogo: OptionalUrl,        // allows "", null, undefined → undefined, or a valid absolute URL

  status: ItemStatusSchema.optional(),

  /** NEW: passthrough of selling mode + available units if the API provides/derives it */
  unitMode: UnitModeSchema.optional(),
  availableUnitsEstimate: z.number().nonnegative().optional(),
});
export type MarketItem = z.infer<typeof MarketItemSchema>;

/* -----------------------------------------------------------------------------
 * HELPERS
 *  - Map normalized doc -> UI-flat items for consumption by the UI.
 *  - Keep mapping logic here type-safe to prevent drift.
 *  - We pass through new fields when present, but nothing in the UI is forced to use them.
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

    // Keep legacy top-level on the UI item
    avgWeightPerUnitKg: ln.avgWeightPerUnitKg ?? ln.estimates?.avgWeightPerUnitKg ?? undefined,

    availableKg: ln.currentAvailableQuantityKg,

    farmerId: ln.farmerID,
    farmerName: ln.farmerName,
    farmName: ln.farmName,
    farmLogo: ln.farmLogo,

    status: ln.status,

    // NEW: passthroughs (optional, won’t affect existing UI)
    unitMode: ln.unitMode,
    availableUnitsEstimate: ln.estimates?.availableUnitsEstimate ?? undefined,
  }));
}

/* -----------------------------------------------------------------------------
 * ALSO EXPOSED FOR CONVENIENCE IN API LAYER:
 *  - Use to validate lists returned from endpoints that already return flat items
 *    (if you add such endpoints later) or to parse cached payloads.
 * -------------------------------------------------------------------------- */
export const MarketItemListSchema = z.array(MarketItemSchema);
export type MarketItemList = z.infer<typeof MarketItemListSchema>;

// --- "lite" shift result for endpoints that don't provide docId yet ---
export const AvailableShiftLiteSchema = z.object({
  shift: ShiftNameSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  LCid: z.string(),                 // backend returns LCid for context
  slotLabel: z.string().optional(), // if/when backend adds deliverySlotLabel, we accept it
});
export type AvailableShiftLite = z.infer<typeof AvailableShiftLiteSchema>;

// --- stable synthetic key (safe for list/radios) ---
export function makeShiftKey(date: string, shift: ShiftName): string {
  // date is already validated to YYYY-MM-DD by the schema
  return `${date}__${shift}`;
}

// --- discriminator between "flat" (with id) and "lite" ---
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
