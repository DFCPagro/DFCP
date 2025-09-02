import mongoose, { Schema, Types, Document, Model } from "mongoose";
import toJSON from "../utils/toJSON";

export interface IFarmer extends Document {
  user?: Types.ObjectId | null;           // optional link to a User
  agriculturalInsurance: boolean;         // normalized spelling
  farmName: string;
  agreementPercentage: number;            // default 60
  lands: Types.ObjectId[];                // refs -> FarmerLand._id
  createdAt: Date;
  updatedAt: Date;
}

const FarmerSchema = new Schema<IFarmer>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    agriculturalInsurance: { type: Schema.Types.Boolean, default: false, index: true },

    farmName: { type: Schema.Types.String, required: true, trim: true, index: true },

    agreementPercentage: { type: Schema.Types.Number, min: 0, max: 100, default: 60 },

    // Array of references to FarmerLand documents
    lands: {
      type: [Schema.Types.ObjectId],
      ref: "FarmerLand",
      default: [],
      // If you want to enforce "at least one land" at the DB layer, uncomment:
      validate: {
        validator: (arr: Types.ObjectId[]) => Array.isArray(arr) && arr.length > 0,
        message: "A farmer must reference at least one land.",
      },
    },
  },
  { timestamps: true }
);

// Common JSON transform (hides __v, renames _id, etc.)
FarmerSchema.plugin(toJSON as any);

// Helpful compound index for lookups
FarmerSchema.index({ farmName: 1, user: 1 });

export const Farmer: Model<IFarmer> = mongoose.model<IFarmer>("Farmer", FarmerSchema);
export default Farmer;
