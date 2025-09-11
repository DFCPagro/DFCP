import { Schema, model, InferSchemaType, HydratedDocument, Model, Types } from "mongoose";
import toJSON from "../utils/toJSON";

import { StageSchema } from "./shared/stage.schema";
import {
  FARMER_ORDER_STAGES,
  FARMER_ORDER_STAGE_KEYS,
  FarmerOrderStageKey,
} from "./shared/stage.types";
import { buildFarmerOrderDefaultStages } from "./shared/stage.utils";
import { AuditEntrySchema } from "./shared/audit.schema";
import {ContainerSchema} from "./shared/container.schema";


// ---------- enums ----------
export const SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
export type Shift = (typeof SHIFTS)[number];

export const FARMER_APPROVAL_STATUSES = ["pending", "ok", "problem"] as const;
export type FarmerApprovalStatus = (typeof FARMER_APPROVAL_STATUSES)[number];

// ---------- schema (no generics; infer later) ----------
const FarmerOrderSchema = new Schema(
  {
    // identity / relations
    itemId: { type: String, ref: "Item", required: true, index: true }, // Item._id is string in your Item model
    type: { type: String, default: "", trim: true },
    variety: { type: String, default: "", trim: true },
    pictureUrl: { type: String, default: "", trim: true },

    farmerId: { type: Schema.Types.ObjectId, ref: "Farmer", required: true, index: true },
    farmerName: { type: String, required: true, trim: true },
    farmName: { type: String, required: true, trim: true },

    landId: { type: Schema.Types.ObjectId, ref: "FarmerLand", default: null },
    sectionId: { type: String, default: "", trim: true },

    // planning / logistics
    shift: { type: String, enum: SHIFTS, required: true, index: true },
    pickUpDate: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    logisticCenterId: { type: String, default: "LC-1", index: true },

    // customer demand aggregation (explicit + derived)
    sumOrderedQuantityKg: { type: Number, required: true, min: 0 },

    // NEW: forecast & final
    // Keep your original spelling exactly; also expose a friendly alias "forecastedQuantityKg"
    forcastedQuantityKg: { type: Number, required: true, min: 0, alias: "forecastedQuantityKg" },
    finalQuantityKg: { type: Number, default: null, min: 0 }, // auto = sum(orders[].allocatedQuantityKg) * 1.02

    // linked customer orders contributing to this FarmerOrder
    orders: {
      type: [
        new Schema(
          {
            orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
            allocatedQuantityKg: { type: Number, min: 0, default: null },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
   

    // NEW: Containers linked to this farmer order
    containers: {
      type: [ContainerSchema],
      default: [],
    },

    // stages (with expected/started/completed in StageSchema)
    stages: {
      type: [StageSchema],
      default: () => buildFarmerOrderDefaultStages(),
      validate: [
        {
          validator: (arr: any[]) => (arr || []).every(s => FARMER_ORDER_STAGE_KEYS.includes(s?.key)),
          message: "Invalid stage key in FarmerOrder.stages",
        },
        {
          validator: (arr: any[]) => (arr || []).filter(s => s?.status === "current").length <= 1,
          message: "Only one stage may have status 'current'",
        },
      ],
    },

    // farmer-level approval/ack
    farmerStatus: { type: String, enum: FARMER_APPROVAL_STATUSES, default: "pending", index: true },

    // audit trail
    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// ---------- plugins & indexes ----------
FarmerOrderSchema.plugin(toJSON as any);

FarmerOrderSchema.index({ farmerId: 1, itemId: 1, pickUpDate: 1, shift: 1 });
FarmerOrderSchema.index({ logisticCenterId: 1, pickUpDate: 1, shift: 1 });
FarmerOrderSchema.index({ "stages.status": 1, updatedAt: -1 });
FarmerOrderSchema.index({ "orders.orderId": 1 });

// ---------- inferred types ----------
export type FarmerOrder = InferSchemaType<typeof FarmerOrderSchema>;
export type FarmerOrderDoc = HydratedDocument<FarmerOrder>;

// ---------- instance methods typings ----------
export interface FarmerOrderMethods {
  addAudit(userId: Types.ObjectId, action: string, note?: string, meta?: any): void;

  setStageCurrent(
    key: FarmerOrderStageKey,
    userId: Types.ObjectId,
    opts?: { note?: string; expectedAt?: Date }
  ): void;

  markStageDone(
    key: FarmerOrderStageKey,
    userId: Types.ObjectId,
    opts?: { note?: string }
  ): void;

  markStageOk(
    key: FarmerOrderStageKey,
    userId: Types.ObjectId,
    opts?: { note?: string }
  ): void;

  /** Link or update a customer order and optionally its allocated quantity */
  linkOrder(orderId: Types.ObjectId, allocatedQuantityKg?: number | null): void;

  /** Recalculate sumOrderedQuantityKg and finalQuantityKg (= sum * 1.02, rounded to 2 decimals) */
  recalcQuantities(): void;
}

export type FarmerOrderModel = Model<FarmerOrder, {}, FarmerOrderMethods>;

// ---------- methods impl ----------
FarmerOrderSchema.methods.addAudit = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  userId: Types.ObjectId,
  action: string,
  note = "",
  meta: any = {}
) {
  this.historyAuditTrail.push({ userId, action, note, meta, timestamp: new Date() });
};

FarmerOrderSchema.methods.setStageCurrent = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  key: FarmerOrderStageKey,
  userId: Types.ObjectId,
  opts: { note?: string; expectedAt?: Date } = {}
) {
  if (!FARMER_ORDER_STAGE_KEYS.includes(key)) throw new Error(`Invalid stage key: ${key}`);

  const now = new Date();

  for (const s of this.stages as any[]) {
    if (s.status === "current") {
      s.status = "done";
      s.completedAt = now;
      s.timestamp = now;
    }
  }

  let target: any = (this.stages as any[]).find(s => s.key === key);
  if (!target) {
    const template = FARMER_ORDER_STAGES.find(s => s.key === key);
    target = {
      key,
      label: template?.label || key,
      status: "current",
      expectedAt: opts.expectedAt ?? null,
      startedAt: now,
      completedAt: null,
      timestamp: now,
      note: opts.note || "",
    };
    (this.stages as any[]).push(target);
  } else {
    target.status = "current";
    target.startedAt = target.startedAt ?? now;
    target.timestamp = now;
    if (opts.note) target.note = opts.note;
    if (opts.expectedAt !== undefined) target.expectedAt = opts.expectedAt;
  }

  this.addAudit(userId, "STAGE_SET_CURRENT", opts.note, { key, expectedAt: opts.expectedAt });
};

FarmerOrderSchema.methods.markStageDone = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  key: FarmerOrderStageKey,
  userId: Types.ObjectId,
  opts: { note?: string } = {}
) {
  const now = new Date();
  const s: any = (this.stages as any[]).find(x => x.key === key);
  if (!s) throw new Error(`Stage not found: ${key}`);

  s.status = "done";
  s.completedAt = now;
  s.timestamp = now;
  if (opts.note) s.note = opts.note;

  this.addAudit(userId, "STAGE_MARK_DONE", opts.note, { key });
};

FarmerOrderSchema.methods.markStageOk = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  key: FarmerOrderStageKey,
  userId: Types.ObjectId,
  opts: { note?: string } = {}
) {
  const now = new Date();
  const s: any = (this.stages as any[]).find(x => x.key === key);
  if (!s) throw new Error(`Stage not found: ${key}`);

  s.status = "ok";
  s.timestamp = now;
  s.startedAt = s.startedAt ?? now;
  if (opts.note) s.note = opts.note;

  this.addAudit(userId, "STAGE_SET_OK", opts.note, { key });
};

FarmerOrderSchema.methods.linkOrder = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  orderId: Types.ObjectId,
  allocatedQuantityKg: number | null = null
) {
  const existing = (this.orders as any[]).find(e => e.orderId?.toString() === orderId.toString());
  if (existing) {
    if (allocatedQuantityKg !== null && allocatedQuantityKg !== undefined) {
      existing.allocatedQuantityKg = allocatedQuantityKg;
    }
  } else {
    (this.orders as any[]).push({ orderId, allocatedQuantityKg });
  }

  // keep aggregates in sync
  this.recalcQuantities();
};

FarmerOrderSchema.methods.recalcQuantities = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods
) {
  const sum = (this.orders as any[])
    .map((o: any) => Number(o.allocatedQuantityKg) || 0)
    .reduce((a: number, b: number) => a + b, 0);

  // reflect totals:
  this.sumOrderedQuantityKg = sum;

  // final = sum * 1.02 (2% buffer), round to 2 decimals
  const finalRaw = sum * 1.02;
  this.finalQuantityKg = Math.round(finalRaw * 100) / 100;
};




// ---------- hooks ----------
// Whenever the doc validates, ensure aggregate quantities reflect 'orders'
FarmerOrderSchema.pre("validate", function (next) {
  const doc = this as HydratedDocument<FarmerOrder> & FarmerOrderMethods;

  // keep aggregates consistent even if orders changed via direct array ops
  doc.recalcQuantities();

  // Note: 'forcastedQuantityKg' is required. If you need a default, set it earlier in your service.
  next();
});

// ---------- model ----------
export const FarmerOrder = model<FarmerOrder, FarmerOrderModel>("FarmerOrder", FarmerOrderSchema);
export default FarmerOrder;
