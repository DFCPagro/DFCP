import { Schema, Types } from "mongoose";
import { QSInputSchema } from "./qsInput.schema";

export const GRADES = ["A", "B", "C"] as const;
export type Grade = (typeof GRADES)[number];


export const VisualInspectionSchema = new Schema(
  {
    status: { type: String, enum: ["ok", "problem", "pending"], default: "pending" },
    note: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// QS report now stores *typed* inputs (numbers + chosen grades)
export const QSReportSchema = new Schema(
  {
    values: { type: QSInputSchema, default: undefined }, // <- typed structure

    // optional grading outputs (you’ll compute later)
    perMetricGrades: { type: Schema.Types.Mixed, default: {} }, // { brix: "B", colorDescription: "A", ... }
    overallGrade: { type: String, enum: GRADES, default: "" },               // "A" | "B" | "C" | ""

    note: { type: String, default: "" },
    byUserId: { type: Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);
