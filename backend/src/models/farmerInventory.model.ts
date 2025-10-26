// models/farmer.model.ts
import {
  Schema,
  model,
  InferSchemaType,
  HydratedDocument,
  Model,
  Types,
} from "mongoose";
import toJSON from "../utils/toJSON";

const FarmerInventorySchema = new Schema(
  {
    itemId: {
      type: String,
      required: true,
      index: true,
    },
    farmerUserId: {
      type: String,
      required: true,
      index: true,
    },
    logisticCenterId: { type: String, default: null },
    agreementAmountKg: { type: Number, default: 0, min: 0 },
    currentAvailableAmountKg: { type: Number, default: 0, min: 0 },
    
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Plugins
FarmerInventorySchema.plugin(toJSON as any);

// Helpful compound index
FarmerInventorySchema.index({ itemId: 1, farmerId: 1 });

/**
 * Inferred types
 */
export type FarmerInventory = InferSchemaType<typeof FarmerInventorySchema>;
export type FarmerDoc = HydratedDocument<FarmerInventory>;
export type FarmerModel = Model<FarmerInventory>;

/**
 * Model
 */
export const FarmerInventory = model<FarmerInventory, FarmerModel>(
  "FarmerInventory",
  FarmerInventorySchema
);
export default FarmerInventory;
