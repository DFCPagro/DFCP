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
import { QualityStandardsEggDairySchema } from "./shared/qualityStandardsEggDairy.schema";

// -----------------------------
// Categories
// -----------------------------
export const itemCategories = ["fruit", "vegetable", "egg_dairy", "other"] as const;
export type ItemCategory = (typeof itemCategories)[number];

// Public projection (for unauthenticated / low-privilege)
export const PUBLIC_ITEM_PROJECTION = {
  _id: 1,
  category: 1,
  type: 1,
  variety: 1,
  imageUrl: 1,
} as const;

// -----------------------------
// Price (A/B/C) — A is "base price per KG" for produce
// For egg/dairy, A/B/C are nulled in pre-validate (unit-only).
// -----------------------------
const PriceSchema = new Schema(
  {
    a: { type: Number, default: null, min: 0 },
    b: { type: Number, default: null, min: 0 },
    c: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

// -----------------------------
// Helpers (temp models for normalization)
// -----------------------------
const QSE_DEFAULT_MODEL = "__QSDefault_tmp__";
const QSE_EGGS_MODEL = "__QSEggDairy_tmp__";

function getOrCreateTempModel(name: string, schema: Schema) {
  const conn = mongoose.connection;
  return conn.models[name] || conn.model(name, schema);
}

// -----------------------------
// Main schema
// -----------------------------
const ItemSchema = new Schema(
  {
    // identity
    category: {
      type: String,
      enum: itemCategories,
      required: true,
      index: true,
    },
    type: { type: String, required: true, trim: true, index: true },
    variety: { type: String, default: null, trim: true, index: true },

    // media
    imageUrl: {
      type: String,
      default: null,
      trim: true,
      validate: { validator: isHttpUrl, message: "imageUrl must be a valid http(s) URL" },
    },

    // meta
    season: { type: String, default: null, trim: true },
    farmerTips: { type: String, default: null, trim: true },
    customerInfo: { type: [String], default: [] },
    caloriesPer100g: { type: Number, default: null, min: 0 },

    // pricing
    price: { type: PriceSchema, default: undefined },
    pricePerUnitOverride: { type: Number, default: null, min: 0 },

    // weight / area metadata
    avgWeightPerUnitGr: { type: Number, default: null, min: 0 }, // preferred
    sdWeightPerUnitGr: { type: Number, default: 0, min: 0 },
    avgQmPerUnit: { type: Number, default: null, min: 0 },
    weightPerUnitG: { type: Number, default: null, min: 0 }, // legacy alias

    // selling modes
    sellModes: {
      byKg: { type: Boolean, default: true },
      byUnit: { type: Boolean, default: false },
      unitBundleSize: { type: Number, default: 1, min: 1 },
    },

    // quality & tolerances
    // We store a single object, normalized to either produce QS or egg/dairy QS in pre-validate.
    qualityStandards: { type: Schema.Types.Mixed, default: undefined },
    tolerance: { type: String, default: "0.02", trim: true },

    // audit
    lastUpdated: { type: Date, default: () => new Date() },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    strict: true,
  }
);

// -----------------------------
// Plugins
// -----------------------------
ItemSchema.plugin(toJSON as any);

// -----------------------------
// Virtuals
// -----------------------------
ItemSchema.virtual("itemId").get(function (this: any) {
  return this._id?.toString();
});

ItemSchema.virtual("name").get(function (this: any) {
  const v = (this.variety ?? "").trim();
  return v ? `${this.type} ${v}` : this.type;
});

// Derived pricing
ItemSchema.virtual("pricePerKg").get(function (this: any) {
  // No KG pricing for egg/dairy (unit-only)
  if (this.category === "egg_dairy") return null;
  return this.price?.a ?? null;
});

ItemSchema.virtual("pricePerUnit").get(function (this: any) {
  // Egg/dairy: no KG-derivation — override only
  if (this.category === "egg_dairy") {
    return this.pricePerUnitOverride ?? null;
  }
  if (!this.sellModes?.byUnit) return null;
  if (this.pricePerUnitOverride != null) return this.pricePerUnitOverride;
  if (!this.price?.a || !this.avgWeightPerUnitGr) return null;
  return this.price.a * (this.avgWeightPerUnitGr / 1000); // derive from price/kg
});

ItemSchema.virtual("pricePerBundle").get(function (this: any) {
  if (!this.sellModes?.byUnit || !this.sellModes?.unitBundleSize) return null;
  const perUnit = this.pricePerUnit ?? null;
  return perUnit != null ? perUnit * this.sellModes.unitBundleSize : null;
});

type UnitMode = "kg" | "unit" | "mixed";
function deriveUnitMode(byKg?: boolean, byUnit?: boolean): UnitMode {
  const kg = byKg !== false; // default true if undefined
  const unit = !!byUnit;     // default false if undefined
  if (kg && unit) return "mixed";
  if (unit) return "unit";
  return "kg";
}

ItemSchema.virtual("unitMode").get(function (this: any): UnitMode {
  return deriveUnitMode(this.sellModes?.byKg, this.sellModes?.byUnit);
});

// Unified getter for whatever QS is stored post-normalization
ItemSchema.virtual("qualityStandardsResolved").get(function (this: any) {
  return this.qualityStandards ?? {};
});

// -----------------------------
// Hooks
// -----------------------------
ItemSchema.pre("save", function (next) {
  (this as any).lastUpdated = new Date();
  next();
});

ItemSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastUpdated: new Date() });
  next();
});

