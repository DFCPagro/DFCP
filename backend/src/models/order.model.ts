import { Schema, model, InferSchemaType, HydratedDocument, Model, Types } from "mongoose";
import toJSON from "../utils/toJSON";
import { AddressSchema } from "./shared/address.schema";
import { AuditEntrySchema } from "./shared/audit.schema";

// ------ statuses ------
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "canceled",
  "problem",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// ------ sub-schema: embedded order item ------
const OrderItemSchema = new Schema(
  {
    itemId: { type: String, ref: "Item", required: true }, // matches Item._id:string
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    pricePerUnit: { type: Number, required: true, min: 0 },

    quantity: { type: Number, required: true, min: 0.1 }, // kg or units
    category: { type: String, default: "" },

    sourceFarmerName: { type: String, required: true, trim: true },
    sourceFarmName: { type: String, required: true, trim: true },

    farmerOrderId: { type: Types.ObjectId, ref: "FarmerOrder", required: true, index: true },
  },
  { _id: false }
);

// ------ main schema ------
const DELIVERY_FEE_USD = 15;

const OrderSchema = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    deliveryAddress: { type: AddressSchema, required: true },

    items: {
      type: [OrderItemSchema],
      default: [],
      validate: {
        validator: (val: unknown[]) => Array.isArray(val) && val.length > 0,
        message: "Order must contain at least one item.",
      },
    },

    itemsSubtotal: { type: Number, required: true, min: 0, default: 0 }, // derived
    deliveryFee: { type: Number, required: true, default: DELIVERY_FEE_USD },
    totalPrice: { type: Number, required: true, min: 0, default: 0 }, // itemsSubtotal + deliveryFee

    totalOrderWeightKg: { type: Number, required: true, min: 0, default: 0 },

    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },

    assignedDelivererId: { type: Types.ObjectId, ref: "User", default: null, index: true },
    customerDeliveryId: { type: Types.ObjectId, ref: "CustomerDelivery", default: null, index: true },

    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// ------ plugins & indexes ------
OrderSchema.plugin(toJSON as any);
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ "items.farmerOrderId": 1 });

// ------ inferred types ------
export type Order = InferSchemaType<typeof OrderSchema>;
export type OrderDoc = HydratedDocument<Order>;

export interface OrderMethods {
  addAudit(userId: Types.ObjectId, action: string, note?: string, meta?: any): void;
  recalcTotals(): void;
}

export type OrderModel = Model<Order, {}, OrderMethods>;

// ------ methods impl ------
OrderSchema.methods.addAudit = function (
  this: HydratedDocument<Order> & OrderMethods,
  userId: Types.ObjectId,
  action: string,
  note = "",
  meta: any = {}
) {
  this.historyAuditTrail.push({ userId, action, note, meta, timestamp: new Date() });
};

OrderSchema.methods.recalcTotals = function (this: HydratedDocument<Order> & OrderMethods) {
  // subtotal
  const subtotal = (this.items || []).reduce(
    (sum: number, item: any) => sum + (item.pricePerUnit || 0) * (item.quantity || 0),
    0
  );

  // weight
  const totalWeight = (this.items || []).reduce(
    (sum: number, item: any) => sum + (item.quantity || 0),
    0
  );

  this.itemsSubtotal = Math.round(subtotal * 100) / 100;
  this.deliveryFee = DELIVERY_FEE_USD;
  this.totalPrice = this.itemsSubtotal + this.deliveryFee;
  this.totalOrderWeightKg = Math.round(totalWeight * 100) / 100;
};

// ------ hooks ------
OrderSchema.pre("validate", function (next) {
  const doc = this as HydratedDocument<Order> & OrderMethods;
  doc.recalcTotals();
  next();
});

// ------ model ------
export const Order = model<Order, OrderModel>("Order", OrderSchema);
export default Order;
