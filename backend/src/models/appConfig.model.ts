// src/models/appConfig.model.ts
import { Schema, model, InferSchemaType, HydratedDocument, Model } from "mongoose";
import toJSON from "../utils/toJSON";

const AppConfigSchema = new Schema(
  {
    // free-form key: "global" or LC _id as hex string
    scope: { type: String, required: true, index: true, unique: true },
    inactivityMinutes: { type: Number, min: 1, max: 240, default: 20 },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

AppConfigSchema.plugin(toJSON as any);

export type AppConfig = InferSchemaType<typeof AppConfigSchema>;
export type AppConfigDoc = HydratedDocument<AppConfig>;
export type AppConfigModel = Model<AppConfig>;

export default model<AppConfig, AppConfigModel>("AppConfig", AppConfigSchema);
