import { Schema } from "mongoose";

export const AddressSchema = new Schema(
  {
    lnt: { type: Number, required: true },     // longitude-ish (kept as 'lnt')
    alt: { type: Number, required: true },     // latitude-ish (kept as 'alt')
    address: { type: String, required: true, trim: true },
    logisticCenterId: { type: String, default: null }, // optional, matches your Address type
  },
  { _id: false }
);
