import { Schema, model, InferSchemaType, HydratedDocument, Model } from "mongoose";
import toJSON from "../utils/toJSON";
import { isHttpUrl } from "../utils/urls";

// --- categories ---
export const itemCategories = ["fruit", "vegetable"] as const;
export type ItemCategory = (typeof itemCategories)[number];

// --- subtypes ---
const ABCSchema = new Schema(
  {
    A: { type: String, default: null, trim: true },
    B: { type: String, default: null, trim: true },
    C: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const QualityStandardsSchema = new Schema(
  {
    tolerance: { type: ABCSchema, default: undefined },
    brix: { type: ABCSchema, default: undefined },
    acidityPercentage: { type: ABCSchema, default: undefined },
    pressure: { type: ABCSchema, default: undefined },
    colorDescription: { type: ABCSchema, default: undefined },
    colorPercentage: { type: ABCSchema, default: undefined },
    weightPerUnit: { type: ABCSchema, default: undefined },
    weightPerUnitG: { type: ABCSchema, default: undefined },
    diameterMM: { type: ABCSchema, default: undefined },
    qualityGrade: { type: ABCSchema, default: undefined },
    maxDefectRatioLengthDiameter: { type: ABCSchema, default: undefined },
    rejectionRate: { type: ABCSchema, default: undefined },
  },
  { _id: false }
);

const PriceSchema = new Schema(
  {
    a: { type: Number, default: null, min: 0 },
    b: { type: Number, default: null, min: 0 },
    c: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

// --- main schema (ObjectId _id is implicit & auto-generated) ---
const ItemSchema = new Schema(
  {
    // NOTE: _id is NOT declared — Mongoose will use ObjectId by default.

    category: { type: String, enum: itemCategories, required: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    variety: { type: String, default: null, trim: true, index: true },

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

    price: { type: PriceSchema, default: undefined },

    avgWeightPerUnitGr: { type: Number, default: null, min: 0 },
    avgQmPerUnit: { type: Number, default: null, min: 0 },
    weightPerUnitG: { type: Number, default: null, min: 0 },

    qualityStandards: { type: QualityStandardsSchema, default: undefined },
    tolerance: { type: String, default: null, trim: true },

    count: { type: Number, default: null, min: 0 },

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
  // expose as string for clients
  return this._id?.toString();
});

ItemSchema.virtual("name").get(function (this: any) {
  const v = (this.variety ?? "").trim();
  return v ? `${this.type} ${v}` : this.type;
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

// Indexes
// (no need to re-index _id; Mongo already does that)
ItemSchema.index({ category: 1, type: 1, variety: 1 });

// --- inferred types & model ---
export type Item = InferSchemaType<typeof ItemSchema>;
export type ItemDoc = HydratedDocument<Item>;
export type ItemModel = Model<Item>;

export const Item = model<Item, ItemModel>("Item", ItemSchema);
export default Item;
