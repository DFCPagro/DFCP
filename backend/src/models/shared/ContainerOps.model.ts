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
 * Details about sorting.  When a container is opened and its
 * contents are distributed among storage bins or shelves, the
 * sorting record captures the user, time and optional metadata
 * (such as the breakdown of quantities moved to each shelf).
 */
const SortingInfoSchema = new Schema(
  {
    sortedAt: { type: Date, default: null },
    by: { type: Types.ObjectId, ref: "User", default: null },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

/**
 * Location of the container within the facility.  A container may
 * reside in a warehouse overflow area, on a particular shelf slot
 * or be out for delivery.  For shelf placement the `shelfId` and
 * `slotId` identify the exact location.  For warehouse overflow
 * only the zone and aisle are stored.
 */
const LocationSchema = new Schema(
  {
    // 'warehouse' | 'shelf' | 'pickerShelf' | 'out'
    area: { type: String, enum: ["warehouse", "shelf", "pickerShelf", "out"], default: "warehouse" },
    zone: { type: String, default: null },
    aisle: { type: String, default: null },
    shelfId: { type: Types.ObjectId, ref: "Shelf", default: null },
    slotId: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Primary schema for container operations.  One document per
 * physical container.  The document references the container's
 * parent farmerOrder and item, stores a current state and holds
 * arrays of past weight measurements and audit events.  Indexes
 * enable fast lookups by `state`, `logisticCenterId` and
 * `containerId`.
 */
const ContainerOpsSchema = new Schema(
  {
    containerId: { type: String, required: true, index: true },
    farmerOrderId: { type: Types.ObjectId, ref: "FarmerOrder", required: true, index: true },
    itemId: { type: Types.ObjectId, ref: "Item", required: true },
    logisticCenterId: { type: Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },
    // Optional link back to the QR token used for scanning this container
    qrId: { type: Types.ObjectId, ref: "QRModel", default: null },
    state: { type: String, enum: CONTAINER_OPS_STATES, default: "arrived", index: true },
    weightHistory: { type: [WeightEntrySchema], default: [] },
    cleaning: { type: CleaningInfoSchema, default: {} },
    sorting: { type: SortingInfoSchema, default: {} },
    location: { type: LocationSchema, default: {} },
    auditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// Composite indexes for queries across facility and state
ContainerOpsSchema.index({ logisticCenterId: 1, state: 1 });
ContainerOpsSchema.index({ logisticCenterId: 1, "location.area": 1, "location.zone": 1 });

// Attach toJSON plugin for friendly JSON representations
ContainerOpsSchema.plugin(toJSON as any);

// Types inferred from the schema
export type ContainerOps = InferSchemaType<typeof ContainerOpsSchema>;
export type ContainerOpsDoc = HydratedDocument<ContainerOps>;
export type ContainerOpsModel = Model<ContainerOps>;

// Export model
export const ContainerOps = model<ContainerOps, ContainerOpsModel>("ContainerOps", ContainerOpsSchema);
export default ContainerOps;