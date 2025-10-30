import mongoose, { Schema, model, models, InferSchemaType } from "mongoose";
import toJSON from "../utils/toJSON";

export const pickerStatuses = ["active", "suspended", "unactive"] as const;

const GamificationSchema = new Schema(
  {
    level: { type: Number, min: 1, default: 1 },
    xp: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const PickerSchema = new Schema(
  {
    // One picker per user
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    nickname: { type: String, trim: true, default: "" },
    status: { type: String, enum: pickerStatuses, default: "active" },

    gamification: { type: GamificationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Plugins
PickerSchema.plugin(toJSON as any);

// Indexes (explicit to avoid duplicates)
PickerSchema.index({ "gamification.level": 1 });

// Virtuals
PickerSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

export type TPicker = InferSchemaType<typeof PickerSchema>;
export const Picker =
  (models.Picker as mongoose.Model<TPicker>) || model<TPicker>("Picker", PickerSchema);
export default Picker;
