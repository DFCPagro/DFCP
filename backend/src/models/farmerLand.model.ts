// models/farmerLand.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model, Types } from "mongoose";
import toJSON from "../utils/toJSON";
import { MeasurementsSchema } from "./shared/measurements.schema";

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

const FarmerLandSchema = new Schema(
  {
    farmer: { type: Schema.Types.ObjectId, ref: "Farmer", required: true },
    name: { type: String, required: true, trim: true },
    ownership: { type: String, enum: ["owned", "rented"], required: true },
    areaM2: { type: Number, required: true, min: 0 },
    address: { type: AddressSubSchema, required: true },
    pickupAddress: { type: AddressSubSchema, default: null },
    measurements: { type: MeasurementsSchema, required: true },
    sections: {
      type: [Schema.Types.ObjectId],
      ref: "FarmerSection",
      default: [],
    },
  },
  { timestamps: true }
);

// ------- Virtuals to help the FE draw a shape -------
// If opposite sides match (≈ rectangle), return a simple rectangle polygon.
// Otherwise, fall back to abM × bcM rectangle (best-effort).
FarmerLandSchema.virtual("polygon2D").get(function (this: any) {
  const m = this.measurements || {};
  const { abM = 0, bcM = 0, cdM = 0, daM = 0, rotationDeg = 0 } = m;
  const eps = 1e-6;
  const rect =
    Math.abs(abM - cdM) < eps && Math.abs(bcM - daM) < eps && abM > 0 && bcM > 0;

  // base rectangle points (origin at 0,0; clockwise A→B→C→D)
  const pts = rect
    ? [
        [0, 0],
        [abM, 0],
        [abM, bcM],
        [0, bcM],
      ]
    : [
        [0, 0],
        [abM, 0],
        [abM, bcM],
        [0, bcM],
      ];

  if (!rotationDeg) return pts;

  // apply rotation if provided (about origin)
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return pts.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
});

// Simple area if rectangle-like (else estimate with abM×bcM)
FarmerLandSchema.virtual("computedAreaM2").get(function (this: any) {
  const m = this.measurements || {};
  const { abM = 0, bcM = 0, cdM = 0, daM = 0 } = m;
  const eps = 1e-6;
  if (Math.abs(abM - cdM) < eps && Math.abs(bcM - daM) < eps) {
    return abM * bcM;
  }
  // fallback rectangle estimate
  return abM * bcM || null;
});

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
