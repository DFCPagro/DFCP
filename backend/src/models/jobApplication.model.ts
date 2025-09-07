import mongoose, { Document, Model, Schema, Types } from "mongoose";
import toJSON from "../utils/toJSON";
import {
  jobApplicationRoles,
  JobApplicationRole,
  jobApplicationStatuses,
  JobApplicationStatus,
} from "../utils/constants";

/** =========================
 * Shared Interfaces
 * ======================= */
export interface IJobApplicationBase extends Document {
  user: Types.ObjectId;                      // ref User
  appliedRole: JobApplicationRole;           // discriminator key
  logisticCenterId?: Types.ObjectId | null;  // optional ref LogisticCenter
  status: JobApplicationStatus;              // pending | contacted | accepted | denied
  createdAt: Date;
  updatedAt: Date;
  applicationData?: Record<string, any>;     // overridden by discriminators
}

/** =========================
 * Deliverer
 * ======================= */
// Weekly bitmask: 7 numbers, Sun..Sat. If you use 4 shifts/day, each n is 0..15.
export type WeeklyShiftBitmask = [number, number, number, number, number, number, number];

export interface IDelivererData {
  licenseType: string;                 // e.g., "B" | "C1" | "C"
  driverLicenseNumber: string;

  vehicleMake?: string;
  vehicleModel?: string;
  vehicleType?: string;                // "van" | "truck" | "motorcycle" ...
  vehicleYear?: number;
  vehicleRegistrationNumber?: string;
  vehicleInsurance?: boolean;

  vehicleCapacityKg?: number;          // payload capacity
  vehicleCapacityLiters?: number;      // cargo volume (liters)
  speedKmH?: number;                   // for ETA planning

  // Pay structure defaults (can be tuned later)
  payFixedPerShift?: number;           // default 25
  payPerKm?: number;                   // default 1
  payPerStop?: number;                 // default 1

  // Simplified: weekly schedule (7-length bitmask array)
  weeklySchedule?: WeeklyShiftBitmask; // optional for now
}

export interface IIndustrialDelivererData extends IDelivererData {
  refrigerated?: boolean;
}

/** =========================
 * Farmer
 * ======================= */
export interface IFarmerLand {
  name: string;
  ownership: "owned" | "rented";
  acres: number;
  pickupAddress: {
    address: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface IFarmerData {
  agriculturalInsurance?: boolean;
  farmName: string;
  agreementPercentage?: number;        // default 60
  lands: IFarmerLand[];                // store lands here (in application)
}

/** =========================
 * Picker / Sorter
 * ======================= */
export interface IMinimalWorkerData {
  // empty for now; extensible later
}

/** =========================
 * Base Schema
 * ======================= */
const JOB_APP_DISCRIMINATOR_KEY = "appliedRole";

const JobApplicationBaseSchema = new Schema<IJobApplicationBase>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    appliedRole: {
      type: String,
      enum: jobApplicationRoles,
      required: true,
      index: true,
    },
    logisticCenterId: { type: Schema.Types.ObjectId, ref: "LogisticCenter", default: null },
    status: {
      type: String,
      enum: jobApplicationStatuses,
      default: "pending",
      index: true,
    },
    // applicationData is defined by each discriminator below
  },
  {
    timestamps: true,
    discriminatorKey: JOB_APP_DISCRIMINATOR_KEY,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

JobApplicationBaseSchema.plugin(toJSON as any);

/**
 * Block duplicate *open* applications per (user, role).
 * "Open" means status != 'denied' (so pending/contacted/accepted are considered open).
 * You can tweak if you prefer to allow multiple accepted, etc.
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

/** Model */
export interface IJobApplicationModel extends Model<IJobApplicationBase> {}
export const JobApplication = mongoose.model<IJobApplicationBase>(
  "JobApplication",
  JobApplicationBaseSchema
) as IJobApplicationModel;

/** =========================
 * Validators / Subschemas
 * ======================= */
const weeklyScheduleValidator = {
  validator: function (arr?: number[]) {
    if (arr == null) return true;                 // optional
    if (!Array.isArray(arr) || arr.length !== 7) return false;
    return arr.every((n) => Number.isInteger(n) && n >= 0);
    // If you want to enforce 4 shifts/day → n <= 15, uncomment:
    // return arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 15);
  },
  message: "weeklySchedule must be an array of exactly 7 non-negative integers.",
};

const DelivererDataSchema = new Schema<IDelivererData>(
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

    weeklySchedule: { type: [Number], validate: weeklyScheduleValidator },
  },
  { _id: false }
);

const IndustrialDelivererDataSchema = new Schema<IIndustrialDelivererData>(
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

    weeklySchedule: { type: [Number], validate: weeklyScheduleValidator },
    refrigerated: { type: Boolean, default: false },
  },
  { _id: false }
);

