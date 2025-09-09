// models/Item.ts
import mongoose, { Schema, Model, Document } from "mongoose";
import toJSON from "../utils/toJSON";

export const itemCategories = ["fruit", "vegetable"] as const;
export type ItemCategory = typeof itemCategories[number];

export interface IABCScale {
  A?: string | null;
  B?: string | null;
  C?: string | null;
}



export interface IQualityStandards {
  tolerance?: string | null;
  brix?: IABCScale;
  acidityPercentage?: IABCScale;
  pressure?: IABCScale;
  colorDescription?: IABCScale;
  colorPercentage?: IABCScale;
  weightPerUnit?: IABCScale;
  diameterMM?: IABCScale;
  qualityGrade?: IABCScale;
  maxDefectRatioLengthDiameter?: IABCScale;
}
 //rejectionRate?: IABCScale;
const ABCSchema = new Schema<IABCScale>(
  {
    A: { type: Schema.Types.String, default: null, trim: true },
    B: { type: Schema.Types.String, default: null, trim: true },
    C: { type: Schema.Types.String, default: null, trim: true },
  },
  { _id: false }
);
export interface IItem extends Document {
  itemId: string;                 // unique code (e.g., FRT-001)
  category: ItemCategory;         // "fruit" | "vegetable"

  // split name into type + variety
  type: string;                   // e.g., "Apple", "Tomato"
  variety?: string | null;        // e.g., "Fuji", "Roma"

  pictureUrl?: string | null;
  season?: string | null;         // e.g., "November–March"
  farmerTips?: string | null;
  customerInfo?: string[];        // bullets for customers
  caloriesPer100g?: number | null;

  qualityStandards?: IQualityStandards | null;
  price: number | null; 
  // metadata
  lastUpdated: Date;              // mirrors updatedAt for your API
  createdAt: Date;
  updatedAt: Date;

  // virtual (read-only): legacy display name "type + variety"
  name?: string;  
        
}



const QualityStandardsSchema = new Schema<IQualityStandards>(
  {
    tolerance: { type: Schema.Types.String, default: null, trim: true },
    brix: { type: ABCSchema, default: undefined },
    acidityPercentage: { type: ABCSchema, default: undefined },
    pressure: { type: ABCSchema, default: undefined },
    colorDescription: { type: ABCSchema, default: undefined },
    colorPercentage: { type: ABCSchema, default: undefined },
    weightPerUnit: { type: ABCSchema, default: undefined },
    diameterMM: { type: ABCSchema, default: undefined },
    qualityGrade: { type: ABCSchema, default: undefined },
    maxDefectRatioLengthDiameter: { type: ABCSchema, default: undefined },

  },
  { _id: false }
);

// Lightweight URL validator
const urlValidator = {
  validator: (v?: string | null) =>
    v == null ||
    /^https?:\/\/[-a-zA-Z0-9@:%._+~#=]{1,256}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/.test(v),
  message: "pictureUrl must be a valid http(s) URL",
};

const ItemSchema = new Schema<IItem>(
  {
    itemId: {
      type: Schema.Types.String,
      required: true,
      unique: true,
      trim: true,
    },
    category: {
      type: Schema.Types.String,
      enum: itemCategories,
      required: true,
      index: true,
    },

    type: { type: Schema.Types.String, required: true, trim: true, index: true },
    variety: { type: Schema.Types.String, default: null, trim: true, index: true },

    pictureUrl: { type: Schema.Types.String, default: null, trim: true, validate: urlValidator },
    season: { type: Schema.Types.String, default: null, trim: true },
    farmerTips: { type: Schema.Types.String, default: null, trim: true },
    customerInfo: { type: [Schema.Types.String], default: [] },
    caloriesPer100g: { type: Schema.Types.Number, default: null, min: 0 },

    qualityStandards: { type: QualityStandardsSchema, default: undefined },
    price: { type: ABCSchema, default: undefined },
    lastUpdated: { type: Schema.Types.Date, default: () => new Date() },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Plugins
ItemSchema.plugin(toJSON as any);

// Virtual: legacy display name "type + variety"
ItemSchema.virtual("name").get(function (this: IItem) {
  const v = (this.variety ?? "").trim();
  return v ? `${this.type} ${v}` : this.type;
});

// Keep lastUpdated in sync on .save()
ItemSchema.pre("save", function (next) {
  (this as IItem).lastUpdated = new Date();
  next();
});

// Also sync lastUpdated on findOneAndUpdate()
ItemSchema.pre("findOneAndUpdate", function (next) {
  this.set({ lastUpdated: new Date() });
  next();
});

// Indexes
ItemSchema.index({ itemId: 1 }, { unique: true });
ItemSchema.index({ category: 1, type: 1, variety: 1 }); // common query path

export const Item: Model<IItem> = mongoose.model<IItem>("Item", ItemSchema);
export default Item;
