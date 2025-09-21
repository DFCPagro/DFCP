// src/models/shiftConfig.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model } from "mongoose";
import toJSON from "../utils/toJSON";

const minField = { type: Number, min: 0, max: 1439, required: true };

const ShiftConfigSchema = new Schema(
  {
    // Global: exactly one document per shift name
    name: {
      type: String,
      enum: ["morning", "afternoon", "evening", "night"],
      required: true,
      unique: true, // one row per shift globally
      index: true,
    },

    timezone: { type: String, default: "Asia/Jerusalem" },

    // General cycle
    generalStartMin: minField,
    generalEndMin: minField,

    // Industrial deliverers
    industrialDelivererStartMin: minField,
    industrialDelivererEndMin: minField,

    // Regular deliverers
    delivererStartMin: minField,
    delivererEndMin: minField,

    // Customer delivery window
    deliveryTimeSlotStartMin: minField,
    deliveryTimeSlotEndMin: minField,

    // Optional slot size (minutes, e.g., 30)
    slotSizeMin: { type: Number, min: 5, max: 240, default: 30 },
  },
  { timestamps: true }
);

ShiftConfigSchema.plugin(toJSON as any);

export type ShiftConfig = InferSchemaType<typeof ShiftConfigSchema>;
export type ShiftConfigDoc = HydratedDocument<ShiftConfig>;
export type ShiftConfigModel = Model<ShiftConfig>;

export const ShiftConfig = model<ShiftConfig, ShiftConfigModel>("ShiftConfig", ShiftConfigSchema);
export default ShiftConfig;
