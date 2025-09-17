import { Schema } from "mongoose";

/**
 * Simple A/B/C container schema for storing
 * human-readable thresholds or descriptions.
 */
export const ABCSchema = new Schema(
  {
    A: { type: String, default: null, trim: true },
    B: { type: String, default: null, trim: true },
    C: { type: String, default: null, trim: true },
  },
  { _id: false }
);

/**
 * Optional: numeric ranges for machine evaluation.
 * Example usage later if you want to grade values automatically.
 */
export const NumericRangeSchema = new Schema(
  {
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    inclusiveMin: { type: Boolean, default: true },
    inclusiveMax: { type: Boolean, default: true },
    unit: { type: String, default: "" }, // e.g. "%", "g", "mm"
    comparator: {
      type: String,
      enum: ["range", "ge", "le"],
      default: "range",
    },
  },
  { _id: false }
);

/**
 * QualityStandardsSchema
 * - keeps all the metrics you defined (brix, acidity, pressure, etc.)
 * - each metric has A/B/C values stored in ABCSchema
 * - if you want, you can later expand this to have both ABCSchema (string)
 *   and NumericRangeSchema (parsed numbers) side by side
 */
export const QualityStandardsSchema = new Schema(
  {
    brix: { type: ABCSchema, default: undefined },
    acidityPercentage: { type: ABCSchema, default: undefined },
    pressure: { type: ABCSchema, default: undefined },

    colorDescription: { type: ABCSchema, default: undefined },
    colorPercentage: { type: ABCSchema, default: undefined },

    // both keys for compatibility
    weightPerUnit: { type: ABCSchema, default: undefined },
    weightPerUnitG: { type: ABCSchema, default: undefined },

    diameterMM: { type: ABCSchema, default: undefined },
    qualityGrade: { type: ABCSchema, default: undefined },
    maxDefectRatioLengthDiameter: { type: ABCSchema, default: undefined },
    rejectionRate: { type: ABCSchema, default: undefined },

    // optional: numeric grading ranges per metric (future use)
    numeric: {
      brix: { type: { A: NumericRangeSchema, B: NumericRangeSchema, C: NumericRangeSchema }, default: undefined },
      acidityPercentage: { type: { A: NumericRangeSchema, B: NumericRangeSchema, C: NumericRangeSchema }, default: undefined },
      pressure: { type: { A: NumericRangeSchema, B: NumericRangeSchema, C: NumericRangeSchema }, default: undefined },
      colorPercentage: { type: { A: NumericRangeSchema, B: NumericRangeSchema, C: NumericRangeSchema }, default: undefined },
      weightPerUnitG: { type: { A: NumericRangeSchema, B: NumericRangeSchema, C: NumericRangeSchema }, default: undefined },
      diameterMM: { type: { A: NumericRangeSchema, B: NumericRangeSchema, C: NumericRangeSchema }, default: undefined },
      maxDefectRatioLengthDiameter: { type: { A: NumericRangeSchema, B: NumericRangeSchema, C: NumericRangeSchema }, default: undefined },
      rejectionRate: { type: { A: NumericRangeSchema, B: NumericRangeSchema, C: NumericRangeSchema }, default: undefined },
    },
  },
  { _id: false }
);

export default QualityStandardsSchema;
