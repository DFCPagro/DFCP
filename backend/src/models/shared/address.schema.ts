import { Schema } from "mongoose";
import { optional } from "zod";

export const AddressSchema = new Schema(
  {
    lnt: { type: Number, required: true },     // longitude-ish (kept as 'lnt') -->change everywhere to lng 
    alt: { type: Number, required: true },     // latitude-ish (kept as 'alt') --> change everywhere to lat
    address: { type: String, required: true, trim: true },
    logisticCenterId: { type: String, default: null }, // optional, matches your Address type
    note: { type: String, default: "", required: false },        // e.g., "Farm - Levy Cohen #2", "Warehouse LC-1"
  },
  { _id: false }
);
