import { z } from "zod";

export const CreateOrderItemSnapshotSchema = z.object({
  // Linkage to FarmerOrder (we'll look up the AMS line by this):
  farmerOrderId: z.string().min(1),

  // Immutable snapshot for Order.items:
  itemId: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().optional().default(""),
  pricePerUnit: z.number().nonnegative(),
  quantity: z.number().positive(), // kg
  category: z.string().optional().default(""),
  sourceFarmerName: z.string().min(1),
  sourceFarmName: z.string().min(1),
}).strict();

export const CreateOrderInputSchema = z.object({
  amsId: z.string().min(1),             // same AMS doc for the whole order
  logisticsCenterId: z.string().min(1), // stored as Order.LogisticsCenterId
  deliveryDate: z.coerce.date(),
  deliveryAddress: z.object({
    lnt: z.number(),
    alt: z.number(),
    address: z.string().min(3),
    logisticCenterId: z.string().optional(),
  }),
  items: z.array(CreateOrderItemSnapshotSchema).min(1),
}).superRefine((val, ctx) => {
  // Optional: avoid duplicate FarmerOrder usage within the same order
  const seenFO = new Set<string>();
  val.items.forEach((it, idx) => {
    if (seenFO.has(it.farmerOrderId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", idx, "farmerOrderId"],
        message: "Duplicate farmerOrderId in items.",
      });
    }
    seenFO.add(it.farmerOrderId);
  });
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
