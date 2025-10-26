// src/models/Item.model.ts
import mongoose, {
  Schema,
  model,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";
import toJSON from "../utils/toJSON";
import { isHttpUrl } from "../utils/urls";
import { QualityStandardsSchema } from "./shared/qualityStandards.schema";
import { QualityStandardsEggDairySchema } from "./shared/qualityStandardsEggDairy.schema"; // ← create empty placeholder schema

// --- categories ---
export const itemCategories = [
  "fruit",
  "vegetable",
  "egg_dairy",
  "other",
] as const;
export type ItemCategory = (typeof itemCategories)[number];

// public projection (used for unauthenticated + non-privileged users)
export const PUBLIC_ITEM_PROJECTION = {
  _id: 1,
  category: 1,
  type: 1,
  variety: 1,
} as const;

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
    category: {
      type: String,
      enum: itemCategories,
      required: true,
      index: true,
    },
    type: { type: String, required: true, trim: true, index: true },
    // variety optional; your `name` virtual already handles it
    variety: {
      type: String,
      required: false,
      default: null,
      trim: true,
      index: true,
    },

    imageUrl: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: isHttpUrl,
        message: "imageUrl must be a valid http(s) URL",
      },
    },

    season: { type: String, default: null, trim: true },
    farmerTips: { type: String, default: null, trim: true },
    customerInfo: { type: [String], default: [] },
    caloriesPer100g: { type: Number, default: null, min: 0 },

    // --- pricing ---
    price: { type: PriceSchema, default: undefined },

    // --- weight/area metadata ---
    avgWeightPerUnitGr: { type: Number, default: null, min: 0 }, // average weight per unit in grams
    sdWeightPerUnitGr: { type: Number, default: 0, min: 0 }, // standard deviation (optional)
    avgQmPerUnit: { type: Number, default: null, min: 0 }, // optional: average square meter per unit
    weightPerUnitG: { type: Number, default: null, min: 0 }, // legacy support (aliases avgWeightPerUnitGr)

    // --- selling modes ---
    sellModes: {
      byKg: { type: Boolean, default: true },
      byUnit: { type: Boolean, default: false }, // enable unit view / sale
      unitBundleSize: { type: Number, default: 1, min: 1 }, // e.g. eggs sold by 12s
    },

    // --- optional price overrides for unit sales ---
    pricePerUnitOverride: { type: Number, default: null, min: 0 },

    // --- quality & tolerances ---
    // Use Mixed here; we normalize to category-specific shapes in pre-validate
    qualityStandards: { type: Schema.Types.Mixed, default: undefined },
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
  // No KG for egg_dairy
  if (this.category === "egg_dairy") return null;
  return this.price?.a ?? null;
});

ItemSchema.virtual("pricePerUnit").get(function (this: any) {
  // Eggs & dairy: no KG-derived unit price — override only
  if (this.category === "egg_dairy") {
    return this.pricePerUnitOverride ?? null;
  }
  if (!this.sellModes?.byUnit) return null;
  if (this.pricePerUnitOverride != null) return this.pricePerUnitOverride;
  if (!this.price?.a || !this.avgWeightPerUnitGr) return null;
  return this.price.a * (this.avgWeightPerUnitGr / 1000); // derived from price per KG
});

// Convenience for bundle pricing on the API (e.g., 12-pack)
ItemSchema.virtual("pricePerBundle").get(function (this: any) {
  if (!this.sellModes?.byUnit || !this.sellModes?.unitBundleSize) return null;
  const perUnit = this.pricePerUnit ?? null;
  return perUnit != null ? perUnit * this.sellModes.unitBundleSize : null;
});

// Put near other virtuals
type UnitMode = "kg" | "unit" | "mixed";
function deriveUnitMode(byKg?: boolean, byUnit?: boolean): UnitMode {
  const kg = byKg !== false; // default true if undefined
  const unit = !!byUnit; // default false if undefined
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

  // ── Category-specific guardrails: EGG/DAIRY is UNIT-ONLY ───────────────────
  if (doc.category === "egg_dairy") {
    // Force selling modes: byUnit=true, byKg=false
    doc.sellModes = {
      ...(doc.sellModes || {}),
      byKg: false,
      byUnit: true,
      unitBundleSize: Math.max(1, doc.sellModes?.unitBundleSize ?? 12), // default dozen
    };
    // Ensure no KG pricing is stored/used
    if (doc.price && typeof doc.price === "object") {
      doc.price.a = null;
      doc.price.b = null;
      doc.price.c = null;
    }
  }

  // ---- sellModes guardrails ----
  const byKg = doc.sellModes?.byKg !== false; // default true
  const byUnit = !!doc.sellModes?.byUnit; // default false

  // Ensure at least one mode is enabled (for non-egg categories this can flip to KG)
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
    if (
      !Number.isFinite(doc.sellModes.unitBundleSize) ||
      doc.sellModes.unitBundleSize < 1
    ) {
      doc.sellModes.unitBundleSize = 1;
    }
  }

  // ---- friendly nudge (optional) ----
  // If by-unit is enabled but no override AND no avgWeight, pricePerUnit will be null.
  // This does not block the save; it only warns in dev/when enabled.
  // You can disable via ITEM_WARN_WEIGHT_MISSING=0 env var.
  const SHOULD_WARN =
    process.env.NODE_ENV !== "production" &&
    (process.env.ITEM_WARN_WEIGHT_MISSING ?? "1") !== "0";

  if (
    SHOULD_WARN &&
    byUnit &&
    doc.category !== "egg_dairy" && // for eggs, override is expected; skip this warn
    doc.pricePerUnitOverride == null &&
    !doc.avgWeightPerUnitGr
  ) {
    console.warn(
      `[Item] byUnit enabled but avgWeightPerUnitGr missing (pricePerUnit will be null):`,
      { id: String(doc._id || ""), type: doc.type, variety: doc.variety ?? "" }
    );
  }

  // ---- category-specific QS normalization (empty for egg_dairy for now) ----
  // We transform the user-provided object to match a category schema.
  function getOrCreateTempModel(name: string, schema: Schema) {
    return mongoose.models[name] || mongoose.model(name, schema);
  }

  if (doc.category === "egg_dairy") {
    if (!doc.qualityStandards) doc.qualityStandards = {};
    const QSEgg = getOrCreateTempModel(
      "QSEggDairy_tmp",
      QualityStandardsEggDairySchema
    );
    const tmp = new QSEgg(doc.qualityStandards);
    doc.qualityStandards = tmp.toObject();
  } else if (doc.category === "fruit" || doc.category === "vegetable") {
    if (!doc.qualityStandards) doc.qualityStandards = {};
    const QSDefault = getOrCreateTempModel(
      "QSDefault_tmp",
      QualityStandardsSchema
    );
    const tmp = new QSDefault(doc.qualityStandards);
    // legacy compatibility
    if (tmp.weightPerUnit == null && (tmp as any).weightPerUnitG != null) {
      (tmp as any).weightPerUnit = (tmp as any).weightPerUnitG;
    }
    doc.qualityStandards = tmp.toObject();
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
