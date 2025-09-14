// models/industrialDeliverer.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model } from "mongoose";
import toJSON from "../utils/toJSON";

// ===== helpers =====
function expectedDaysForMonth(month: number): number {
  if (month === 2) return 28;                 // simple: no leap-year
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}
function defaultMonth(): number {
  return new Date().getMonth() + 1;           // 1..12
}
function zeroScheduleFor(month: number): number[] {
  return Array.from({ length: expectedDaysForMonth(month) }, () => 0);
}

// ===== validators =====
const bitmaskArrayValidator = {
  validator: (arr?: number[]) =>
    Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 15),
  message: "Schedule entries must be integers within [0..15].",
};

const nextScheduleValidator = {
  validator: (arr?: number[]) => {
    if (!arr || arr.length === 0) return true;
    const len = arr.length;
    if (len < 28 || len > 31) return false;
    return arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 15);
  },
  message: "nextSchedule must be empty or length 28..31 with entries in [0..15].",
};

// ===== schema (no generics; infer later) =====
const IndustrialDelivererSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    createdFromApplication: { type: Schema.Types.ObjectId, ref: "JobApplication", default: null, index: true },

    logisticCenterIds: { type: [Schema.Types.ObjectId], ref: "LogisticCenter", default: [], index: true },

    // driver & vehicle
    licenseType: { type: String, required: true, trim: true },
    driverLicenseNumber: { type: String, required: true, trim: true },
    vehicleMake: { type: String, default: null, trim: true },
    vehicleModel: { type: String, default: null, trim: true },
    vehicleType: { type: String, default: null, trim: true },
    vehicleYear: { type: Number, default: null, min: 1900, max: 3000 },
    vehicleRegistrationNumber: { type: String, default: null, trim: true },
    vehicleInsurance: { type: Boolean, default: false },

    vehicleCapacityKg: { type: Number, default: null, min: 0 },
    vehicleCapacityLiters: { type: Number, default: null, min: 0 },
    vehicleCargoCM: {
      type: new Schema({
        height: { type: Number, min: 0, required: true },
        length: { type: Number, min: 0, required: true },
        width: { type: Number, min: 0, required: true },
      }),
      required: true,
    },

    speedKmH: { type: Number, default: null, min: 0 },

    // pay defaults
    payFixedPerShift: { type: Number, default: 25, min: 0 },
    payPerKm: { type: Number, default: 1, min: 0 },
    payPerStop: { type: Number, default: 1, min: 0 },

    // industrial-only
    refrigerated: { type: Boolean, default: false },

    // monthly schedule
    currentMonth: { type: Number, min: 1, max: 12, default: defaultMonth, required: true },

    activeSchedule: {
      type: [Number],
      required: true,
      validate: bitmaskArrayValidator,
      default: function () {
        // avoid TS cycles by not referencing TS types here
        const m = (this as any)?.currentMonth ?? defaultMonth();
        return zeroScheduleFor(m);
      },
    },

    nextSchedule: { type: [Number], default: [], validate: nextScheduleValidator },
  },
  { timestamps: true }
);

// plugins & indexes
IndustrialDelivererSchema.plugin(toJSON as any);
IndustrialDelivererSchema.index({ logisticCenterIds: 1, currentMonth: 1 });

// keep activeSchedule length in sync with currentMonth
IndustrialDelivererSchema.pre("validate", function (next) {
  const doc = this as any;
  const m: number = doc.currentMonth;
  const expected = expectedDaysForMonth(m);

  if (!Array.isArray(doc.activeSchedule)) {
    doc.activeSchedule = zeroScheduleFor(m);
  } else if (doc.activeSchedule.length !== expected) {
    doc.activeSchedule =
      doc.activeSchedule.length < expected
        ? [...doc.activeSchedule, ...Array(expected - doc.activeSchedule.length).fill(0)]
        : doc.activeSchedule.slice(0, expected);
  }
  next();
});

// ===== inferred types =====
export type IndustrialDeliverer = InferSchemaType<typeof IndustrialDelivererSchema>;
export type IndustrialDelivererDoc = HydratedDocument<IndustrialDeliverer>;
export type IndustrialDelivererModel = Model<IndustrialDeliverer>;

// ===== model =====
export const IndustrialDeliverer = model<IndustrialDeliverer, IndustrialDelivererModel>(
  "IndustrialDeliverer",
  IndustrialDelivererSchema
);
export default IndustrialDeliverer;
