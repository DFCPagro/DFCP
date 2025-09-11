// models/shared/inspection.schema.ts
import { Schema } from "mongoose";

// Lightweight quality/visual inspection blocks
export const VisualInspectionSchema = new Schema(
  {
    status: { type: String, enum: ["ok", "problem", "pending"], default: "pending" },
    note: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const QSReportSchema = new Schema(
  {
    // Add fields you track (brix, defects, humidity, temp, etc.)
    values: { type: Schema.Types.Mixed, default: {} },
    note: { type: String, default: "" },
    byUserId: { type: Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);
