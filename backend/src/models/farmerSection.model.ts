// models/farmerSection.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model } from "mongoose";
import toJSON from "../utils/toJSON";

// ---------- Crop status type ----------
export type CropStatus =
  | "planting"
  | "growing"
  | "readyForHarvest"
  | "clearing"
  | "problem";

// ---------- Sub-schema: SectionCrop ----------
const SectionCropSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    plantedAmount: { type: Number, required: true, min: 0 },
    plantedOnDate: { type: String, default: null, trim: true },

    status: {
      type: String,
      enum: ["planting", "growing", "readyForHarvest", "clearing", "problem"],
      required: true,
    },

    avgRatePerUnit: { type: Number, default: null, min: 0 },
    expectedFruitingPerPlant: { type: Number, default: null, min: 0 },

    expectedHarvestDate: { type: String, default: null, trim: true },
    statusPercentage: { type: Number, default: null, min: 0, max: 100 },
    expectedHarvestKg: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

// ---------- Main schema ----------
const FarmerSectionSchema = new Schema(
  {
    land: { type: Schema.Types.ObjectId, ref: "FarmerLand", required: true, index: true },
    lengthM: { type: Number, default: null, min: 0 },
    widthM: { type: Number, default: null, min: 0 },

    matrix: { type: Schema.Types.Mixed, default: undefined }, // flexible placeholder
    crops: { type: [SectionCropSchema], default: [] },

    // link to logistic center for routing
    logisticCenterId: { type: String, default: null, index: true },

    // track the remaining amount farmer can still supply (kg)
    agreementAmountKg: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Plugins & indexes
FarmerSectionSchema.plugin(toJSON as any);
FarmerSectionSchema.index({ land: 1, createdAt: -1 });
FarmerSectionSchema.index({ "crops.item": 1 });
FarmerSectionSchema.index({ logisticCenterId: 1 });

// ---------- Inferred types ----------
export type SectionCrop = InferSchemaType<typeof SectionCropSchema>;
export type FarmerSection = InferSchemaType<typeof FarmerSectionSchema>;
export type FarmerSectionDoc = HydratedDocument<FarmerSection>;
export type FarmerSectionModel = Model<FarmerSection>;

// ---------- Model ----------
export const FarmerSection = model<FarmerSection, FarmerSectionModel>(
  "FarmerSection",
  FarmerSectionSchema
);
export default FarmerSection;
