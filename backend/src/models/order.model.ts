// models/Order.ts
import mongoose, { Schema, Model, Document, Types } from "mongoose";
import toJSON from "../utils/toJSON";
import { Address } from "../types/address"; // { lnt: number; alt: number; address: string; }

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

// ---------- Subschemas ----------
const AddressSchema = new Schema<Address>(
  {
    lnt: { type: Schema.Types.Number, required: true },
    alt: { type: Schema.Types.Number, required: true },
    address: { type: Schema.Types.String, required: true, trim: true },
  },
  { _id: false }
);

export interface IOrderItem {
  itemId: string;                     // refers to Item.itemId (catalog code)
  itemDisplayName: string;            // snapshot (e.g., "Apple Fuji 1kg")
  quantityKg?: number | null;         // use either Kg...
  quantityUnits?: number | null;      // ...or Units (mutually exclusive)
  pricePerUnit: number;               // matches whichever quantity field is used
  sourceFarmerId?: string | null;     // from availableMarketStock (kept as string per your note)
  shelfLocation?: string | null;      // e.g., "Shelf 4C"
  isPicked: boolean;                  // picker flow
  pickedAt?: Date | null;             // when picked
  containerBarcode?: string | null;   // internal container id/barcode
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    itemId: { type: Schema.Types.String, required: true, trim: true },
    itemDisplayName: { type: Schema.Types.String, required: true, trim: true },

    quantityKg: { type: Schema.Types.Number, default: null, min: 0 },
    quantityUnits: { type: Schema.Types.Number, default: null, min: 0 },

    pricePerUnit: { type: Schema.Types.Number, required: true, min: 0 },

    sourceFarmerId: { type: Schema.Types.String, default: null, trim: true },
    shelfLocation: { type: Schema.Types.String, default: null, trim: true },

    isPicked: { type: Schema.Types.Boolean, default: false },
    pickedAt: { type: Schema.Types.Date, default: null },

    containerBarcode: { type: Schema.Types.String, default: null, trim: true },
  },
  { _id: false }
);

// Exactly ONE of quantityKg or quantityUnits must be provided (> 0)
OrderItemSchema.pre("validate", function (next) {
  const it = this as unknown as IOrderItem;
  const hasKg = it.quantityKg != null && it.quantityKg > 0;
  const hasUnits = it.quantityUnits != null && it.quantityUnits > 0;

  if ((hasKg && hasUnits) || (!hasKg && !hasUnits)) {
    return next(
      new Error(
        "Each item must have exactly one quantity field set (> 0): either quantityKg OR quantityUnits."
      )
    );
  }
  if (!Number.isFinite(it.pricePerUnit) || it.pricePerUnit < 0) {
    return next(new Error("pricePerUnit must be a non-negative number."));
  }
  // If not picked, pickedAt should be null
  if (!it.isPicked && it.pickedAt != null) {
    it.pickedAt = null;
  }
  next();
});

// ---------- Order ----------
export interface IOrder extends Document {
  orderId: string;                     // e.g., ORD-ABC123XYZ
  customerId: Types.ObjectId;          // ref -> User
  logisticCenterId: Types.ObjectId;    // ref -> LogisticCenter

  status: OrderStatus;

  deliveryAddress: Address;            // snapshot
  deliveryDate: Date;                  // start-of-day
  deliveryShift: DeliveryShift;        // morning | afternoon | evening | night

  totalOrderValue?: number | null;     // computed on save
  totalOrderWeightKg?: number | null;  // optional snapshot (leave null if unknown)
  totalOrderVolumeM3?: number | null;  // optional snapshot (leave null if unknown)

  // Items snapshot for this order
  items: IOrderItem[];

  // Deliverer assignment (polymorphic)
  assignedDelivererModel?: "Deliverer" | "IndustrialDeliverer" | null;
  assignedDeliverer?: Types.ObjectId | null;  // refPath below
  delivererPickupLocation?: string | null;
  delivererTaskRef?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

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

    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: (arr: IOrderItem[]) => Array.isArray(arr) && arr.length > 0,
        message: "Order must contain at least one item.",
      },
    },

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

// Keep JSON tidy
OrderSchema.plugin(toJSON as any);

// Auto-calculate totalOrderValue on save from items
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

// Common dashboard/index patterns
OrderSchema.index({ logisticCenterId: 1, status: 1, deliveryDate: 1, deliveryShift: 1 });
OrderSchema.index({ status: 1, updatedAt: -1 });
// Multikey index into items array (useful for picker dashboards)
OrderSchema.index({ "items.isPicked": 1 });

export const Order: Model<IOrder> = mongoose.model<IOrder>("Order", OrderSchema);
export default Order;
