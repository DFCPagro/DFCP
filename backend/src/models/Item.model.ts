import { Schema, model, InferSchemaType, HydratedDocument, Model } from "mongoose";
import toJSON from "../utils/toJSON";
import { isHttpUrl } from "../utils/urls";
import { QualityStandardsSchema } from "./shared/qualityStandards.schema";

// --- categories ---
export const itemCategories = ["fruit", "vegetable"] as const;
export type ItemCategory = (typeof itemCategories)[number];

// public projection (used for unauthenticated + non-privileged users)
export const PUBLIC_ITEM_PROJECTION = { _id: 1, category: 1, type: 1, variety: 1 } as const;

// --- price schema ---
const PriceSchema = new Schema(
  {
    a: { type: Number, default: null, min: 0 }, // base price per KG
    b: { type: Number, default: null, min: 0 },
    c: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

// --- main schema ---
const ItemSchema = new Schema(
  {
    category: { type: String, enum: itemCategories, required: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    variety: { type: String, required: true, default: null, trim: true, index: true },

    imageUrl: {
      type: String,
      default: null,
      trim: true,
      validate: { validator: isHttpUrl, message: "imageUrl must be a valid http(s) URL" },
    },

    season: { type: String, default: null, trim: true },
    farmerTips: { type: String, default: null, trim: true },
    customerInfo: { type: [String], default: [] },
    caloriesPer100g: { type: Number, default: null, min: 0 },

    // --- pricing ---
    price: { type: PriceSchema, default: undefined },

    // --- weight/area metadata ---
    avgWeightPerUnitGr: { type: Number, default: null, min: 0 },  // average weight per unit in grams
    sdWeightPerUnitGr: { type: Number, default: 0, min: 0 },      // standard deviation (optional)
    avgQmPerUnit: { type: Number, default: null, min: 0 },        // optional: average square meter per unit
    weightPerUnitG: { type: Number, default: null, min: 0 },      // legacy support (aliases avgWeightPerUnitGr)

    // --- selling modes ---
    sellModes: {
      byKg: { type: Boolean, default: true },
      byUnit: { type: Boolean, default: false },       // enable unit view / sale
      unitBundleSize: { type: Number, default: 1 },    // e.g. eggs sold by 12s
    },

    // --- optional price overrides for unit sales ---
    pricePerUnitOverride: { type: Number, default: null, min: 0 },

    // --- quality & tolerances ---
    qualityStandards: { type: QualityStandardsSchema, default: undefined },
    tolerance: { type: String, default: "0.02", trim: true },

    // --- audit & housekeeping ---
    lastUpdated: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    strict: true,
  }
);

// plugin
ItemSchema.plugin(toJSON as any);

// --- virtuals ---
ItemSchema.virtual("itemId").get(function (this: any) {
  return this._id?.toString();
});

ItemSchema.virtual("name").get(function (this: any) {
  const v = (this.variety ?? "").trim();
  return v ? `${this.type} ${v}` : this.type;
});

// derived virtuals for pricing
ItemSchema.virtual("pricePerKg").get(function (this: any) {
  return this.price?.a ?? null;
});

ItemSchema.virtual("pricePerUnit").get(function (this: any) {
  if (!this.sellModes?.byUnit) return null;
  if (this.pricePerUnitOverride != null) return this.pricePerUnitOverride;
  if (!this.price?.a || !this.avgWeightPerUnitGr) return null;
  return this.price.a * (this.avgWeightPerUnitGr / 1000); // derived from price per KG
});

// Put near other virtuals
type UnitMode = "kg" | "unit" | "mixed";
function deriveUnitMode(byKg?: boolean, byUnit?: boolean): UnitMode {
  const kg = byKg !== false;   // default true if undefined
  const unit = !!byUnit;       // default false if undefined
  if (kg && unit) return "mixed";
  if (unit) return "unit";
  return "kg";
}

ItemSchema.virtual("unitMode").get(function (this: any): UnitMode {
  return deriveUnitMode(this.sellModes?.byKg, this.sellModes?.byUnit);
});


// --- hooks ---
ItemSchema.pre("save", function (next) {
  (this as any).lastUpdated = new Date();
  next();
});

ItemSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastUpdated: new Date() });
  next();
});


/*
→ Enforces sane defaults and cleans data before saving
→ Makes sure you never have an invalid combination (like both false, or negative bundle size, etc.)
*/

ItemSchema.pre("validate", function (next) {
  const doc = this as any;

  // ---- sellModes guardrails ----
  const byKg = doc.sellModes?.byKg !== false;       // default true
  const byUnit = !!doc.sellModes?.byUnit;           // default false

  // Ensure at least one mode is enabled
  if (!byKg && !byUnit) {
    doc.sellModes = {
      ...(doc.sellModes || {}),
      byKg: true,
      byUnit: false,
      unitBundleSize: Math.max(1, doc.sellModes?.unitBundleSize ?? 1),
    };
  }

  // Unit sales sanity: bundle >= 1
  if (byUnit) {
    if (!doc.sellModes) doc.sellModes = {};
    if (!Number.isFinite(doc.sellModes.unitBundleSize) || doc.sellModes.unitBundleSize < 1) {
      doc.sellModes.unitBundleSize = 1;
    }
  }

  // ---- friendly nudge (optional) ----
  // If by-unit is enabled but no override AND no avgWeight, pricePerUnit will be null.
  // This does not block the save; it only warns in dev/when enabled.
  // You can disable via ITEM_WARN_WEIGHT_MISSING=0 env var.
  //ps doesnt block the save it just warns in dev when enabled
  const SHOULD_WARN =
    process.env.NODE_ENV !== "production" && // only warn outside prod by default
    (process.env.ITEM_WARN_WEIGHT_MISSING ?? "1") !== "0"; // can disable via env

  if (SHOULD_WARN && byUnit && doc.pricePerUnitOverride == null && !doc.avgWeightPerUnitGr) {
    // keep it short & useful
    console.warn(
      `[Item] byUnit enabled but avgWeightPerUnitGr missing (pricePerUnit will be null):`,
      { id: String(doc._id || ""), type: doc.type, variety: doc.variety ?? "" }
    );
  }

  // legacy qualityStandards compatibility (your existing bit)
  const qs = doc.qualityStandards;
  if (qs && !qs.weightPerUnit && qs.weightPerUnitG) {
    qs.weightPerUnit = qs.weightPerUnitG;
  }

  (this as any).lastUpdated = new Date();
  next();
});


// --- indexes ---
ItemSchema.index({ category: 1, type: 1, variety: 1 });

// --- inferred types & model ---
export type Item = InferSchemaType<typeof ItemSchema>;
export type ItemDoc = HydratedDocument<Item>;
export type ItemModel = Model<Item>;

export const Item = model<Item, ItemModel>("Item", ItemSchema);
export default Item;
