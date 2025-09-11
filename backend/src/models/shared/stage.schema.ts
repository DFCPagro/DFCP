// models/shared/stage.schema.ts
import { Schema } from "mongoose";

export type StageStatus = "ok" | "problem" | "current" | "pending" | "done";

export const StageSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },   // e.g. "planned","harvest","qc","loaded","received"
    label: { type: String, required: true, trim: true }, // human label
    status: {
      type: String,
      enum: ["ok", "problem", "current", "pending", "done"],
      default: "pending",
      index: true,
    },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { _id: false }
);
