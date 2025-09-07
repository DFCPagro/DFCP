// models/Deliverer.ts
import mongoose, { Schema, Model, Document, Types } from "mongoose";
import toJSON from "../utils/toJSON";

// ===== Helper: days in month WITHOUT year (Feb = 28) =====
function expectedDaysForMonth(month: number): number {
  if (month === 2) return 28;
  // Apr, Jun, Sep, Nov have 30 days
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

// ===== Helper: default current month and zeroed schedule =====
function defaultMonth(): number {
  return new Date().getMonth() + 1; // 1..12
}
function zeroScheduleFor(month: number): number[] {
  return Array.from({ length: expectedDaysForMonth(month) }, () => 0);
}

// ===== Types =====
export interface IDeliverer extends Document {
  user: Types.ObjectId;                       // unique per Deliverer
  createdFromApplication?: Types.ObjectId | null; // ref -> JobApplication
  logisticCenterIds: Types.ObjectId[];        // multi-center

  // Driver & vehicle
  licenseType: string;
  driverLicenseNumber: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleType?: string | null;
  vehicleYear?: number | null;
  vehicleRegistrationNumber?: string | null;
  vehicleInsurance?: boolean;

  vehicleCapacityKg?: number | null;
  vehicleCapacityLiters?: number | null;
  speedKmH?: number | null;

  // Pay defaults
  payFixedPerShift?: number | null;           // default 25
  payPerKm?: number | null;                   // default 1
  payPerStop?: number | null;                 // default 1

  // Monthly schedule
  currentMonth: number;                       // 1..12
  activeSchedule: number[];                   // length == days in month, each 0..15
  nextSchedule: number[];                     // [], or 28..31 with 0..15 entries

  createdAt: Date;
  updatedAt: Date;
}

// ===== Validators =====
const bitmaskArrayValidator = {
  validator: (arr?: number[]) =>
    Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 15),
  message: "Schedule entries must be integers within [0..15].",
};

const nextScheduleValidator = {
  validator: (arr?: number[]) => {
    if (!arr) return true;
    if (arr.length === 0) return true;
    const len = arr.length;
    if (len < 28 || len > 31) return false;
    return arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 15);
  },
  message:
    "nextSchedule must be empty or an array of length 28..31 with entries in [0..15].",
};

// ===== Schema =====
const DelivererSchema = new Schema<IDeliverer>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
    createdFromApplication: {
      type: Schema.Types.ObjectId,
      ref: "JobApplication",
      default: null,
      index: true,
    },

    logisticCenterIds: {
      type: [Schema.Types.ObjectId],
      ref: "LogisticCenter",
      default: [],
      index: true,
    },

    licenseType: { type: Schema.Types.String, required: true, trim: true },
    driverLicenseNumber: { type: Schema.Types.String, required: true, trim: true },

    vehicleMake: { type: Schema.Types.String, default: null, trim: true },
    vehicleModel: { type: Schema.Types.String, default: null, trim: true },
    vehicleType: { type: Schema.Types.String, default: null, trim: true },
    vehicleYear: { type: Schema.Types.Number, default: null, min: 1900, max: 3000 },
    vehicleRegistrationNumber: { type: Schema.Types.String, default: null, trim: true },
    vehicleInsurance: { type: Schema.Types.Boolean, default: false },

    vehicleCapacityKg: { type: Schema.Types.Number, default: null, min: 0 },
    vehicleCapacityLiters: { type: Schema.Types.Number, default: null, min: 0 },
    speedKmH: { type: Schema.Types.Number, default: null, min: 0 },

    payFixedPerShift: { type: Schema.Types.Number, default: 25, min: 0 },
    payPerKm: { type: Schema.Types.Number, default: 1, min: 0 },
    payPerStop: { type: Schema.Types.Number, default: 1, min: 0 },

    currentMonth: {
      type: Schema.Types.Number,
      min: 1,
      max: 12,
      default: defaultMonth,
      required: true,
    },

    activeSchedule: {
      type: [Schema.Types.Number],
      required: true,
      validate: bitmaskArrayValidator,
      default: function (this: IDeliverer) {
        const m = this?.currentMonth ?? defaultMonth();
        return zeroScheduleFor(m);
      },
    },

    nextSchedule: {
      type: [Schema.Types.Number],
      default: [],
      validate: nextScheduleValidator,
    },
  },
  { timestamps: true }
);

// Keep JSON pretty
DelivererSchema.plugin(toJSON as any);

// Enforce activeSchedule length = expected days for currentMonth (Feb = 28)
DelivererSchema.pre("validate", function (next) {
  const doc = this as IDeliverer;
  const m = doc.currentMonth;
  const expected = expectedDaysForMonth(m);
  if (!Array.isArray(doc.activeSchedule)) {
    doc.activeSchedule = zeroScheduleFor(m);
  } else if (doc.activeSchedule.length !== expected) {
    // Pad with zeros or truncate to match exactly
    if (doc.activeSchedule.length < expected) {
      doc.activeSchedule = [...doc.activeSchedule, ...Array(expected - doc.activeSchedule.length).fill(0)];
    } else {
      doc.activeSchedule = doc.activeSchedule.slice(0, expected);
    }
  }
  next();
});

// Index for common queries
DelivererSchema.index({ "logisticCenterIds": 1, currentMonth: 1 });

export const Deliverer: Model<IDeliverer> = mongoose.model<IDeliverer>(
  "Deliverer",
  DelivererSchema
);
export default Deliverer;
