import { z } from "zod";

export const ShiftNameSchema = z.enum(["morning", "afternoon", "evening", "night"]);
export type ShiftName = z.infer<typeof ShiftNameSchema>;

/** Backend shape returned by GET /market/available-stock/next5 */
export const BackendShiftRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: ShiftNameSchema,               // backend already sends lowercase per your logs
  docId: z.string(),                    // the stock document id you must use next
  deliverySlotLabel: z.string().optional(),
});
export type BackendShiftRow = z.infer<typeof BackendShiftRowSchema>;


export const DeliverySlotSchema = z.object({
  start: z.string(), // "HH:mm" or ISO
  end: z.string(),
});
export type DeliverySlot = z.infer<typeof DeliverySlotSchema>;

/** Legacy/alternate shape not used by the Market page flows.
 *  The backend does NOT return `window[]`. For Market use:
 *  BackendShiftRow -> map to AvailableShiftFlat.
 */
export const AvailableShiftSchema = z.object({
  key: ShiftNameSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window: z.array(DeliverySlotSchema).min(1),
  marketStockId: z.string(),
});
export type AvailableShift = z.infer<typeof AvailableShiftSchema>;

/**
 * Canonical normalized line as produced by src/api/market.ts:getStockByMarketStockId
 * - displayName/imageUrl are the canonical keys (not itemDisplayName/itemImageUrl).
 * - price/qty fields may be undefined if the backend omitted them.
 */
export const MarketStockLineSchema = z.object({
  lineId: z.string(),
  stockId: z.string(),             // "<itemId>_<farmerId>"
  itemId: z.string(),
  displayName: z.string(),
  imageUrl: z.string().url().optional(),
  category: z.string(),            // API falls back to "misc"
  pricePerUnit: z.number().nonnegative().optional(),
  sourceFarmerId: z.string(),
  sourceFarmerName: z.string(),
  sourceFarmName: z.string().optional(),
  originalCommittedQuantityKg: z.number().nonnegative().optional(),
  currentAvailableQuantityKg: z.number().nonnegative().optional(),
});
export type MarketStockLine = z.infer<typeof MarketStockLineSchema>;

export const MarketStockDocSchema = z.object({
  _id: z.string(), // == marketStockId
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: ShiftNameSchema,
  logisticCenterId: z.string(),
  lines: z.array(MarketStockLineSchema),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type MarketStockDoc = z.infer<typeof MarketStockDocSchema>;

/**
 * need fixes
 * Flattened item used by grid/cards/search.
 * - pricePerUnit/availableKg are optional to reflect source truth.
 */ 
export const MarketItemSchema = z.object({
  docId: z.string(),
  lineId: z.string(),
  stockId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift: ShiftNameSchema,
  logisticCenterId: z.string(),
  itemId: z.string(),
  name: z.string(),
  imageUrl: z.string().url().optional(),
  category: z.string(),
  pricePerUnit: z.number().nonnegative().optional(),
  availableKg: z.number().nonnegative().optional(),
  farmerId: z.string(),
  farmerName: z.string(),
  farmName: z.string().optional(),
});
export type MarketItem = z.infer<typeof MarketItemSchema>;

/**
 * Map a normalized stock doc into the flat item list the UI consumes.
 * Aligns with canonical keys from the API normalization.
 */
export const flattenMarketDocToItems = (doc: MarketStockDoc): MarketItem[] =>
  (doc?.lines ?? []).map((ln) => ({
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
    pricePerUnit: ln.pricePerUnit,                         // may be undefined
    availableKg: ln.currentAvailableQuantityKg,            // may be undefined
    farmerId: ln.sourceFarmerId,
    farmerName: ln.sourceFarmerName,
    farmName: ln.sourceFarmName,
  }));

export const AvailableShiftFlatSchema = z.object({
  shift: ShiftNameSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marketStockId: z.string(),      // mapped from BackendShiftRow.docId
  slotLabel: z.string().optional(), // mapped from BackendShiftRow.deliverySlotLabel
});
export type AvailableShiftFlat = z.infer<typeof AvailableShiftFlatSchema>;
