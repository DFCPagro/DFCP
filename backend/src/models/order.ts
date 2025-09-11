// models/order.model.ts
//base later change the file name to order.model.ts
import { Schema, model, HydratedDocument, Model } from "mongoose";
import { object } from "zod";

export type UnitCategory = "dairy" | "bakery" | "bread" | "baked goods";

export type OrderItem = {
  stockId: string;
  itemId: string;
  name: string;
  category: string;                // or a stricter union if you prefer
  pricePerUnit: number;
  quantityKg?: number;             // for KG-based
  quantityUnits?: number;          // for UNIT-based
  sourceFarmName: string;
  sourceFarmerId: string;
  sourceFarmerName: string;
  itemImageUrl?: string;
};

export type DeliveryAddress = {
  address: string;
  lat?: number;
  lng?: number;
  logisticsCenterId?: string;  // optional, for internal use
};

export type Order = {
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  currency: "USD" | "ILS";
  deliveryShift: "morning" | "afternoon" | "evening" | "night";
  deliveryAddress: DeliveryAddress;
  status: "pending" | "confirmed" | "packed" | "shipped" | "delivered" | "canceled";
};

const OrderItemSchema = new Schema<OrderItem>({
  stockId: { type: String, required: true },
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  pricePerUnit: { type: Number, required: true, min: 0 },
  quantityKg: { type: Number, min: 0.1 },
  quantityUnits: { type: Number, min: 1 },
  sourceFarmName: { type: String, required: true },
  sourceFarmerId: { type: String, required: true },
  sourceFarmerName: { type: String, required: true },
  itemImageUrl: { type: String },

}, { _id: false });

const DeliveryAddressSchema = new Schema<DeliveryAddress>({
  address: { type: String, required: true },
  lat: Number,
  lng: Number,
}, { _id: false });

const OrderSchema = new Schema<Order>({
  customerId: { type: String, required: true, index: true },
  items: { type: [OrderItemSchema], required: true, validate: v => v.length > 0 },
  subtotal: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ["USD","ILS"], default: "USD" },
  deliveryShift: { type: String, enum: ["morning","afternoon","evening","night"], required: true },
  deliveryAddress: { type: DeliveryAddressSchema, required: true },
  status: { type: String, enum: ["pending","paid","packed","shipped","delivered","canceled"], default: "pending", index: true },
}, { timestamps: true });

export type OrderDoc = HydratedDocument<Order>;
export type OrderModel = Model<Order>;

export const OrderModel = model<Order, OrderModel>("Order", OrderSchema);
