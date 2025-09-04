// models/Order.ts
import mongoose, { Schema, Model, Document, Types } from "mongoose";
import toJSON from "../utils/toJSON";
import { Address } from "../types/address"; // { lnt: number; alt: number; address: string; }

// ---- Enums / types ----
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "picking",
  "packed",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DELIVERY_SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
export type DeliveryShift = (typeof DELIVERY_SHIFTS)[number];

// ---- Subschemas ----
const AddressSchema = new Schema<Address>(
  {
    lnt: { type: Schema.Types.Number, required: true },      // longitude-like (as per your type)
    alt: { type: Schema.Types.Number, required: true },      // latitude-like (as per your type)
    address: { type: Schema.Types.String, required: true, trim: true },
  },
  { _id: false }
);

// ---- Document interface ----
export interface IOrder extends Document {
  orderId: string;                    // human-friendly id (e.g., ORD-ABC123XYZ)
  customerId: Types.ObjectId;         // ref -> User
  logisticCenterId: Types.ObjectId;   // ref -> LogisticCenter

  createdAt: Date;
  updatedAt: Date;

  status: OrderStatus;

  deliveryAddress: Address;           // snapshot (uses your Address type)
  deliveryDate: Date;                 // start of day for routing buckets
  deliveryShift: DeliveryShift;       // morning | afternoon | evening | night

  totalOrderValue?: number | null;    // monetary snapshot
  totalOrderWeightKg?: number | null; // physical snapshot
  totalOrderVolumeM3?: number | null; // physical snapshot

  // Deliverer assignment (polymorphic: Deliverer | IndustrialDeliverer)
  assignedDelivererModel?: "Deliverer" | "IndustrialDeliverer" | null;
  assignedDeliverer?: Types.ObjectId | null;  // refPath below
  delivererPickupLocation?: string | null;    // e.g., "Packing Zone 2, Shelf 4C"
  delivererTaskRef?: string | null;           // external task id / doc ref
}

// ---- Schema ----
const OrderSchema = new Schema<IOrder>(
  {
    orderId: {
      type: Schema.Types.String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    logisticCenterId: {
      type: Schema.Types.ObjectId,
      ref: "LogisticCenter",
      required: true,
      index: true,
    },

    status: {
      type: Schema.Types.String,
      enum: ORDER_STATUSES,
      default: "pending",
      index: true,
    },

    deliveryAddress: { type: AddressSchema, required: true },

    deliveryDate: { type: Schema.Types.Date, required: true, index: true },
    deliveryShift: { type: Schema.Types.String, enum: DELIVERY_SHIFTS, required: true, index: true },

    totalOrderValue: { type: Schema.Types.Number, default: null, min: 0 },
    totalOrderWeightKg: { type: Schema.Types.Number, default: null, min: 0 },
    totalOrderVolumeM3: { type: Schema.Types.Number, default: null, min: 0 },

    assignedDelivererModel: {
      type: Schema.Types.String,
      enum: ["Deliverer", "IndustrialDeliverer"],
      default: null,
    },
    assignedDeliverer: {
      type: Schema.Types.ObjectId,
      refPath: "assignedDelivererModel",
      default: null,
      index: true,
    },
    delivererPickupLocation: { type: Schema.Types.String, default: null, trim: true },
    delivererTaskRef: { type: Schema.Types.String, default: null, trim: true },
  },
  { timestamps: true }
);

// Plugins
OrderSchema.plugin(toJSON as any);

// Useful compound indexes for dashboards / routing waves
OrderSchema.index({ logisticCenterId: 1, status: 1, deliveryDate: 1, deliveryShift: 1 });
OrderSchema.index({ status: 1, updatedAt: -1 });

// Model
export const Order: Model<IOrder> = mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
