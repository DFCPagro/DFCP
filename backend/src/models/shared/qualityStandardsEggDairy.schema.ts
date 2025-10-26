import { Schema } from "mongoose";

/**
 * Quality Standards — Eggs & Dairy
 * ---------------------------------
 * Different QC metrics (e.g. freshness days, grade, shell integrity, fat %, etc.)
 * For now: empty placeholder, easily extendable later.
 */
export const QualityStandardsEggDairySchema = new Schema(
  {
    freshnessDays: { type: Number, min: 0 },
    grade: { type: String, enum: ["A", "B", "C"], default: "A" },
    fatPercentage: { type: Number, min: 0, max: 100 },
  },
  { _id: false }
);
