// src/validations/orders.validation.ts
import { z } from "zod";

// ----- Shared bits -----
const EstimatesSnapshotSchema = z.object({
  avgWeightPerUnitKg: z.number().positive().optional().nullable(), // required when units>0
  stdDevKg: z.number().nonnegative().optional().nullable(),
}).partial(); // allow passing only avg when needed

const BaseItemSnapshotSchema = z.object({
  // We select the AMS line using this farmerOrderId
  farmerOrderId: z.string().min(1),

  // Immutable item snapshot
  itemId: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().optional().default(""),
  // NOTE: optional; your service will use AMS price if absent
  pricePerUnit: z.number().nonnegative().optional(),
  category: z.string().optional().default(""),
  sourceFarmerName: z.string().min(1),
  sourceFarmName: z.string().min(1),
});

// ----- Legacy path (quantity in KG only) -----
const LegacyItemSchema = BaseItemSnapshotSchema.extend({
  quantity: z.number().positive(), // KG
}).strict();

// ----- New path (unitMode kg | unit | mixed) -----
const NewItemSchema = BaseItemSnapshotSchema.extend({
  unitMode: z.enum(["kg", "unit", "mixed"]).default("kg"),
  quantityKg: z.number().nonnegative().default(0),
  units: z.number().nonnegative().default(0),
  estimatesSnapshot: EstimatesSnapshotSchema.optional(),
})
.superRefine((val, ctx) => {
  const { unitMode, quantityKg = 0, units = 0, estimatesSnapshot } = val;

  const avg = estimatesSnapshot?.avgWeightPerUnitKg ?? null;
  const hasAvg = Number.isFinite(avg as number) && (avg as number) > 0;

  if (unitMode === "kg") {
    if (!(quantityKg > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantityKg"],
        message: "For unitMode='kg', quantityKg must be > 0.",
      });
    }
  } else if (unitMode === "unit") {
    if (!(units > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["units"],
        message: "For unitMode='unit', units must be > 0.",
      });
    }
    if (!(hasAvg)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estimatesSnapshot", "avgWeightPerUnitKg"],
        message: "For unitMode='unit', estimatesSnapshot.avgWeightPerUnitKg must be > 0.",
      });
    }
  } else if (unitMode === "mixed") {
    if (!((quantityKg > 0) || (units > 0))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantityKg"],
        message: "For unitMode='mixed', at least one of quantityKg or units must be > 0.",
      });
    }
    if (units > 0 && !hasAvg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["estimatesSnapshot", "avgWeightPerUnitKg"],
        message: "For unitMode='mixed' with units > 0, estimatesSnapshot.avgWeightPerUnitKg must be > 0.",
      });
    }
  }
}).strict();

// Accept either legacy or new item shape
export const CreateOrderItemSnapshotSchema = z.union([LegacyItemSchema, NewItemSchema]);

// ----- Address (keep permissive, but fix keys) -----
const DeliveryAddressSchema = z.object({
  lnt: z.number(),              
  alt: z.number(),               
  address: z.string().min(3),
  logisticCenterId: z.string().optional(),
}).strict();

// ----- Main input -----
export const CreateOrderInputSchema = z.object({
  amsId: z.string().min(1),             // same AMS for whole order
  logisticsCenterId: z.string().min(1), // stored as Order.LogisticsCenterId
  deliveryDate: z.coerce.date(),
  deliveryAddress: DeliveryAddressSchema,
  items: z.array(CreateOrderItemSnapshotSchema).min(1),
})
.superRefine((val, ctx) => {
  // Prevent duplicate FarmerOrder use in a single order
  const seenFO = new Set<string>();
  val.items.forEach((it, idx) => {
    const fo = (it as any).farmerOrderId;
    if (seenFO.has(fo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", idx, "farmerOrderId"],
        message: "Duplicate farmerOrderId in items.",
      });
    }
    seenFO.add(fo);

    // Disallow mixing legacy 'quantity' with new fields in the same item
    const hasLegacy = "quantity" in it;
    const hasNew = "unitMode" in it || "quantityKg" in it || "units" in it || "estimatesSnapshot" in it;
    if (hasLegacy && hasNew) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", idx],
        message: "Do not mix legacy {quantity} with {unitMode/quantityKg/units/estimatesSnapshot} on the same item.",
      });
    }
  });
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
