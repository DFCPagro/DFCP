// models/shared/container.schema.ts
import { Schema, Types } from "mongoose";
import { StageSchema } from "./stage.schema";

export const ContainerSchema = new Schema({
  containerId: { type: String, required: true },
  farmerOrder: { type: Types.ObjectId, ref: "FarmerOrder", required: true, index: true },
  itemId: { type: Types.ObjectId, ref: "Item", required: true },
  weightKg: { type: Schema.Types.Decimal128, min: 0, default: 0 },
  stages: { type: [StageSchema], default: [] },
  warehouseSlot: {
    shelfLocation: { type: String, default: "" },
    zone: { type: String, default: "" },
    location: { type: String, enum: ["warehouse","pickerShelf","inTruck","inTransit","unknown"], default: "unknown" },
    timestamp: { type: Date, default: Date.now },
  },
}, { _id: false });