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

// --- hooks ---
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
  const qs = doc.qualityStandards;
  if (qs && !qs.weightPerUnit && qs.weightPerUnitG) {
    qs.weightPerUnit = qs.weightPerUnitG;
  }
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
