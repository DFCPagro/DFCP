// models/farmer.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model, Types } from "mongoose";
import toJSON from "../utils/toJSON";

/**
 * Farmer schema
 * - Links back to a User (optional)
 * - Holds farm-level metadata
 * - References FarmerLand documents (1..n)
 */
const FarmerSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    agriculturalInsurance: {
      type: Boolean,
      default: false,
      index: true,
    },

    farmName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    farmLogo:{
      type: String,
      required: false,
    },
    
    farmerInfo: {
      type: String,
      required: false,//the farmers story/infomertial
      trim: true,
      
    },
    agreementPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 60,
    },

    lands: {
      type: [Schema.Types.ObjectId],
      ref: "FarmerLand",
      default: [],
      validate: {
        validator: (arr: Types.ObjectId[]) => Array.isArray(arr) && arr.length > 0,
        message: "A farmer must reference at least one land.",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Plugins
FarmerSchema.plugin(toJSON as any);

// Helpful compound index
FarmerSchema.index({ farmName: 1, user: 1 });

/**
 * Inferred types
 */
export type Farmer = InferSchemaType<typeof FarmerSchema>;
export type FarmerDoc = HydratedDocument<Farmer>;
export type FarmerModel = Model<Farmer>;

/**
 * Model
 */
export const Farmer = model<Farmer, FarmerModel>("Farmer", FarmerSchema);
export default Farmer;
