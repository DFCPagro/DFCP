import mongoose, { Schema, Types, Document, Model } from "mongoose";
import toJSON from "../utils/toJSON";

export type CropStatus = "notReady" | "ready" | "cleaning";

export interface ISectionCrop {
  item: Types.ObjectId;               // ref -> Item (or Product) collection
  plantedAmount: number;              // integer-like
  plantedOnDate?: string | null;      // keep as STRING per your spec
  status: CropStatus;                 // notReady | ready | cleaning
  avgRatePerUnit?: number | null;
  expectedFruitingPerPlant?: number | null;
}

export interface IFarmerSection extends Document {
  land: Types.ObjectId;               // ref -> FarmerLand (required)
  widthM?: number | null;              // optional area for this section
  lengthM?: number | null;              // optional area for this section
  matrix?: any;                       // placeholder; keep flexible
  crops: ISectionCrop[];              // embedded crops
  createdAt: Date;
  updatedAt: Date;
}

const SectionCropSchema = new Schema<ISectionCrop>(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    plantedAmount: { type: Schema.Types.Number, required: true, min: 0 },
    plantedOnDate: { type: Schema.Types.String, default: null, trim: true },
    status: { type: Schema.Types.String, enum: ["planting", "growing", "readyForHarvest", "cleaning"], required: true },
    avgRatePerUnit: { type: Schema.Types.Number, default: null, min: 0 },
    expectedFruitingPerPlant: { type: Schema.Types.Number, default: null, min: 0 },
  },
  { _id: false }
);

const FarmerSectionSchema = new Schema<IFarmerSection>(
  {
    land: { type: Schema.Types.ObjectId, ref: "FarmerLand", required: true, index: true },
    lengthM: { type: Schema.Types.Number, default: null, min: 0 },
    widthM: { type: Schema.Types.Number, default: null, min: 0 },
    matrix: { type: Schema.Types.Mixed, default: undefined }, // reserved for future structure
    crops: { type: [SectionCropSchema], default: [] },
  },
  { timestamps: true }
);

FarmerSectionSchema.plugin(toJSON as any);

// Helpful for queries like "all sections for a land" and crop lookups
FarmerSectionSchema.index({ land: 1, createdAt: -1 });
FarmerSectionSchema.index({ "crops.item": 1 });

export const FarmerSection: Model<IFarmerSection> =
  mongoose.model<IFarmerSection>("FarmerSection", FarmerSectionSchema);

export default FarmerSection;
