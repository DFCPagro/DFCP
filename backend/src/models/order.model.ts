import mongoose, { Schema, Model, Document, Types } from "mongoose";
import toJSON from "../utils/toJSON";
import { Address } from "../types/address";

/** Statuses */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "in-transit",
  "packing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DELIVERY_SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
export type DeliveryShift = (typeof DELIVERY_SHIFTS)[number];

/** Subschemas */
const AddressSchema = new Schema<Address>(
  {
    lnt: { type: Number, required: true },
    alt: { type: Number, required: true },
    address: { type: String, required: true, trim: true },
  },
  { _id: false }
);

export interface IOrderItem {
  itemId: string;
  itemDisplayName: string;
  quantityKg?: number | null;
  quantityUnits?: number | null;
  pricePerUnit: number;
  sourceFarmerId?: string | null;
  shelfLocation?: string | null;
  isPicked: boolean;
  pickedAt?: Date | null;
  containerBarcode?: string | null;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    itemId: { type: String, required: true, trim: true },
    itemDisplayName: { type: String, required: true, trim: true },
    quantityKg: { type: Number, default: null, min: 0 },
    quantityUnits: { type: Number, default: null, min: 0 },
    pricePerUnit: { type: Number, required: true, min: 0 },
    sourceFarmerId: { type: String, default: null, trim: true },
    shelfLocation: { type: String, default: null, trim: true },
    isPicked: { type: Boolean, default: false },
    pickedAt: { type: Date, default: null },
    containerBarcode: { type: String, default: null, trim: true },
  },
  { _id: false }
);

// ensure exactly one quantity field
OrderItemSchema.pre("validate", function (next) {
  const it = this as unknown as IOrderItem;
  const hasKg = it.quantityKg != null && it.quantityKg > 0;
  const hasUnits = it.quantityUnits != null && it.quantityUnits > 0;
  if ((hasKg && hasUnits) || (!hasKg && !hasUnits)) {
    return next(new Error("Each item must have exactly one quantity: kg OR units (> 0)."));
  }
  if (!Number.isFinite(it.pricePerUnit) || it.pricePerUnit < 0) {
    return next(new Error("pricePerUnit must be a non-negative number."));
  }
  if (!it.isPicked && it.pickedAt != null) it.pickedAt = null;
  next();
});

/** Order */
export interface IOrder extends Document {
  orderId: string;
  customerId: Types.ObjectId;         // ref User
  logisticCenterId: Types.ObjectId;   // ref LogisticCenter
  status: OrderStatus;
  deliveryAddress: Address;
  deliveryDate: Date;
  deliveryShift: DeliveryShift;
  totalOrderValue?: number | null;
  totalOrderWeightKg?: number | null;
  totalOrderVolumeM3?: number | null;
  items: IOrderItem[];
  assignedDelivererModel?: "Deliverer" | "IndustrialDeliverer" | null;
  assignedDeliverer?: Types.ObjectId | null;  // refPath
  delivererPickupLocation?: string | null;
  delivererTaskRef?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, required: true, unique: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },           // removed inline index
    logisticCenterId: { type: Schema.Types.ObjectId, ref: "LogisticCenter", required: true }, // removed inline index
    status: { type: String, enum: ORDER_STATUSES, default: "pending" },                 // removed inline index
    deliveryAddress: { type: AddressSchema, required: true },
    deliveryDate: { type: Date, required: true },                                       // removed inline index
    deliveryShift: { type: String, enum: DELIVERY_SHIFTS, required: true },             // removed inline index
    totalOrderValue: { type: Number, default: null, min: 0 },
    totalOrderWeightKg: { type: Number, default: null, min: 0 },
    totalOrderVolumeM3: { type: Number, default: null, min: 0 },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (arr: IOrderItem[]) => Array.isArray(arr) && arr.length > 0,
        message: "Order must contain at least one item.",
      },
    },
    assignedDelivererModel: { type: String, enum: ["Deliverer", "IndustrialDeliverer"], default: null },
    assignedDeliverer: { type: Schema.Types.ObjectId, refPath: "assignedDelivererModel", default: null },
    delivererPickupLocation: { type: String, default: null, trim: true },
    delivererTaskRef: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

// plugins
OrderSchema.plugin(toJSON as any);

// computed total
OrderSchema.pre("save", function (next) {
  const doc = this as IOrder;
  if (Array.isArray(doc.items) && doc.items.length > 0) {
    const total = doc.items.reduce((sum, it) => {
      const q = (it.quantityKg ?? it.quantityUnits ?? 0) as number;
      const p = (it.pricePerUnit ?? 0) as number;
      return sum + q * p;
    }, 0);
    doc.totalOrderValue = Math.max(0, Number(total.toFixed(2)));
  }
  next();
});

/** Explicit indexes (single source of truth). No inline `index:true` above. */
OrderSchema.index({ orderId: 1 }, { unique: true }); // keep uniqueness on orderId
OrderSchema.index({ logisticCenterId: 1, status: 1, deliveryDate: 1, deliveryShift: 1 });
OrderSchema.index({ status: 1, updatedAt: -1 });
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ "items.isPicked": 1 });

export const Order: Model<IOrder> = mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
