import {
  Schema,
  model,
  InferSchemaType,
  HydratedDocument,
  Model,
  trusted,
} from "mongoose";
import bcrypt from "bcryptjs";
import toJSON from "../utils/toJSON";
import { roles } from "../utils/constants";

const monthField = {
  type: String,
  required: true,
  // enforce YYYY-MM (01–12) format
  match: [/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"],
};

const bitmapField = {
  type: [Number],
  default: [], // one entry per day; frontend precomputes values like 1 => 0001, 15 => 1111
};

const ScheduleSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: roles, index: true },
    logisticCenterId: {
      type: Schema.Types.ObjectId,
      ref: "LogisticCenter",
      default: null,
    },

    activeSchedule: [
      {
        month: monthField,
        bitmap: bitmapField,
        _id: false, // avoid subdocument ids
      },
    ],

    standBySchedule: [
      {
        month: monthField,
        bitmap: bitmapField,
        _id: false,
      },
    ],
  },
  { discriminatorKey: "kind", timestamps: true }
);

// plugins & indexes
ScheduleSchema.plugin(toJSON as any);

ScheduleSchema.index({ userId: 1 });

// ========== Types inferred from schemas ==========

export type Schedule = InferSchemaType<typeof ScheduleSchema>;
export type ScheduleDoc = HydratedDocument<Schedule>;
export type ScheduleModel = Model<Schedule>;

/**
 * Model
 */
export const Schedule = model<Schedule, ScheduleModel>(
  "Schedule",
  ScheduleSchema
);
export default Schedule;
