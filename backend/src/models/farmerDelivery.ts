// models/farmerDelivery.model.ts
import { Schema, model, Types } from "mongoose";
import { StageSchema } from "./shared/stage.schema";
import { AuditEntrySchema } from "./shared/audit.schema";
import { AddressSchema } from "./shared/address.schema";

const StopScanSchema = new Schema(
  {
    containerId: { type: String, required: true },
    qrUrl: { type: String, required: true },
    farmerOrderId: { type: Types.ObjectId, ref: "FarmerOrder", required: true },
    timestamp: { type: Date, default: Date.now },
    weightKg: { type: Number, min: 0, default: 0 },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const DeliveryStopSchema = new Schema(
  {
    type: { type: String, enum: ["pickup", "dropoff"], required: true },
    label: { type: String, default: "" }, // e.g., "Farm - Levy Cohen #2", "Warehouse LC-1"
    address: { type: AddressSchema, required: true },
    plannedAt: { type: Date, required: true },
    arrivedAt: { type: Date, default: null },
    departedAt: { type: Date, default: null },
    scans: { type: [StopScanSchema], default: [] },
  },
  { _id: false }
);

const FarmerDeliverySchema = new Schema(
  {
    // Assignment
    delivererId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    vehicleId: { type: Types.ObjectId, ref: "Vehicle", default: null },

    // Run context
    date: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    shift: { type: String, enum: ["morning", "afternoon", "evening", "night"], required: true, index: true },
    logisticCenterId: { type: String, default: "LC-1", index: true },

    // Itinerary
    stops: { type: [DeliveryStopSchema], default: [] },

    // Lifecycle
    status: { type: String, enum: ["planned", "in_progress", "completed", "canceled", "problem"], default: "planned", index: true },
    stages: { type: [StageSchema], default: [] }, // optional parallel stages for the route

    // Audit
    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

FarmerDeliverySchema.index({ delivererId: 1, date: 1, shift: 1 });

export const FarmerDelivery = model("FarmerDelivery", FarmerDeliverySchema);
