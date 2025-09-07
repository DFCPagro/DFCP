import mongoose, { Schema, Types, Document, Model } from "mongoose";
import toJSON from "../utils/toJSON";
import { Address } from "../types/address"; // { lnt: number; alt: number; address: string; }

export type LandOwnership = "owned" | "rented";

export interface IFarmerLand extends Document {
  farmer: Types.ObjectId;          // ref -> Farmer (required)
  name: string;                    // land nickname (unique per farmer)
  ownership: LandOwnership;        // "owned" | "rented"
  acres: number;                   // integer-ish (store as number)

  // Use your Address shape directly
  landLocation?: Address | null;
  pickUpLocation?: Address | null;
  // References to FarmerSection docs for this land
  sections: Types.ObjectId[];      // ref -> FarmerSection[]

  createdAt: Date;
  updatedAt: Date;
}

const AddressSubSchema = new Schema<Address>(
  {
    lnt: { type: Schema.Types.Number, required: true },     // your naming
    alt: { type: Schema.Types.Number, required: true },     // your naming
    address: { type: Schema.Types.String, required: true, trim: true },
  },
  { _id: false }
);

const FarmerLandSchema = new Schema<IFarmerLand>(
  {
    farmer: { type: Schema.Types.ObjectId, ref: "Farmer", required: true, index: true },
    name: { type: Schema.Types.String, required: true, trim: true },
    ownership: { type: Schema.Types.String, enum: ["owned", "rented"], required: true },
    acres: { type: Schema.Types.Number, required: true, min: 0 },

    // optional; can be added later or updated
    landLocation: { type: AddressSubSchema, default: null },
    pickUpLocation: { type: AddressSubSchema, default: null },

    // sections references (empty by default)
    sections: {
      type: [Schema.Types.ObjectId],
      ref: "FarmerSection",
      default: [],
    },
  },
  { timestamps: true }
);

FarmerLandSchema.plugin(toJSON as any);

// Uniqueness: land name per farmer
FarmerLandSchema.index({ farmer: 1, name: 1 }, { unique: true });

export const FarmerLand: Model<IFarmerLand> =
  mongoose.model<IFarmerLand>("FarmerLand", FarmerLandSchema);

export default FarmerLand;
