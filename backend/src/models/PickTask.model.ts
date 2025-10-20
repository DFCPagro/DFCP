// models/PickTask.model.ts
//
// Represents a picking assignment within the logistics centre.  A
// PickTask is created once all items for an order are present on
// picker shelves.  It enumerates the items to be collected and
// allows assignment to a particular picker.  The task transitions
// through states (pending → in_progress → completed) and records
// audit events for observability.

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
 * States for a pick task.  A task starts in `pending` when it is
 * eligible to be picked, moves to `in_progress` when a picker
 * accepts it, and ends in `completed` once all items have been
 * gathered and packaged.  Tasks may be `canceled` if the order is
 * canceled or if stock becomes unavailable.
 */
export const PICK_TASK_STATUSES = ["pending", "in_progress", "completed", "canceled"] as const;
export type PickTaskStatus = (typeof PICK_TASK_STATUSES)[number];

/**
 * For each item required by the order this subdocument stores the
 * quantity in kilograms and/or units.  Quantity fields may be
 * zero if only one mode is applicable.  When performing the pick
 * operation the system should resolve actual container assignments
 * via the `shelfAssignments` array.
 */
const PickItemSchema = new Schema(
  {
    itemId: { type: Types.ObjectId, ref: "Item", required: true },
    quantityKg: { type: Number, default: 0, min: 0 },
    quantityUnits: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Each shelf assignment tells the picker which container to take and
 * how much product to remove.  When an item spans multiple
 * containers there will be multiple assignments.  The slotId
 * indicates the location on the shelf.
 */
const ShelfAssignmentSchema = new Schema(
  {
    containerOpsId: { type: Types.ObjectId, ref: "ContainerOps", required: true },
    shelfId: { type: Types.ObjectId, ref: "Shelf", required: true },
    slotId: { type: String, required: true },
    quantityKg: { type: Number, default: 0, min: 0 },
    quantityUnits: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const PickTaskSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true, index: true },
    logisticCenterId: { type: Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },
    state: { type: String, enum: PICK_TASK_STATUSES, default: "pending", index: true },
    assignedTo: { type: Types.ObjectId, ref: "User", default: null },
    suggestedAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    items: { type: [PickItemSchema], default: [] },
    shelfAssignments: { type: [ShelfAssignmentSchema], default: [] },
    /**
     * The sum of crowd scores for the shelves involved in this task.  This
     * value is computed by the task assignment service to allow selecting
     * the least crowded task for a picker.
     */
    aggregateCrowdScore: { type: Number, default: null },

    /**
     * Planning detail describing which shelf/slot will supply the items for
     * this task and the expected crowd score for that shelf.  Services
     * populate this when computing suggestions.
     */
    targetSlots: {
      type: [
        new Schema(
          {
            itemId: { type: Types.ObjectId, ref: "Item", required: true },
            shelfId: { type: Types.ObjectId, ref: "Shelf", required: true },
            slotId: { type: String, required: true },
            plannedKg: { type: Number, required: true, min: 0 },
            crowdScore: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    auditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// Index to quickly find tasks ready for picking
PickTaskSchema.index({ logisticCenterId: 1, state: 1 });

PickTaskSchema.plugin(toJSON as any);

export type PickTask = InferSchemaType<typeof PickTaskSchema>;
export type PickTaskDoc = HydratedDocument<PickTask>;
export type PickTaskModel = Model<PickTask>;

export const PickTask = model<PickTask, PickTaskModel>("PickTask", PickTaskSchema);
export default PickTask;