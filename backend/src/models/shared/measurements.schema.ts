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



/*

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
FarmerLandSchema.virtual("areaM2").get(function (this: any) {
  const m = this.measurements || {};
  const { abM = 0, bcM = 0, cdM = 0, daM = 0 } = m;
  const eps = 1e-6;
  if (Math.abs(abM - cdM) < eps && Math.abs(bcM - daM) < eps) {
    return abM * bcM;
  }
  // fallback rectangle estimate
  return abM * bcM || null;
});

*/
