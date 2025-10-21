// src/models/availableMarketStock.model.ts
import { Schema, InferSchemaType, models, model, HydratedDocument } from "mongoose";
import toJSON from "../utils/toJSON";

export const SHIFT_NAMES = ["morning", "afternoon", "evening", "night"] as const;
export type ShiftName = (typeof SHIFT_NAMES)[number];

export const ITEM_STATUSES = ["active", "soldout", "removed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const UNIT_MODES = ["kg", "unit", "mixed"] as const;
export type UnitMode = (typeof UNIT_MODES)[number];

// -----------------------------
// Subschema for AMS items
// -----------------------------
const AvailableStockItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },

    displayName: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: null },
    category: { type: String, required: true, trim: true, index: true },

    // price.a from Item model (price per KG)
    pricePerKg:   { type: Number, required: true,  min: 0 }, // <— NEW explicit per-KG price from Item.price.a
    pricePerUnit: { type: Number, default: null,   min: 0 }, // <— now optional, only when unit/mixed
   
    currentAvailableQuantityKg: { type: Number, required: true, min: 0 },
    originalCommittedQuantityKg: { type: Number, required: true, min: 0 },

    farmerOrderId: { type: Schema.Types.ObjectId, ref: "FarmerOrder", default: null, index: true },

    farmerID: { type: Schema.Types.ObjectId, ref: "Farmer", required: true, index: true },
    farmerName: { type: String, required: true, trim: true },
    farmName: { type: String, required: true, trim: true },
    farmLogo: { type: String, default: null },

    // NEW: selling mode (by kg or units)
    unitMode: { type: String, enum: UNIT_MODES, default: "kg" },

    estimates: {
      avgWeightPerUnitKg: { type: Number, default: 0.5 }, // was avgWeightPerUnit
      sdKg: { type: Number, default:0.02 },             // sdKg in schema
      availableUnitsEstimate: { type: Number, default: 0 },

      // NEW: tuning & bundling (optional, safe defaults)
      unitBundleSize: { type: Number, default: 1, min: 1 }, // e.g., eggs 12
      zScore: { type: Number, default: 1.28 },              // conservatism
      shrinkagePct: { type: Number, default: 0.02 },        // handling loss
    },

    status: { type: String, enum: ITEM_STATUSES, default: "active", index: true },
  },
  { _id: false }
);


// Natural-number guarantee for units when present
AvailableStockItemSchema
  .path("estimates.availableUnitsEstimate")
  .validate(function (this: any, value: number | null) {
    if (value == null) return true; // not applicable for pure-kg lines
    return Number.isInteger(value) && value >= 0;
  }, "availableUnitsEstimate must be a natural integer");

// Keep as-is: qty <= committed constraint
AvailableStockItemSchema
  .path("currentAvailableQuantityKg")
  .validate(function (this: any, value: number) {
    return value <= this.originalCommittedQuantityKg;
  }, "currentAvailableQuantityKg cannot exceed originalCommittedQuantityKg");

// -----------------------------
// Root AMS schema
// -----------------------------
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

// Unique per LC + date + shift
AvailableMarketStockSchema.index(
  { LCid: 1, availableDate: 1, availableShift: 1 },
  { unique: true, name: "uniq_lc_date_shift" }
);

// Recompute units estimate automatically on every save (cheap & safe)
AvailableMarketStockSchema.pre("save", function (next) {
  const doc: any = this;
  if (!Array.isArray(doc.items)) return next();

  for (const it of doc.items) {
    const isUnity = it.unitMode === "unit" || it.unitMode === "mixed";
    const avg = it.estimates?.avgWeightPerUnitKg;
    if (!isUnity || !avg) {
      it.estimates && (it.estimates.availableUnitsEstimate = null);
      continue;
    }

    const sd = it.estimates?.sdKg ?? 0;
    const z = it.estimates?.zScore ?? 1.28;
    const shrink = it.estimates?.shrinkagePct ?? 0.02;
    const bundle = Math.max(1, it.estimates?.unitBundleSize ?? 1);

    const effKgPerUnit = avg + z * sd;              // conservative per-unit kg
    const usable = it.currentAvailableQuantityKg;   // canonical
    let est = usable > 0 ? Math.floor(usable / (effKgPerUnit * (1 + shrink))) : 0;
    est = Math.max(0, Math.floor(est / bundle) * bundle);  // bundle align
    it.estimates.availableUnitsEstimate = est;
  }
  next();
});

// Helpful nested indexes
AvailableMarketStockSchema.index({ "items.itemId": 1 });
AvailableMarketStockSchema.index({ "items.farmerID": 1 });

AvailableMarketStockSchema.plugin(toJSON);

// -----------------------------
// Types & Model
// -----------------------------
export type AvailableMarketStock = InferSchemaType<typeof AvailableMarketStockSchema>;
export type AvailableMarketStockDoc = HydratedDocument<AvailableMarketStock>;
export type AmsItem = InferSchemaType<typeof AvailableStockItemSchema>;
export { AvailableStockItemSchema };
export const AvailableMarketStockModel =
  models.AvailableMarketStock ||
  model<AvailableMarketStock>("AvailableMarketStock", AvailableMarketStockSchema);

export default AvailableMarketStockModel;
