// models/deliverer.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model, Types } from "mongoose";
import toJSON from "../utils/toJSON";

// ===== helpers =====
function expectedDaysForMonth(month: number): number {
  if (month === 2) return 28;                 // keep simple: Feb = 28 (no leap-year)
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
const DelivererSchema = new Schema(
  {
    // identity / relations
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    createdFromApplication: { type: Schema.Types.ObjectId, ref: "JobApplication", default: null, index: true },

    // multi-center assignment
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
    //speedKmH: { type: Number, default: null, min: 0 },

    // pay defaults
    payFixedPerShift: { type: Number, default: 25, min: 0 },
    payPerKm: { type: Number, default: 1, min: 0 },
    payPerStop: { type: Number, default: 1, min: 0 },

    // monthly schedule
    currentMonth: { type: Number, min: 1, max: 12, default: defaultMonth, required: true },

    activeSchedule: {
      type: [Number],
      required: true,
      validate: bitmaskArrayValidator,
      default: function () {
        // this is a mongoose doc here, but we don't reference TS types to avoid cycles
        // @ts-ignore - at runtime has currentMonth
        const m: number = this?.currentMonth ?? defaultMonth();
        return zeroScheduleFor(m);
      },
    },

    StandBySchedule: {
      type: [Number],
      required: true,
      validate: bitmaskArrayValidator,
      default: function () {
        // this is a mongoose doc here, but we don't reference TS types to avoid cycles
        // @ts-ignore - at runtime has currentMonth
        const m: number = this?.currentMonth ?? defaultMonth();
        return zeroScheduleFor(m);
      },
    },

    nextSchedule: { type: [Number], default: [], validate: nextScheduleValidator },
    nextStandBySchedule: { type: [Number], default: [], validate: nextScheduleValidator },
  },
  { timestamps: true }
);

// plugins & indexes
DelivererSchema.plugin(toJSON as any);
DelivererSchema.index({ logisticCenterIds: 1, currentMonth: 1 });

// ===== infer types from schema =====
export type Deliverer = InferSchemaType<typeof DelivererSchema>;
export type DelivererDoc = HydratedDocument<Deliverer>;

// instance methods (add more as you need)
export interface DelivererMethods {
  /**
   * Check if deliverer is available on a given day of currentMonth for any of the given shift bits.
   * shiftMask: bitmask where 1=morning, 2=afternoon, 4=evening, 8=night (sum for multi).
   * dayIndex: 0-based index within currentMonth (0..days-1).
   */
  isAvailable(dayIndex: number, shiftMask: number): boolean;
}

export type DelivererModel = Model<Deliverer, {}, DelivererMethods>;

// ===== hooks =====

// ensure activeSchedule matches currentMonth length
DelivererSchema.pre("validate", function (next) {
  const doc = this as unknown as DelivererDoc;
  const m = doc.currentMonth;
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

// if you ever write to currentMonth via findOneAndUpdate, keep schedule in sync
DelivererSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as Record<string, any> | undefined;
  if (!update) return next();

  const newMonth =
    update.currentMonth ??
    (update.$set && update.$set.currentMonth);

  const newActiveSchedule =
    update.activeSchedule ??
    (update.$set && update.$set.activeSchedule);

  if (typeof newMonth === "number" && !newActiveSchedule) {
    // pad/truncate to the new month length
    const targetLen = expectedDaysForMonth(newMonth);
    // Use $set + $slice/$concatArrays would be complex; simplest is to compute and set here
    this.setUpdate({
      ...update,
      $set: {
        ...(update.$set || {}),
        activeSchedule: zeroScheduleFor(newMonth), // reset; or fetch current doc and reshape if you prefer
      },
    });
  }

  next();
});

// ===== methods =====
DelivererSchema.methods.isAvailable = function (this: DelivererDoc, dayIndex: number, shiftMask: number) {
  if (dayIndex < 0 || dayIndex >= this.activeSchedule.length) return false;
  const dayMask = this.activeSchedule[dayIndex] ?? 0;
  return (dayMask & shiftMask) !== 0;
};

// ===== model =====
export const Deliverer = model<Deliverer, DelivererModel>("Deliverer", DelivererSchema);
export default Deliverer;
