// models/farmerLand.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model, Types } from "mongoose";
import toJSON from "../utils/toJSON";

// ---------- Address sub-schema ----------
const AddressSubSchema = new Schema(
  {
    lnt: { type: Number, required: true },     // longitude-ish (kept as 'lnt')
    alt: { type: Number, required: true },     // latitude-ish (kept as 'alt')
    address: { type: String, required: true, trim: true },
    logisticCenterId: { type: String, default: null }, // optional, matches your Address type
  },
  { _id: false }
);

// ---------- Land schema (no generics; we infer later) ----------
const FarmerLandSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: "Farmer", required: true, index: true },
    name: { type: String, required: true, trim: true },
    ownership: { type: String, enum: ["owned", "rented"], required: true },
    widthM: { type: Number, required: true, min: 0 },
    lengthM: { type: Number, required: true, min: 0 },

    landLocation: { type: AddressSubSchema, default: null },
    pickUpLocation: { type: AddressSubSchema, default: null },

    sections: {
      type: [Schema.Types.ObjectId],
      ref: "FarmerSection",
      default: [],
    },
  },
  { timestamps: true }
);

// Plugins & indexes
FarmerLandSchema.plugin(toJSON as any);

// Uniqueness: land name per farmer
FarmerLandSchema.index({ farmer: 1, name: 1 }, { unique: true });

// ---------- Inferred types ----------
export type FarmerLand = InferSchemaType<typeof FarmerLandSchema>;
export type FarmerLandDoc = HydratedDocument<FarmerLand>;
export type FarmerLandModel = Model<FarmerLand>;

// ---------- Model ----------
export const FarmerLand = model<FarmerLand, FarmerLandModel>("FarmerLand", FarmerLandSchema);
export default FarmerLand;
