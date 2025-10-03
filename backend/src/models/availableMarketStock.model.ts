// src/models/availableMarketStock.model.ts
import { Schema, InferSchemaType, models, model, HydratedDocument } from "mongoose";
import toJSON from "../utils/toJSON";

export const SHIFT_NAMES = ["morning", "afternoon", "evening", "night"] as const;
export type ShiftName = (typeof SHIFT_NAMES)[number];

export const ITEM_STATUSES = ["active", "soldout", "removed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

const AvailableStockItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },

    displayName: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: null },
    category: { type: String, required: true, trim: true, index: true },

    pricePerUnit: { type: Number, required: true, min: 0 },

    currentAvailableQuantityKg: { type: Number, required: true, min: 0 },
    originalCommittedQuantityKg: { type: Number, required: true, min: 0 },

    farmerOrderId: { type: Schema.Types.ObjectId, ref: "FarmerOrder", default: null, index: true },

    farmerID: { type: Schema.Types.ObjectId, ref: "Farmer", required: true, index: true },
    farmerName: { type: String, required: true, trim: true },
    farmName: { type: String, required: true, trim: true },
    farmLogo:{type: String, required: false},

    status: { type: String, enum: ITEM_STATUSES, default: "active", index: true },
  },
  { _id: true }
);

AvailableStockItemSchema
  .path("currentAvailableQuantityKg")
  .validate(function (this: any, value: number) {
    return value <= this.originalCommittedQuantityKg;
  }, "currentAvailableQuantityKg cannot exceed originalCommittedQuantityKg");

export type AvailableStockItem = InferSchemaType<typeof AvailableStockItemSchema>;

const AvailableMarketStockSchema = new Schema(
  {
    availableDate: { type: Date, required: true, index: true },
    availableShift: { type: String, enum: SHIFT_NAMES, required: true, index: true },

    LCid: { type: Schema.Types.ObjectId, ref: "LogisticCenter", required: true, index: true },

    createdById: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    items: { type: [AvailableStockItemSchema], default: [] },
  },
  { timestamps: true }
);

// Normalize date to 00:00 UTC
AvailableMarketStockSchema.pre("validate", function (next) {
  if (this.availableDate) {
    const d = new Date(this.availableDate);
    d.setUTCHours(0, 0, 0, 0);
    this.availableDate = d;
  }
  next();
});

// Uniqueness per LC+date+shift
AvailableMarketStockSchema.index({ LCid: 1, availableDate: 1, availableShift: 1 }, { unique: true, name: "uniq_lc_date_shift" });

// Helpful nested indexes
AvailableMarketStockSchema.index({ "items.itemId": 1 });
AvailableMarketStockSchema.index({ "items.farmerID": 1 });

AvailableMarketStockSchema.plugin(toJSON);

export type AvailableMarketStock = InferSchemaType<typeof AvailableMarketStockSchema>;
export type AvailableMarketStockDoc = HydratedDocument<AvailableMarketStock>;

export const AvailableMarketStockModel =
  models.AvailableMarketStock || model<AvailableMarketStock>("AvailableMarketStock", AvailableMarketStockSchema);

export default AvailableMarketStockModel;