ItemSchema.pre("validate", function (next) {
  const doc = this as any;

  // Sync legacy -> preferred weight field
  if (doc.avgWeightPerUnitGr == null && doc.weightPerUnitG != null) {
    doc.avgWeightPerUnitGr = doc.weightPerUnitG;
  }

  // ── Category-specific: egg/dairy is unit-only ──────────────────────────────
  if (doc.category === "egg_dairy") {
    doc.sellModes = {
      ...(doc.sellModes || {}),
      byKg: false,
      byUnit: true,
      unitBundleSize: Math.max(1, doc.sellModes?.unitBundleSize ?? 12), // default dozen
    };

    // Ensure A/B/C are null for egg/dairy
    if (doc.price && typeof doc.price === "object") {
      doc.price.a = null;
      doc.price.b = null;
      doc.price.c = null;
    }
  }

  // Sell mode guardrails (for non-egg/dairy)
  const byKg = doc.sellModes?.byKg !== false; // default true
  const byUnit = !!doc.sellModes?.byUnit;     // default false
  if (!byKg && !byUnit) {
    doc.sellModes = {
      ...(doc.sellModes || {}),
      byKg: true,
      byUnit: false,
      unitBundleSize: Math.max(1, doc.sellModes?.unitBundleSize ?? 1),
    };
  }
  if (byUnit) {
    if (!doc.sellModes) doc.sellModes = {};
    if (!Number.isFinite(doc.sellModes.unitBundleSize) || doc.sellModes.unitBundleSize < 1) {
      doc.sellModes.unitBundleSize = 1;
    }
  }

  // Developer-friendly warning (non-blocking) for produce selling by unit with no weight
  const SHOULD_WARN =
    process.env.NODE_ENV !== "production" &&
    (process.env.ITEM_WARN_WEIGHT_MISSING ?? "1") !== "0";

  if (
    SHOULD_WARN &&
    byUnit &&
    doc.category !== "egg_dairy" &&
    doc.pricePerUnitOverride == null &&
    !doc.avgWeightPerUnitGr
  ) {
    console.warn(
      `[Item] byUnit enabled but avgWeightPerUnitGr missing (pricePerUnit will be null)`,
      { id: String(doc._id || ""), type: doc.type, variety: doc.variety ?? "" }
    );
  }

  // ── Normalize qualityStandards by category ─────────────────────────────────
  if (!doc.qualityStandards) doc.qualityStandards = {};

  if (doc.category === "egg_dairy") {
    const QSEgg = getOrCreateTempModel(QSE_EGGS_MODEL, QualityStandardsEggDairySchema);
    const tmp = new QSEgg(doc.qualityStandards);
    doc.qualityStandards = tmp.toObject();
  } else {
    const QSDefault = getOrCreateTempModel(QSE_DEFAULT_MODEL, QualityStandardsSchema);
    const tmp = new QSDefault(doc.qualityStandards);

    // Legacy compat in QS object (if someone used weightPerUnitG key)
    if ((tmp as any).weightPerUnit == null && (tmp as any).weightPerUnitG != null) {
      (tmp as any).weightPerUnit = (tmp as any).weightPerUnitG;
    }
    doc.qualityStandards = tmp.toObject();
  }

  (this as any).lastUpdated = new Date();
  next();
});

// -----------------------------
// Indexes
// -----------------------------
ItemSchema.index({ category: 1, type: 1, variety: 1 });

// -----------------------------
// Types & model
// -----------------------------
export type Item = InferSchemaType<typeof ItemSchema>;
export type ItemDoc = HydratedDocument<Item>;
export type ItemModel = Model<Item>;

export const Item = model<Item, ItemModel>("Item", ItemSchema);
export default Item;
