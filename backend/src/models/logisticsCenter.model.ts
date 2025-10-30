import mongoose, { Schema, model, models, InferSchemaType } from "mongoose";
import toJSON from "../utils/toJSON";

const LocationSchema = new Schema(
  {
    name: { type: String, trim: true },
    geo: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },
  },
  { _id: false }
);

const DeliveryHistorySchema = new Schema(
  {
    message: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const LogisticsCenterSchema = new Schema(
  {
    logisticName: { type: String, required: true, trim: true },
    location: { type: LocationSchema, required: true },
    employeeIds: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    deliveryHistory: { type: [DeliveryHistorySchema], default: [] },
  },
  { timestamps: true }
);

LogisticsCenterSchema.plugin(toJSON as any);

export type TLogisticsCenter = InferSchemaType<typeof LogisticsCenterSchema>;
export const LogisticCenter =
  (models.LogisticCenter as mongoose.Model<TLogisticsCenter>) ||
  model<TLogisticsCenter>("LogisticCenter", LogisticsCenterSchema);
export default LogisticCenter;
