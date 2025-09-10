// src/models/Item.model.ts
import mongoose, { Schema, Model, Document } from "mongoose";
import toJSON from "../utils/toJSON";
import { isHttpUrl } from "../utils/urls"

export const itemCategories = ["fruit", "vegetable"] as const;
export type ItemCategory = (typeof itemCategories)[number];

export interface IABCScale {
  A?: string | null;
  B?: string | null;
  C?: string | null;
}

export interface IQualityStandards {
  // CHANGED: tolerance is an ABC scale (matches your JSON)
  tolerance?: IABCScale;
  brix?: IABCScale;
  acidityPercentage?: IABCScale;
  pressure?: IABCScale;
  colorDescription?: IABCScale;
  colorPercentage?: IABCScale;
  // keep both keys to be flexible with incoming data
  weightPerUnit?: IABCScale;
  weightPerUnitG?: IABCScale; // your JSON key
  diameterMM?: IABCScale;
  qualityGrade?: IABCScale;
  maxDefectRatioLengthDiameter?: IABCScale;
  // ADDED: present in your JSON
  rejectionRate?: IABCScale;
}

export interface IPriceTier {
  a?: number | null;
  b?: number | null;
  c?: number | null;
}

export interface IItem extends Document {
  _id: string; // "FRT-001" (stored as Mongo _id)
  itemId?: string; // virtual alias to _id

  category: ItemCategory;
  type: string;
  variety?: string | null;

  imageUrl?: string | null;
  season?: string | null;
  farmerTips?: string | null;
  customerInfo?: string[];
  caloriesPer100g?: number | null;

  price?: IPriceTier | null;

  avgWeightPerUnitGr?: number | null;
  avgQmPerUnit?: number | null;
  weightPerUnitG?: number | null;

  qualityStandards?: IQualityStandards | null;
  tolerance?: string | null; // top-level tolerance in your data (keep)

  count?: number | null;

  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;

  name?: string; // "type variety"
}

const ABCSchema = new Schema<IABCScale>(
  {
    A: { type: String, default: null, trim: true },
    B: { type: String, default: null, trim: true },
    C: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const QualityStandardsSchema = new Schema<IQualityStandards>(
  {
    tolerance: { type: ABCSchema, default: undefined }, // CHANGED
    brix: { type: ABCSchema, default: undefined },
    acidityPercentage: { type: ABCSchema, default: undefined },
    pressure: { type: ABCSchema, default: undefined },
    colorDescription: { type: ABCSchema, default: undefined },
    colorPercentage: { type: ABCSchema, default: undefined },
    weightPerUnit: { type: ABCSchema, default: undefined },  // legacy
    weightPerUnitG: { type: ABCSchema, default: undefined }, // JSON key
    diameterMM: { type: ABCSchema, default: undefined },
    qualityGrade: { type: ABCSchema, default: undefined },
    maxDefectRatioLengthDiameter: { type: ABCSchema, default: undefined },
    rejectionRate: { type: ABCSchema, default: undefined },  // ADDED
  },
  { _id: false }
);

// numeric price tiers
const PriceSchema = new Schema(
  {
    a: { type: Number, default: null, min: 0 },
    b: { type: Number, default: null, min: 0 },
    c: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const ItemSchema = new Schema<IItem>(
  {
    _id: { type: String, required: true },
    category: { type: String, enum: itemCategories, required: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    variety: { type: String, default: null, trim: true, index: true },

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

    price: { type: PriceSchema, default: undefined },

    avgWeightPerUnitGr: { type: Number, default: null, min: 0 },
    avgQmPerUnit: { type: Number, default: null, min: 0 },
    weightPerUnitG: { type: Number, default: null, min: 0 },

    qualityStandards: { type: QualityStandardsSchema, default: undefined },
    tolerance: { type: String, default: null, trim: true }, // top-level

    count: { type: Number, default: null, min: 0 },

    lastUpdated: { type: Date, default: () => new Date() },
  },
  {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    strict: true,
  }
);

// plugin
ItemSchema.plugin(toJSON as any);

// Virtuals
ItemSchema.virtual("itemId").get(function (this: IItem) {
  return this._id;
});

ItemSchema.virtual("name").get(function (this: IItem) {
  const v = (this.variety ?? "").trim();
  return v ? `${this.type} ${v}` : this.type;
});

// Keep lastUpdated current
ItemSchema.pre("save", function (next) {
  (this as IItem).lastUpdated = new Date();
  next();
});
ItemSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastUpdated: new Date() });
  next();
});

// Normalize: if only weightPerUnitG present, mirror to weightPerUnit for back-compat (optional)
ItemSchema.pre("validate", function (next) {
  const doc = this as any;
  const qs = doc.qualityStandards;
  if (qs && !qs.weightPerUnit && qs.weightPerUnitG) {
    qs.weightPerUnit = qs.weightPerUnitG;
  }
  next();
});

// Indexes
ItemSchema.index({ _id: 1 }, { unique: true });
ItemSchema.index({ category: 1, type: 1, variety: 1 });

export const Item: Model<IItem> = mongoose.model<IItem>("Item", ItemSchema);
export default Item;
