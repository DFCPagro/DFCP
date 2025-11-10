import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model, Types as MTypes } from "mongoose";
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

// ✅ Plan summary — mirrors top-level totals for convenience
const PlanSummarySchema = new Schema(
  {
    totalBoxes: { type: Number, required: true },
    byItem: { type: [PlanSummaryItemSchema], default: [] },
    warnings: { type: [String], default: [] },
    totalKg: { type: Number, default: undefined },
    totalLiters: { type: Number, default: undefined },
  },
  { _id: false }
);

// ✅ Full plan — give summary a default object
const PlanSchema = new Schema(
  {
    boxes: { type: [PlanBoxSchema], default: [] },
    summary: {
      type: PlanSummarySchema,
      default: () => ({ totalBoxes: 0, byItem: [], warnings: [] }),
    },
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
    plan: { type: PlanSchema, default: () => ({ boxes: [], summary: { totalBoxes: 0, byItem: [], warnings: [] } }) },

    // Handy rollups (across plan.boxes)
    totalEstKg: { type: Number, default: 0 },
    totalLiters: { type: Number, default: 0 },
    totalEstUnits: { type: Number, default: 0 },

    status: { type: String, enum: PICKER_TASK_STATUSES, default: "open", index: true },
    priority: { type: Number, default: 0, index: true },

    assignedPickerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    progress: { type: ProgressSchema, default: () => ({}) },

    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

PickerTaskSchema.plugin(toJSON);

/* ---------- Totals rollup: compute & mirror ---------- */

// Small helper to compute totals from plan
function rollupPlanTotals(plan?: {
  boxes?: Array<{
    estWeightKg?: number;
    estFillLiters?: number;
    contents?: Array<{ mode: "kg" | "unit"; qtyKg?: number; units?: number; liters?: number }>;
  }>;
}) {
  let totalKg = 0;
  let totalL = 0;
  let totalUnits = 0;

  for (const b of plan?.boxes ?? []) {
    if (typeof b.estWeightKg === "number") totalKg += b.estWeightKg;
    if (typeof b.estFillLiters === "number") totalL += b.estFillLiters;

    for (const p of b.contents ?? []) {
      if (p.mode === "unit" && typeof p.units === "number") totalUnits += p.units;
    }
  }

  return { totalKg, totalL, totalUnits };
}

// Compute totals on every save and mirror into summary
PickerTaskSchema.pre("save", function (next) {
  try {
    const plan: any = this.get("plan") || {};
    const boxes: any[] = plan.boxes || [];
    let summary: any = plan.summary;

    if (!summary) {
      summary = { totalBoxes: 0, byItem: [], warnings: [] };
      plan.summary = summary;
      this.set("plan", plan);
    }

    if (typeof summary.totalBoxes !== "number") {
      summary.totalBoxes = boxes.length || 0;
    }

    const { totalKg, totalL, totalUnits } = rollupPlanTotals(plan);

    this.set("totalEstKg", +Number(totalKg).toFixed(3));
    this.set("totalLiters", +Number(totalL).toFixed(3));
    this.set("totalEstUnits", totalUnits);

    summary.totalKg = +Number(totalKg).toFixed(3);
    summary.totalLiters = +Number(totalL).toFixed(3);

    next();
  } catch (e) {
    next(e as any);
  }
});

/* ---------- Indexes ---------- */

// Sort-friendly listing
PickerTaskSchema.index({ shiftDate: 1, shiftName: 1, status: 1, priority: -1, createdAt: 1 });
// Assignment queries
PickerTaskSchema.index({ shiftDate: 1, shiftName: 1, assignedPickerUserId: 1 });
// Unique: one task per (LC, shift, date, order)
PickerTaskSchema.index(
  { logisticCenterId: 1, shiftName: 1, shiftDate: 1, orderId: 1 },
  { unique: true, name: "uniq_task_per_shift_order" }
);
// Optional shortcut
PickerTaskSchema.index({ logisticCenterId: 1, shiftName: 1, shiftDate: 1, orderId: 1 });

// 🔹 Speed up “active-for-picker-in-shift” guard
PickerTaskSchema.index(
  { logisticCenterId: 1, shiftDate: 1, shiftName: 1, assignedPickerUserId: 1, status: 1 },
  { name: "ix_active_for_picker_in_shift" }
);

/* ---------- Types & Typed Model ---------- */

export type PickerTask = InferSchemaType<typeof PickerTaskSchema>;
export type PickerTaskDoc = HydratedDocument<PickerTask>;

/** Lean type for `.lean()` queries so `_id` is not `unknown` */
export type PickerTaskLean = Omit<PickerTask, "_id"> & { _id: MTypes.ObjectId };

const PickerTaskModelTyped: Model<PickerTask> =
  (mongoose.models.PickerTask as Model<PickerTask>) ||
  mongoose.model<PickerTask>("PickerTask", PickerTaskSchema);

export default PickerTaskModelTyped;
