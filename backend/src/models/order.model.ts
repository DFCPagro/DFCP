// models/order.model.ts
import { Schema, model, Types } from "mongoose";
import { AddressSchema } from "./shared/address.schema";

const OrderItemSchema = new Schema(
  {
    itemId: { type: Types.ObjectId, ref: "Item", required: true },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    pricePerUnit: { type: Number, required: true, min: 0 },
    // Quantity may be kg or units; you can keep both and validate by category if needed
    quantity: { type: Number, required: true, min: 0.1 },
    category: { type: String, default: "" },

    sourceFarmerName: { type: String, required: true },
    sourceFarmName: { type: String, required: true },

    // Link to the farmerOrder unit that aggregates all demand for that farmer+item+shift
    farmerOrderId: { type: Types.ObjectId, ref: "FarmerOrder", required: true, index: true },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    customerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    deliveryAddress: { type: AddressSchema, required: true },

    items: { type: [OrderItemSchema], default: [], validate: v => v.length > 0 },

    totalPrice: { type: Number, required: true, min: 0 },
    totalOrderWeightKg: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "canceled", "problem"],
      default: "pending",
      index: true,
    },

    // last-mile
    assignedDelivererId: { type: Types.ObjectId, ref: "User", default: null, index: true },
    customerDeliveryId: { type: Types.ObjectId, ref: "CustomerDelivery", default: null, index: true },

    // audit
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, createdAt: -1 });

export const Order = model("Order", OrderSchema);
