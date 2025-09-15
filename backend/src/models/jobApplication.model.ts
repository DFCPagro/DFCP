// models/jobApplication.model.ts

/* =========================================
 * Notes & usage tips:
 * ======================================= 
Typing: we infer JobApplicationBase from the base schema; for each discriminator we infer only the extra fields (applicationData shapes) and then intersect with the base to type the doc accurately.

Indexes: you keep the partial unique index to prevent duplicate “open” applications per (user, role).

Controller flow (approve → create entity):

  -When a manager approves a “deliverer” app, read applicationData, create a Deliverer doc (from your deliverer model), and store the createdFromApplication reference on it if you like that linkage.

  -Same idea for “farmer”.

Validation: the weekly schedule validator is there; bump it to <= 15 if you always use a 4-shift mask.

If you want, I can also drop a short service function that:
  1. creates an application for a given role with runtime Zod validation, and
  2. on approval, promotes it into a Deliverer or Farmer document (and closes the application).
*/
import { Schema, model, InferSchemaType, HydratedDocument, Model, Types } from "mongoose";
import toJSON from "../utils/toJSON";
import {
  jobApplicationRoles,
  JobApplicationRole,
  jobApplicationStatuses,
} from "../utils/constants";
import { AddressSchema } from "./shared/address.schema";
import { MeasurementsSchema } from "./shared/measurements.schema";

/* =========================================
 * Sub-schemas (shared + per role)
 * ======================================= */

// Weekly bitmask: 7 numbers, Sun..Sat. If using 4 shifts/day → each n ∈ [0..15]
const weeklyScheduleValidator = {
  validator: function (arr?: number[]) {
    if (arr == null) return true;
    if (!Array.isArray(arr) || arr.length !== 7) return false;
    return arr.every((n) => Number.isInteger(n) && n >= 0);
    // If you want strictly 4 shifts/day, use: n >= 0 && n <= 15
  },
  message: "weeklySchedule must be an array of exactly 7 non-negative integers.",
};

const DelivererCargoCMSchema = new Schema(
  {
    height: { type: Number, required: true, min: 1 },
    length: { type: Number, required: true, min: 1 },
    width:  { type: Number, required: true, min: 1 },
  },
  { _id: false }
);


const DelivererDataSchema = new Schema(
  {
    licenseType: { type: String, required: true, trim: true },
    driverLicenseNumber: { type: String, required: true, trim: true },

    vehicleMake: { type: String, trim: true },
    vehicleModel: { type: String, trim: true },
    vehicleType: { type: String, trim: true },
    vehicleYear: { type: Number, min: 1900, max: 3000 },
    vehicleRegistrationNumber: { type: String, trim: true },
    vehicleInsurance: { type: Boolean, default: false },

    vehicleCapacityKg: { type: Number, min: 0, default: 0 },
    vehicleCapacityLiters: { type: Number, min: 0, default: 0 },
    speedKmH: { type: Number, min: 0, default: 0 },

    payFixedPerShift: { type: Number, min: 0, default: 25 },
    payPerKm: { type: Number, min: 0, default: 1 },
    payPerStop: { type: Number, min: 0, default: 1 },

    vehicleCargoCM: { type: DelivererCargoCMSchema, default: null },

    weeklySchedule: { type: [Number], validate: weeklyScheduleValidator },
  },
  { _id: false }
);

const IndustrialDelivererDataSchema = new Schema(
  {
    licenseType: { type: String, required: true, trim: true },
    driverLicenseNumber: { type: String, required: true, trim: true },

    vehicleMake: { type: String, trim: true },
    vehicleModel: { type: String, trim: true },
    vehicleType: { type: String, trim: true },
    vehicleYear: { type: Number, min: 1900, max: 3000 },
    vehicleRegistrationNumber: { type: String, trim: true },
    vehicleInsurance: { type: Boolean, default: false },

    vehicleCapacityKg: { type: Number, min: 0, default: 0 },
    vehicleCapacityLiters: { type: Number, min: 0, default: 0 },
    speedKmH: { type: Number, min: 0, default: 0 },

    payFixedPerShift: { type: Number, min: 0, default: 25 },
    payPerKm: { type: Number, min: 0, default: 1 },
    payPerStop: { type: Number, min: 0, default: 1 },

    vehicleCargoCM: { type: DelivererCargoCMSchema, required: true },
    weeklySchedule: { type: [Number], validate: weeklyScheduleValidator },
    refrigerated: { type: Boolean, default: false },
  },
  { _id: false }
);

const AppFarmerLandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    ownership: { type: String, enum: ["owned", "rented"], required: true },

    // ⬇️ shared shapes
    address: { type: AddressSchema, required: true },
    pickupAddress: { type: AddressSchema, default: null },
    measurements: { type: MeasurementsSchema, required: true },

  },
  { _id: false }
);

const FarmerDataSchema = new Schema(
  {
    agriculturalInsurance: { type: Boolean, default: false },
    farmName: { type: String, required: true, trim: true },
    agreementPercentage: { type: Number, min: 0, max: 100, default: 60 },
    lands: {
      type: [AppFarmerLandSchema],
      default: [],
      validate: [
        (arr: unknown) => Array.isArray(arr),
        "lands must be an array",
        [(arr: unknown) => Array.isArray(arr) && arr.length >= 1, "lands must include at least one land"],
      ],
    },
  },
  { _id: false }
);




const MinimalWorkerDataSchema = new Schema({}, { _id: false });

/* =========================================
 * Base schema (no generics; we infer later)
 * ======================================= */

const JOB_APP_DISCRIMINATOR_KEY = "appliedRole" as const;

const JobApplicationBaseSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    appliedRole: {
      type: String,
      enum: jobApplicationRoles, // e.g., "deliverer" | "industrialDeliverer" | "farmer" | "picker" | "sorter"
      required: true,
      index: true,
    },
    logisticCenterId: { type: Schema.Types.ObjectId, ref: "LogisticCenter", default: null },
    status: {
      type: String,
      enum: [
        // prefer reading from constants, but keep list here for runtime validation stability
        ...new Set(["pending", "contacted", "accepted", "denied", ...jobApplicationStatuses]),
      ],
      default: "pending",
      index: true,
    },
    // applicationData will be defined by each discriminator
  },
  {
    timestamps: true,
    discriminatorKey: JOB_APP_DISCRIMINATOR_KEY,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

JobApplicationBaseSchema.plugin(toJSON as any);

/** Block duplicate *open* applications per (user, role).
 * "Open" = status != 'denied'
 * You can tweak this if you later allow multiple accepted, etc.
 */
JobApplicationBaseSchema.index(
  { user: 1, appliedRole: 1, status: 1 },
  {
    name: "uniq_open_application_per_role",
    unique: true,
    partialFilterExpression: { status: { $ne: "denied" } },
  }
);

// Useful for admin dashboards
JobApplicationBaseSchema.index({ logisticCenterId: 1, status: 1, createdAt: -1 });

/* =========================================
 * Base model + inferred types
 * ======================================= */

export type JobApplicationBase = InferSchemaType<typeof JobApplicationBaseSchema>;
export type JobApplicationBaseDoc = HydratedDocument<JobApplicationBase>;
export type JobApplicationBaseModel = Model<JobApplicationBase>;

export const JobApplication = model<JobApplicationBase, JobApplicationBaseModel>(
  "JobApplication",
  JobApplicationBaseSchema
);

/* =========================================
 * Discriminators (schemas + inferred types)
 * NOTE: InferSchemaType on a discriminator schema only gives you
 *       the *additional* fields; combine with base type for full doc.
 * ======================================= */

// ----- Deliverer Application -----
const DelivererApplicationSchema = new Schema(
  {
    applicationData: { type: DelivererDataSchema, required: true },
  },
  { _id: false }
);

export type DelivererApplicationExtra = InferSchemaType<typeof DelivererApplicationSchema>; // { applicationData: ... }
export type DelivererApplicationDoc = HydratedDocument<JobApplicationBase & DelivererApplicationExtra>;

export const DelivererApplication = JobApplication.discriminator<
  JobApplicationBase & DelivererApplicationExtra
>(
  "deliverer",
  DelivererApplicationSchema
);

// ----- Industrial Deliverer Application -----
const IndustrialDelivererApplicationSchema = new Schema(
  {
    applicationData: { type: IndustrialDelivererDataSchema, required: true },
  },
  { _id: false }
);

export type IndustrialDelivererApplicationExtra = InferSchemaType<typeof IndustrialDelivererApplicationSchema>;
export type IndustrialDelivererApplicationDoc = HydratedDocument<
  JobApplicationBase & IndustrialDelivererApplicationExtra
>;

export const IndustrialDelivererApplication = JobApplication.discriminator<
  JobApplicationBase & IndustrialDelivererApplicationExtra
>(
  "industrialDeliverer",
  IndustrialDelivererApplicationSchema
);

// ----- Farmer Application -----
const FarmerApplicationSchema = new Schema(
  {
    applicationData: { type: FarmerDataSchema, required: true },
  },
  { _id: false }
);

export type FarmerApplicationExtra = InferSchemaType<typeof FarmerApplicationSchema>;
export type FarmerApplicationDoc = HydratedDocument<JobApplicationBase & FarmerApplicationExtra>;

export const FarmerApplication = JobApplication.discriminator<
  JobApplicationBase & FarmerApplicationExtra
>("farmer", FarmerApplicationSchema);

// ----- Picker Application -----
const PickerApplicationSchema = new Schema(
  {
    applicationData: { type: MinimalWorkerDataSchema, required: false, default: {} },
  },
  { _id: false }
);

export type PickerApplicationExtra = InferSchemaType<typeof PickerApplicationSchema>;
export type PickerApplicationDoc = HydratedDocument<JobApplicationBase & PickerApplicationExtra>;

export const PickerApplication = JobApplication.discriminator<
  JobApplicationBase & PickerApplicationExtra
>("picker", PickerApplicationSchema);

// ----- Sorter Application -----
const SorterApplicationSchema = new Schema(
  {
    applicationData: { type: MinimalWorkerDataSchema, required: false, default: {} },
  },
  { _id: false }
);

export type SorterApplicationExtra = InferSchemaType<typeof SorterApplicationSchema>;
export type SorterApplicationDoc = HydratedDocument<JobApplicationBase & SorterApplicationExtra>;

export const SorterApplication = JobApplication.discriminator<
  JobApplicationBase & SorterApplicationExtra
>("sorter", SorterApplicationSchema);

/* =========================================
 * Virtuals (shared)
 * ======================================= */

JobApplicationBaseSchema.virtual("userInfo", {
  ref: "User",
  localField: "user",
  foreignField: "_id",
  justOne: true,
});

/* =========================================
 * Helpful unions (optional but nice to have)
 * ======================================= */

export type AnyApplicationDoc =
  | DelivererApplicationDoc
  | IndustrialDelivererApplicationDoc
  | FarmerApplicationDoc
  | PickerApplicationDoc
  | SorterApplicationDoc;

export type AnyApplicationRole = Extract<
  JobApplicationRole,
  "deliverer" | "industrialDeliverer" | "farmer" | "picker" | "sorter"
>;

export default JobApplication;


