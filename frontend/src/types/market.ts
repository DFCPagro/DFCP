import { z } from "zod";

export const ShiftNameSchema = z.enum(["morning", "afternoon", "evening", "night"]);
export type ShiftName = z.infer<typeof ShiftNameSchema>;

export const DeliverySlotSchema = z.object({
  start: z.string(), // "HH:mm" or ISO
  end: z.string(),
});
export type DeliverySlot = z.infer<typeof DeliverySlotSchema>;

export const AvailableShiftSchema = z.object({
  key: ShiftNameSchema,                                    // shift name
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  window: z.array(DeliverySlotSchema).min(1),
  marketStockId: z.string(),                               // use this to fetch stock
});
export type AvailableShift = z.infer<typeof AvailableShiftSchema>;

export const MarketStockLineSchema = z.object({
  lineId: z.string(),
  stockId: z.string(),             // "<itemId>_<farmerId>"
  itemId: z.string(),
  itemDisplayName: z.string(),
  itemImageUrl: z.string().url().optional(),
  category: z.string(),
  pricePerUnit: z.number().nonnegative(),
  sourceFarmerId: z.string(),
  sourceFarmerName: z.string(),
  sourceFarmName: z.string().optional(),
  originalCommittedQuantityKg: z.number().nonnegative(),
  currentAvailableQuantityKg: z.number().nonnegative(),
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
  pricePerUnit: z.number().nonnegative(),
  availableKg: z.number().nonnegative(),
  farmerId: z.string(),
  farmerName: z.string(),
  farmName: z.string().optional(),
});
export type MarketItem = z.infer<typeof MarketItemSchema>;

export const flattenMarketDocToItems = (doc: MarketStockDoc): MarketItem[] =>
  (doc?.lines ?? []).map((ln) => ({
    docId: doc._id,
    lineId: ln.lineId,
    stockId: ln.stockId,
    date: doc.date,
    shift: doc.shift,
    logisticCenterId: doc.logisticCenterId,
    itemId: ln.itemId,
    name: ln.itemDisplayName,
    imageUrl: ln.itemImageUrl,
    category: ln.category,
    pricePerUnit: ln.pricePerUnit,
    availableKg: ln.currentAvailableQuantityKg,
    farmerId: ln.sourceFarmerId,
    farmerName: ln.sourceFarmerName,
    farmName: ln.sourceFarmName,
  }));

export const AvailableShiftFlatSchema = z.object({
  shift: z.enum(["morning","afternoon","evening","night"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotLabel: z.string(),
  marketStockId: z.string(),
});
export type AvailableShiftFlat = z.infer<typeof AvailableShiftFlatSchema>;
