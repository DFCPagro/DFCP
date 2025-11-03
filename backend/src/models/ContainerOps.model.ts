// models/ContainerOps.model.ts
//
// Representation of a container once it arrives at the logistics centre.
// This entity tracks the full lifecycle of the container from intake
// through cleaning, weighing, sorting, shelving, picking and handoff.
// It is separate from the embedded container document inside
// FarmerOrder in order to provide operational metadata and allow
// concurrency control and indexing across all active containers.

import {
  Schema,
  model,
  Types,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";
import toJSON from "../utils/toJSON";
import { AuditEntrySchema } from "./shared/audit.schema";

/**
 * Discrete states a container can be in while inside the logistics
 * centre.  State transitions are driven by scan events and
 * operators.  See state machine documentation for valid
 * transitions.
 */
export const CONTAINER_OPS_STATES = [
  "arrived",        // scanned at intake
  "rejected",       // failed inspection
  "cleaning",       // en route to or at cleaning station
  "cleaned",        // cleaning completed
  "weighing",       // waiting to be weighed
  "weighed",        // weight recorded
  "sorting",        // being sorted into storage/picker bins
  "sorted",         // sorting complete
  "stored",         // placed in warehouse overflow area
  "shelved",        // placed on a shelf and available for orders
  "picked",         // items allocated for picking
  "packaged",       // items packaged into an order package
  "dispatched",     // handed off to delivery personnel
  "depleted",       // container emptied or contents fully used; slot freed for reassignment
] as const;
export type ContainerOpsState = (typeof CONTAINER_OPS_STATES)[number];

/**
 * Record of each weighing operation.  Containers may be weighed
 * multiple times (e.g., initial weight and after cleaning).  Each
 * entry captures the measured weight, the responsible operator and
 * the time of measurement.
 */
const WeightEntrySchema = new Schema(
  {
    valueKg: { type: Number, required: true, min: 0 },
    at: { type: Date, default: Date.now },
    by: { type: Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

/**
 * Subdocument capturing cleaning information.  This structure
 * records when cleaning started and finished, who performed it and
 * any notes recorded by the operator (e.g., condition of produce).
 */
const CleaningInfoSchema = new Schema(
  {
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    by: { type: Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * Sorting information for a container.  Captures when sorting begins
 * and ends, who performed it, and any free-form notes.
 */
const SortingInfoSchema = new Schema(
  {
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    by: { type: Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * Location within the facility or outside (e.g., dispatched/out).
 * `updatedAt` is also kept in sync via a pre-save hook.
 */
const LocationSchema = new Schema(
  {
    area: {
      type: String,
      enum: [
        "intake",
        "cleaning",
        "weighing",
        "sorting",
        "warehouse",
        "shelf",
        "picker",
        "out",
      ],
      default: "intake",
    },
    zone: { type: String, default: null },
    aisle: { type: String, default: null },
    shelfId: { type: Types.ObjectId, ref: "Shelf", default: null },
    slotId: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Main operational model for containers within the LC.
 */
const ContainerOpsSchema = new Schema(
  {
    containerId: { type: String, required: true, index: true },
    farmerOrderId: { type: Types.ObjectId, ref: "FarmerOrder", default: null },
    itemId: { type: Types.ObjectId, ref: "Item", required: true },

    // logistics centre this container is currently associated with
    logisticCenterId: {
      type: Types.ObjectId,
      ref: "LogisticsCenter",
      required: true,
      index: true,
    },

    // current operational state
    state: {
      type: String,
      enum: CONTAINER_OPS_STATES,
      default: "arrived",
      index: true,
    },

    // physical location metadata
    location: { type: LocationSchema, default: () => ({}) },

    // weights
    intendedWeightKg: { type: Number, default: 0 },
    totalWeightKg: { type: Number, default: 0 },
    weightHistory: { type: [WeightEntrySchema], default: [] },

    // distribution across shelves (for multi-slot presence)
    distributedWeights: {
      type: [
        new Schema(
          {
            shelfId: { type: Types.ObjectId, ref: "Shelf", required: true },
            slotId: { type: String, required: true },
            weightKg: { type: Number, required: true, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    // process details
    cleaning: { type: CleaningInfoSchema, default: () => ({}) },
    sorting: { type: SortingInfoSchema, default: () => ({}) },

    // audits
    auditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// indexes to support common queries
ContainerOpsSchema.index({ logisticCenterId: 1, state: 1 });
ContainerOpsSchema.index({
  logisticCenterId: 1,
  "location.area": 1,
  "location.zone": 1,
});

// Attach toJSON plugin for friendly JSON representations
ContainerOpsSchema.plugin(toJSON as any);

// give `containerId` a sensible default if missing
ContainerOpsSchema.pre("validate", function (next) {
  const doc = this as ContainerOpsDoc;
  if (!doc.containerId && (doc as any)._id) {
    doc.containerId = String((doc as any)._id);
  }
  next();
});

// ✨ keep location.updatedAt fresh if location changes
ContainerOpsSchema.pre("save", function (next) {
  const doc = this as ContainerOpsDoc;
  if (doc.isModified("location")) {
    doc.set("location.updatedAt", new Date());
  }
  next();
});

// Export the raw schema for reuse in shared schemas.  Other modules
// can import `ContainerOpsSchema` when embedding container documents
// to guarantee a single source of truth for field names and types.
export { ContainerOpsSchema };

// Types inferred from the schema
export type ContainerOps = InferSchemaType<typeof ContainerOpsSchema>;
export type ContainerOpsDoc = HydratedDocument<ContainerOps>;
export type ContainerOpsModel = Model<ContainerOps>;

// Export model
export const ContainerOps = model<ContainerOps, ContainerOpsModel>("ContainerOps", ContainerOpsSchema);
export default ContainerOps;
