// models/_shared/measurements.schema.ts
import { Schema } from "mongoose";

export const MeasurementsSchema = new Schema(
  {
    abM: { type: Number, required: true, min: 0 }, // A→B
    bcM: { type: Number, required: true, min: 0 }, // B→C
    cdM: { type: Number, required: true, min: 0 }, // C→D
    daM: { type: Number, required: true, min: 0 }, // D→A
    rotationDeg: { type: Number, default: 0, min: -360, max: 360 }, // optional: for simple rotation in UI
  },
  { _id: false }
);

// tiny helper used by virtuals (attach to schema so it’s co-located)
(MeasurementsSchema as any).statics = {};



