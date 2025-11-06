// src/models/PickerTasks.model.ts
import mongoose, { Schema } from "mongoose";
import toJSON from "../utils/toJSON";

export const PICKER_TASK_STATUSES = [
  "open",
  "ready",
  "claimed",
  "in_progress",
  "done",
  "problem",
  "cancelled",
] as const;

export const SHIFT_NAMES = ["morning", "afternoon", "evening", "night"] as const;

/* ---------- Subdocs matching your PackingPlan ---------- */

// Piece inside a box
const BoxPieceSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    itemName: { type: String, default: undefined },
    pieceType: { type: String, enum: ["bag", "bundle"], required: true },
    mode: { type: String, enum: ["kg", "unit"], required: true },
    qtyKg: { type: Number, default: undefined },     // only for kg-mode
    units: { type: Number, default: undefined },     // only for unit-mode
    liters: { type: Number, required: true },
    estWeightKgPiece: { type: Number, required: true },
  },
  { _id: false }
);

// A planned box
const PlanBoxSchema = new Schema(
  {
    boxNo: { type: Number, required: true },
    boxType: { type: String, required: true },       // "Small" | "Medium" | "Large"
    vented: { type: Boolean, default: undefined },

    estFillLiters: { type: Number, required: true }, // sum of liters inside
    estWeightKg: { type: Number, required: true },   // sum of estWeightKgPiece of contents
    fillPct: { type: Number, required: true },       // estFillLiters / usableLiters(box)

    contents: { type: [BoxPieceSchema], default: [] },
  },
  { _id: false }
);

// Summary.byItem entry
const PlanSummaryItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    itemName: { type: String, default: undefined },
    bags: { type: Number, required: true },
    bundles: { type: Number, required: true },
    totalKg: { type: Number, default: undefined },
    totalUnits: { type: Number, default: undefined },
  },
  { _id: false }
);

// Plan summary
const PlanSummarySchema = new Schema(
  {
    totalBoxes: { type: Number, required: true },
    byItem: { type: [PlanSummaryItemSchema], default: [] },
    warnings: { type: [String], default: [] },
  },
  { _id: false }
);

// Full plan
const PlanSchema = new Schema(
  {
    boxes: { type: [PlanBoxSchema], default: [] },
    summary: { type: PlanSummarySchema, default: undefined },
  },
  { _id: false }
);

// Progress
const ProgressSchema = new Schema(
  {
    currentBoxIndex: { type: Number, default: 0 },
    currentStepIndex: { type: Number, default: 0 },
    placedKg: { type: Number, default: 0 },
    placedUnits: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { _id: false }
);

// Audit (optional)
const AuditEntrySchema = new Schema(
  {
    action: { type: String, required: true },
    note: { type: String, default: "" },
    by: {
      id: { type: Schema.Types.ObjectId, ref: "User" },
      name: String,
      role: String,
    },
    at: { type: Date, default: Date.now },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

/* ---------- Main schema ---------- */

const PickerTaskSchema = new Schema(
  {
    logisticCenterId: { type: Schema.Types.ObjectId, ref: "LogisticsCenter", required: true },
    shiftName: { type: String, enum: SHIFT_NAMES, required: true },
    shiftDate: { type: String, required: true }, // yyyy-LL-dd
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },

    // Full packing plan for the order
    plan: { type: PlanSchema, default: () => ({ boxes: [] }) },

    // Handy rollups (across plan.boxes)
    totalEstKg: { type: Number, default: 0 },
    totalLiters: { type: Number, default: 0 },
    totalEstUnits: { type: Number, default: 0 }, // if you want a units rollup

    status: { type: String, enum: PICKER_TASK_STATUSES, default: "open", index: true },
    priority: { type: Number, default: 0, index: true },

    assignedPickerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    progress: { type: ProgressSchema, default: () => ({}) },

    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
    notes: { type: String, default: "" },
  },
  {
    timestamps: true, // let Mongoose manage updatedAt/createdAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

PickerTaskSchema.plugin(toJSON);

/* ---------- Indexes ---------- */

// list/sort helpers
PickerTaskSchema.index({ shiftDate: 1, shiftName: 1, status: 1, priority: -1, createdAt: 1 });
PickerTaskSchema.index({ shiftDate: 1, shiftName: 1, assignedPickerUserId: 1 });
// unique: one task per (LC, shift, date, order)
PickerTaskSchema.index(
  { logisticCenterId: 1, shiftName: 1, shiftDate: 1, orderId: 1 },
  { unique: true, name: "uniq_task_per_shift_order" }
);
// optional shortcut
PickerTaskSchema.index({ logisticCenterId: 1, shiftName: 1, shiftDate: 1 ,orderId: 1});

export default mongoose.models.PickerTask ||
  mongoose.model("PickerTask", PickerTaskSchema);
