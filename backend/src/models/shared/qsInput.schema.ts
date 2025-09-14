import { Schema } from "mongoose";


/**
 * User-entered Quality Standards inputs (farmer or inspector).
 * - Numeric fields are numbers
 * - Non-numeric fields are *selected grades* (A/B/C)
 *   and we also store the *text snapshot* from the standards at the time of input.
 */
export const QSInputSchema = new Schema(
  {
    // ---- Numeric metrics ----
    brix: { type: Number, default: null, min: 0 },
    acidityPercentage: { type: Number, default: null, min: 0 },
    pressure: { type: Number, default: null, min: 0 }, // kg/cm²
    colorPercentage: { type: Number, default: null, min: 0, max: 100 },
    weightPerUnitG: { type: Number, default: null, min: 0 },
    diameterMM: { type: Number, default: null, min: 0 },
    maxDefectRatioLengthDiameter: { type: Number, default: null, min: 0, max: 100 },
    rejectionRate: { type: Number, default: null, min: 0, max: 100 },

    // ---- Categorical / descriptive metrics (choose A/B/C) ----

    colorDescriptionText:  { type: String, default: null },               // e.g. "Bright coloration" (snapshot) from the ıtem qs optıons 


  },
  { _id: false, strict: true }
);

export default QSInputSchema;
