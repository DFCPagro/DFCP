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
    // For warehouse/out: zone/aisle optional. For shelf/pickerShelf: shelfId + slotId are used.
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
    /**
     * Intended weight in kilograms for this container.  When a container
     * is sorted, the sorter indicates how many kilograms should be
     * placed onto shelves.  The container remains in the `sorted` state
     * until the sum of distributed weights equals this value.  This
     * field is persisted as Decimal128 for precision.
     */
    intendedWeightKg: { type: Schema.Types.Decimal128, required: true, default: () => Types.Decimal128.fromString("0"), min: 0 },

    /**
     * Total weight in kilograms across all shelves/slots.  This field is
     * maintained by services when placing, consuming, refilling or moving
     * containers.  It is stored as Decimal128 to avoid floating point
     * errors.
     */
    totalWeightKg: { type: Schema.Types.Decimal128, required: true, default: () => Types.Decimal128.fromString("0"), min: 0 },

    /**
     * Record of distributed weights across shelves/slots.  Each entry
     * identifies a shelf and slot and how much weight is present.  The
     * sum of all `weightKg` values should equal `totalWeightKg`.
     */
    distributedWeights: {
      type: [
        new Schema(
          {
            shelfId: { type: Types.ObjectId, ref: "Shelf", required: true },
            slotId: { type: String, required: true },
            weightKg: { type: Schema.Types.Decimal128, required: true, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

 // Validation: ensure the sum of distributed weightKg equals totalWeightKg
ContainerOpsSchema.pre("validate", function (next) {
  const doc = this as any;
  // Only validate when distributedWeights is present and totalWeightKg is defined
  if (!doc.distributedWeights || typeof doc.totalWeightKg === "undefined") return next();
  try {
    const sum = Array.isArray(doc.distributedWeights)
      ? doc.distributedWeights.reduce((acc: number, entry: any) => {
          const val = entry?.weightKg ? parseFloat(entry.weightKg.toString()) : 0;
          return acc + val;
        }, 0)
      : 0;
    const total = doc.totalWeightKg ? parseFloat(doc.totalWeightKg.toString()) : 0;
    // allow tiny floating point epsilon
    if (Math.abs(sum - total) > 1e-6) {
      return next(new Error(`Sum of distributedWeights (${sum}) does not equal totalWeightKg (${total})`));
    }
    return next();
  } catch (e) {
    return next(e as any);
  }
});

// Composite indexes for queries across facility and state
ContainerOpsSchema.index({ logisticCenterId: 1, state: 1 });
ContainerOpsSchema.index({ logisticCenterId: 1, "location.area": 1, "location.zone": 1 });

// Attach toJSON plugin for friendly JSON representations
ContainerOpsSchema.plugin(toJSON as any);

// ✨ keep location.updatedAt fresh if location changes
ContainerOpsSchema.pre("save", function (next) {
  const doc = this as ContainerOpsDoc;
  if (doc.isModified("location")) {
    doc.set("location.updatedAt", new Date());
  }
  next();
});

// Types inferred from the schema
export type ContainerOps = InferSchemaType<typeof ContainerOpsSchema>;
export type ContainerOpsDoc = HydratedDocument<ContainerOps>;
export type ContainerOpsModel = Model<ContainerOps>;

// Export model
export const ContainerOps = model<ContainerOps, ContainerOpsModel>("ContainerOps", ContainerOpsSchema);
export default ContainerOps;
