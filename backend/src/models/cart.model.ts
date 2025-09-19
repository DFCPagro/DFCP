// src/models/cart.model.ts
import { Schema, model, models, InferSchemaType, HydratedDocument, Model, Types } from "mongoose";
import toJSON from "../utils/toJSON";
import ShiftConfig from "./shiftConfig.model";
import { SHIFT_NAMES, type ShiftName } from "./availableMarketStock.model";

const CartItemSchema = new Schema(
  {
    availableMarketStockItemId: { type: Schema.Types.ObjectId, required: true }, // AMS.items._id
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    displayName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: null },
    pricePerUnit: { type: Number, required: true, min: 0 },
    amountKg: { type: Number, required: true, min: 0 },
    addedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const CartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    LCid: { type: Schema.Types.ObjectId, ref: "LogisticCenter", required: true, index: true },
    availableMarketStockId: { type: Schema.Types.ObjectId, ref: "AvailableMarketStock", required: true, index: true },

    availableDate: { type: Date, required: true, index: true }, // 00:00 UTC
    availableShift: { type: String, enum: SHIFT_NAMES, required: true, index: true },

    items: { type: [CartItemSchema], default: [] },

    lastActivityAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },

    status: {
      type: String,
      enum: ["active", "abandoned", "expired", "checkedout"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

// Normalize service-day to 00:00 UTC
CartSchema.pre("validate", function (next) {
  if (this.availableDate) {
    const d = new Date(this.availableDate);
    d.setUTCHours(0, 0, 0, 0);
    this.availableDate = d;
  }
  next();
});

CartSchema.index({ status: 1, expiresAt: 1 }); // reclaimExpiredCarts
CartSchema.index({ availableDate: 1, availableShift: 1, status: 1 }); // global shift wipe

CartSchema.plugin(toJSON);

export type Cart = InferSchemaType<typeof CartSchema>;
export type CartDoc = HydratedDocument<Cart>;
export type CartModel = Model<Cart>;

export default (models.Cart as CartModel) || model<Cart, CartModel>("Cart", CartSchema);

// ---------- Expiry helper (GLOBAL shift configs) ----------
function addUtcMinutes(base: Date, minutes: number) {
  const d = new Date(base);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d;
}

/**
 * Compute new expiry as min(now + inactivity, shiftEnd).
 * LCid is ignored (kept for call-site compatibility).
 */
export async function computeNewExpiry(
  _LCid: Types.ObjectId | null,
  availableDate: Date,                     // 00:00 UTC for the service day
  shiftName: "morning" | "afternoon" | "evening" | "night",
  inactivityMinutes: number
): Promise<Date> {
  // pull both start & end
  const cfg = await ShiftConfig.findOne(
    { name: shiftName },
    { generalStartMin: 1, generalEndMin: 1 }
  ).lean<{ generalStartMin: number; generalEndMin: number }>();

  const startMin = cfg?.generalStartMin ?? 0;
  let endMin   = cfg?.generalEndMin   ?? 24 * 60;

  // handle wrap past midnight: if end <= start, add 24h
  if (endMin <= startMin) endMin += 24 * 60;

  // compute real shift end in UTC
  const shiftEnd = addUtcMinutes(availableDate, endMin);

  // inactivity end from "now"
  const inactivityEnd = new Date(Date.now() + inactivityMinutes * 60 * 1000);

  // expire at the earlier one
  return inactivityEnd < shiftEnd ? inactivityEnd : shiftEnd;
}