const FarmerLandSchema = new Schema<IFarmerLand>(
  {
    name: { type: String, required: true, trim: true },
    ownership: { type: String, enum: ["owned", "rented"], required: true },
    acres: { type: Number, required: true, min: 0 },
    pickupAddress: {
      type: new Schema(
        {
          address: { type: String, required: true, trim: true },
          latitude: { type: Number, min: -90, max: 90 },
          longitude: { type: Number, min: -180, max: 180 },
        },
        { _id: false }
      ),
      required: true,
    },
  },
  { _id: false }
);

const FarmerDataSchema = new Schema<IFarmerData>(
  {
    agriculturalInsurance: { type: Boolean, default: false },
    farmName: { type: String, required: true, trim: true },
    agreementPercentage: { type: Number, min: 0, max: 100, default: 60 },
    lands: {
      type: [FarmerLandSchema],
      default: [],
      validate: [(arr: IFarmerLand[]) => Array.isArray(arr), "lands must be an array"],
    },
  },
  { _id: false }
);

/** =========================
 * Discriminators
 * ======================= */
interface IJobApplicationDeliverer extends IJobApplicationBase {
  applicationData: IDelivererData;
}
const DelivererSchema = new Schema<IJobApplicationDeliverer>({
  applicationData: { type: DelivererDataSchema, required: true },
});
export const DelivererApplication = JobApplication.discriminator<IJobApplicationDeliverer>(
  "deliverer",
  DelivererSchema
);

interface IJobApplicationIndustrialDeliverer extends IJobApplicationBase {
  applicationData: IIndustrialDelivererData;
}
const IndustrialDelivererSchema = new Schema<IJobApplicationIndustrialDeliverer>({
  applicationData: { type: IndustrialDelivererDataSchema, required: true },
});
export const IndustrialDelivererApplication =
  JobApplication.discriminator<IJobApplicationIndustrialDeliverer>(
    "industrialDeliverer",
    IndustrialDelivererSchema
  );

interface IJobApplicationFarmer extends IJobApplicationBase {
  applicationData: IFarmerData;
}
const FarmerSchema = new Schema<IJobApplicationFarmer>({
  applicationData: { type: FarmerDataSchema, required: true },
});
export const FarmerApplication = JobApplication.discriminator<IJobApplicationFarmer>(
  "farmer",
  FarmerSchema
);

interface IJobApplicationMinimalWorker extends IJobApplicationBase {
  applicationData: IMinimalWorkerData;
}
const MinimalWorkerDataSchema = new Schema<IMinimalWorkerData>({}, { _id: false });

const PickerSchema = new Schema<IJobApplicationMinimalWorker>({
  applicationData: { type: MinimalWorkerDataSchema, required: false, default: {} },
});
export const PickerApplication = JobApplication.discriminator<IJobApplicationMinimalWorker>(
  "picker",
  PickerSchema
);

const SorterSchema = new Schema<IJobApplicationMinimalWorker>({
  applicationData: { type: MinimalWorkerDataSchema, required: false, default: {} },
});
export const SorterApplication = JobApplication.discriminator<IJobApplicationMinimalWorker>(
  "sorter",
  SorterSchema
);

/** =========================
 * Virtuals
 * ======================= */
JobApplicationBaseSchema.virtual("userInfo", {
  ref: "User",
  localField: "user",
  foreignField: "_id",
  justOne: true,
});
