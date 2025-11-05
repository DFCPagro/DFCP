// src/models/PickerTask.model.ts
import mongoose, {
  Schema,
  Types,
  model,
  models,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";
import toJSON from "../utils/toJSON";
import { AuditEntrySchema } from "./shared/audit.schema";

export const PICKER_TASK_STATUSES = [
  "open",        // created, not yet prepared for picking
  "ready",       // fully validated, available to be claimed
  "claimed",     // claimed by a picker, not started yet
  "in_progress", // picking started
  "done",        // picking completed & verified
  "problem",     // picker or manager flagged a problem
  "cancelled",
] as const;
export type PickerTaskStatus = (typeof PICKER_TASK_STATUSES)[number];

export const SHIFT_NAMES = ["morning", "afternoon", "evening", "night"] as const;
export type ShiftName = (typeof SHIFT_NAMES)[number];

/**
 * One row per SKU inside the box to be picked.
 * Denormalized name is kept for quick UI.
 */
const PickerTaskContentSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    name: { type: String, required: true, trim: true },

    // Estimates from packing plan (may be null)
    estWeightKgPiece: { type: Number, default: null, min: 0 },
    estUnitsPiece: { type: Number, default: null, min: 0 },
    liters: { type: Number, default: null, min: 0 },
  },
  { _id: false, timestamps: false }
);

/**
 * Main PickerTask schema — one task per BOX produced by the packing plan.
 * Tasks start as "open", move to "ready" when approved for pickers.
 */
const PickerTaskSchema = new Schema(
  {
    // --- Linkages ---
    logisticCenterId: {
      type: Schema.Types.ObjectId,
      ref: "LogisticCenter",
      required: true,
      index: true,
    },

    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },

    // --- Shift context ---
    shiftName: { type: String, enum: SHIFT_NAMES, required: true, index: true },
    // yyyy-LL-dd in LC timezone (string for partitioning)
    shiftDate: { type: String, required: true, index: true },

    // --- Box granularity ---
    boxNo: { type: Number, required: true, min: 1 },
    boxType: { type: String, required: true },

    contents: {
      type: [PickerTaskContentSchema],
      default: [],
      validate: {
        validator: (val: unknown[]) => Array.isArray(val) && val.length > 0,
        message: "PickerTask must contain at least one content row.",
      },
    },

    // --- Denormalized totals ---
    totalEstKg: { type: Number, required: true, min: 0, default: 0 },
    totalEstUnits: { type: Number, required: true, min: 0, default: 0 },
    totalLiters: { type: Number, required: true, min: 0, default: 0 },

    // --- State & assignment ---
    status: {
      type: String,
      enum: PICKER_TASK_STATUSES,
      default: "open",
      index: true,
    },

    priority: { type: Number, default: 0 },

    assignedPickerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // --- Progress ---
    progress: {
      currentStepIndex: { type: Number, default: 0, min: 0 },
      placedKg: { type: Number, default: 0, min: 0 },
      placedUnits: { type: Number, default: 0, min: 0 },
      startedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
    },

    // --- Audit & notes ---
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    notes: { type: String, default: "" },

    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// ---------- Plugins ----------
PickerTaskSchema.plugin(toJSON as any);

// ---------- Indexes ----------
PickerTaskSchema.index({ orderId: 1, boxNo: 1 }, { unique: true });
PickerTaskSchema.index({
  logisticCenterId: 1,
  shiftDate: 1,
  shiftName: 1,
  status: 1,
  priority: -1,
  createdAt: -1,
});
// Helpful compound indexes
PickerTaskSchema.index({ shiftDate: 1, shiftName: 1, status: 1, priority: -1, createdAt: 1 });
PickerTaskSchema.index({ shiftDate: 1, shiftName: 1, assignedPickerUserId: 1 });


// ---------- Methods / Interfaces ----------
export interface PickerTaskMethods {
  addAudit(
    userId: Types.ObjectId,
    action: string,
    note?: string,
    meta?: any
  ): void;
}

export type PickerTask = InferSchemaType<typeof PickerTaskSchema>;
export type PickerTaskDoc = HydratedDocument<PickerTask> & PickerTaskMethods;
export type PickerTaskModel = Model<PickerTask, {}, PickerTaskMethods>;

PickerTaskSchema.methods.addAudit = function (
  this: PickerTaskDoc,
  userId: Types.ObjectId,
  action: string,
  note = "",
  meta: any = {}
) {
  this.historyAuditTrail.push({
    userId,
    action,
    note,
    meta,
    timestamp: new Date(),
  });
};

// ---------- Pre-validate ----------
PickerTaskSchema.pre("validate", function (next) {
  const doc = this as PickerTaskDoc;

  doc.totalEstKg = Number.isFinite(doc.totalEstKg) ? doc.totalEstKg : 0;
  doc.totalEstUnits = Number.isFinite(doc.totalEstUnits) ? doc.totalEstUnits : 0;
  doc.totalLiters = Number.isFinite(doc.totalLiters) ? doc.totalLiters : 0;

  if (!Array.isArray(doc.contents) || doc.contents.length === 0) {
    return next(new Error("PickerTask must contain at least one content row."));
  }

  next();
});

// ---------- Export ----------
export const PickerTask =
  (models.PickerTask as PickerTaskModel) ||
  model<PickerTask, PickerTaskModel>("PickerTask", PickerTaskSchema);

export default PickerTask;
