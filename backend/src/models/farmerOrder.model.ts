// src/models/farmerOrder.model.ts
import {
  Schema,
  model,
  InferSchemaType,
  HydratedDocument,
  Model,
  Types,
} from "mongoose";
import toJSON from "../utils/toJSON";

import { StageSchema } from "./shared/stage.schema";
import {
  FARMER_ORDER_STAGES,
  FARMER_ORDER_STAGE_KEYS,
  FarmerOrderStageKey,
} from "./shared/stage.types";
import { buildFarmerOrderDefaultStages } from "./shared/stage.utils";
import { AuditEntrySchema } from "./shared/audit.schema";
// ⛔ Removed: embedded ContainerSchema (we now reference ContainerOps)
// import { ContainerSchema } from "./shared/container.schema";

// ---------- enums ----------
export const SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
export type Shift = (typeof SHIFTS)[number];

export const FARMER_APPROVAL_STATUSES = ["pending", "ok", "problem"] as const;
export type FarmerApprovalStatus = (typeof FARMER_APPROVAL_STATUSES)[number];

// ---------- sub-schema: linked customer orders (orderId + allocated kg) ----------
const OrderLinkSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    // Store as allocatedQuantityKg; expose alias orderedQuantityKg for readability in JSON/TS
    allocatedQuantityKg: {
      type: Number,
      min: 0,
      default: 0, // avoid null→number issues
      alias: "orderedQuantityKg",
    },
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------- OPTIONAL tiny snapshot (non-authoritative) ----------
// If you want quick UI lists without populate, you can keep a tiny snapshot per container.
// IMPORTANT: Do NOT write business logic against snapshots — ContainerOps is the truth.
const ContainerMiniSnapshotSchema = new Schema(
  {
    containerOpsId: {
      type: Schema.Types.ObjectId,
      ref: "ContainerOps",
      required: true,
      index: true,
    },
    containerId: { type: String, required: true },
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    state: {
      type: String,
      enum: [
        "arrived",
        "rejected",
        "cleaning",
        "cleaned",
        "weighing",
        "weighed",
        "sorting",
        "sorted",
        "stored",
        "shelved",
        "picked",
        "packaged",
        "dispatched",
        "depleted",
      ],
      required: true,
    },
    totalWeightKg: { type: Number, default: 0 },
    locationArea: {
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
    capturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ---------- main schema ----------
const FarmerOrderSchema = new Schema(
  {
    // timestamps handled by { timestamps: true } below
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // identity / relations
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    type: { type: String, default: "", trim: true },
    variety: { type: String, default: "", trim: true },
    pictureUrl: { type: String, default: "", trim: true },

    farmerId: {
      type: Schema.Types.ObjectId,
      ref: "Farmer",
      required: true,
    },
    farmerName: { type: String, required: true, trim: true },
    farmName: { type: String, required: true, trim: true },
    farmLogo: { type: String, default: null },
    // planning / logistics
    shift: { type: String, enum: SHIFTS, required: true },
    pickUpDate: { type: String, required: true }, // "YYYY-MM-DD"
    pickUpTime: { type: Date, required: false }, 
    logisticCenterId: {
      type: Schema.Types.ObjectId,
      ref: "LogisticCenter",
      required: true,
    },

    // farmer-level approval/ack (legacy high-level status)
    farmerStatus: {
      type: String,
      enum: FARMER_APPROVAL_STATUSES,
      default: "pending",
      index: true,
    },

    // customer demand aggregation (explicit + derived)
    // expose friendly alias "orderedQuantityKg" for the sum as well
    sumOrderedQuantityKg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      alias: "orderedQuantityKg",
    },

    // forecast & final
    // keep original spelling + alias, add default to avoid required errors
    forcastedQuantityKg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      alias: "forecastedQuantityKg",
    },
    finalQuantityKg: { type: Number, min: 0 }, // optional; computed in recalcQuantities()

    // linked customer orders contributing to this FarmerOrder
    orders: {
      type: [OrderLinkSchema],
      default: [],
    },

    // ⛳️ Containers linked to this farmer order — now as references to ContainerOps (authoritative)
    containers: [
      {
        type: Schema.Types.ObjectId,
        ref: "ContainerOps",
        index: true,
      },
    ],

    // OPTIONAL: non-authoritative, minimal snapshots for UI lists.
    // Keep or drop based on your needs. If you keep it, refresh via service on transitions.
    containerSnapshots: {
      type: [ContainerMiniSnapshotSchema],
      default: [],
    },

    /**
     * stageKey = which stage is "active"/in focus for this farmer order
     * We keep it in sync in our service + helpers.
     */
    stageKey: {
      type: String,
      enum: FARMER_ORDER_STAGE_KEYS,
      default: null,
      index: true,
    },

    // stages (with expected/started/completed in StageSchema)
    stages: {
      type: [StageSchema],
      default: () => buildFarmerOrderDefaultStages(),
      validate: [
        {
          validator: (arr: any[]) =>
            (arr || []).every((s) => FARMER_ORDER_STAGE_KEYS.includes(s?.key)),
          message: "Invalid stage key in FarmerOrder.stages",
        },
        {
          validator: (arr: any[]) =>
            (arr || []).filter((s) => s?.status === "current").length <= 1,
          message: "Only one stage may have status 'current'",
        },
      ],
    },

    // --- QS reports ---
    farmersQSreport: {
      type: Schema.Types.Mixed, // keep original type if QSReportSchema not required here
      default: undefined,
    }, // farmer’s submitted QS values
    inspectionQSreport: {
      type: Schema.Types.Mixed, // keep original type if QSReportSchema not required here
      default: undefined,
    }, // LC/inspection QS values

    // --- quick visual inspection status (optional) ---
    visualInspection: {
      type: Schema.Types.Mixed, // keep original type if VisualInspectionSchema not required here
      default: undefined,
    },
    inspectionStatus: {
      type: String,
      enum: ["pending", "passed", "failed"],
      default: "pending",
      index: true,
    },

    // audit trail
    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// ---------- plugins & indexes ----------
FarmerOrderSchema.plugin(toJSON as any);

FarmerOrderSchema.index({
  farmerId: 1,
  itemId: 1,
  pickUpDate: 1,
  shift: 1,
});
FarmerOrderSchema.index({
  logisticCenterId: 1,
  pickUpDate: 1,
  shift: 1,
});
FarmerOrderSchema.index({ stageKey: 1, updatedAt: -1 });
FarmerOrderSchema.index({ "stages.status": 1, updatedAt: -1 });
FarmerOrderSchema.index({ "orders.orderId": 1 });
FarmerOrderSchema.index({ containers: 1 }); // helpful for lookups by container

// ---------- inferred types ----------
export type FarmerOrder = InferSchemaType<typeof FarmerOrderSchema>;
export type FarmerOrderDoc = HydratedDocument<FarmerOrder>;

// ---------- instance methods typings ----------
export interface FarmerOrderMethods {
  addAudit(
    userId: Types.ObjectId,
    action: string,
    note?: string,
    meta?: any
  ): void;

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

  /** Link or update a customer order and optionally its allocated quantity (kg) */
  linkOrder(
    orderId: Types.ObjectId,
    allocatedQuantityKg?: number | null
  ): void;

  /** Recalculate sumOrderedQuantityKg and finalQuantityKg (= sum * 1.02, rounded to 2 decimals) */
  recalcQuantities(): void;

  /** Compare QS inputs and set inspectionStatus accordingly */
  recomputeInspectionStatus(): void;
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
  this.historyAuditTrail.push({
    userId,
    action,
    note,
    meta,
    timestamp: new Date(),
  });
};

FarmerOrderSchema.methods.setStageCurrent = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  key: FarmerOrderStageKey,
  userId: Types.ObjectId,
  opts: { note?: string; expectedAt?: Date } = {}
) {
  if (!FARMER_ORDER_STAGE_KEYS.includes(key)) {
    throw new Error(`Invalid stage key: ${key}`);
  }

  const now = new Date();

  // any old current -> done
  for (const s of this.stages as any[]) {
    if (s.status === "current") {
      s.status = "done";
      s.completedAt = now;
      s.timestamp = now;
    }
  }

  let target: any = (this.stages as any[]).find((s) => s.key === key);
  if (!target) {
    const template = FARMER_ORDER_STAGES.find((s) => s.key === key);
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

  // keep stageKey synced
  (this as any).stageKey = key;

  this.addAudit(userId, "STAGE_SET_CURRENT", opts.note, {
    key,
    expectedAt: opts.expectedAt,
  });
};

FarmerOrderSchema.methods.markStageDone = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  key: FarmerOrderStageKey,
  userId: Types.ObjectId,
  opts: { note?: string } = {}
) {
  const now = new Date();
  const s: any = (this.stages as any[]).find((x) => x.key === key);
  if (!s) throw new Error(`Stage not found: ${key}`);

  s.status = "done";
  s.completedAt = now;
  s.timestamp = now;
  if (opts.note) s.note = opts.note;

  // if we just marked the active stage as done and stageKey == key,
  // we do NOT auto-advance here; caller/service decides what becomes current next.
  if ((this as any).stageKey === key) {
    // leave stageKey as-is for now; service may overwrite
  }

  this.addAudit(userId, "STAGE_MARK_DONE", opts.note, { key });
};

FarmerOrderSchema.methods.markStageOk = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  key: FarmerOrderStageKey,
  userId: Types.ObjectId,
  opts: { note?: string } = {}
) {
  const now = new Date();
  const s: any = (this.stages as any[]).find((x) => x.key === key);
  if (!s) throw new Error(`Stage not found: ${key}`);

  s.status = "ok";
  s.timestamp = now;
  s.startedAt = s.startedAt ?? now;
  if (opts.note) s.note = opts.note;

  // if we "ok" the active stage, we don't force-advance stageKey here.
  // service handles moving to the next stage and calling setStageCurrent.
  this.addAudit(userId, "STAGE_SET_OK", opts.note, { key });
};

FarmerOrderSchema.methods.linkOrder = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods,
  orderId: Types.ObjectId,
  allocatedQuantityKg: number | null = null
) {
  const existing = (this.orders as any[]).find(
    (e) => e.orderId?.toString() === orderId.toString()
  );
  if (existing) {
    if (allocatedQuantityKg !== null && allocatedQuantityKg !== undefined) {
      existing.allocatedQuantityKg = allocatedQuantityKg;
    }
  } else {
    (this.orders as any[]).push({
      orderId,
      allocatedQuantityKg: allocatedQuantityKg ?? 0,
    });
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
  this.sumOrderedQuantityKg = Math.round(sum * 1000) / 1000;

  // final = sum * 1.02 (2% buffer), round to 2 decimals
  const finalRaw = sum * 1.02;
  this.finalQuantityKg = Math.round(finalRaw * 100) / 100;
};

FarmerOrderSchema.methods.recomputeInspectionStatus = function (
  this: HydratedDocument<FarmerOrder> & FarmerOrderMethods
) {
  const visualOk = (this as any).visualInspection?.status === "ok";
  const farmerVals = (this as any).farmersQSreport?.values;
  const inspVals = (this as any).inspectionQSreport?.values;

  // gate 1: need visual ok
  if (!visualOk) {
    (this as any).inspectionStatus = "pending";
    return;
  }

  // gate 2: need both QS inputs
  if (!farmerVals || !inspVals) {
    (this as any).inspectionStatus = "pending";
    return;
  }

  // optional: compare overall grades if provided
  const farmerGrade = (this as any).farmersQSreport?.overallGrade || "";
  const inspGrade = (this as any).inspectionQSreport?.overallGrade || "";
  if (farmerGrade && inspGrade && farmerGrade !== inspGrade) {
    (this as any).inspectionStatus = "failed";
    return;
  }

  // compare numeric metrics present in BOTH inputs
  const farmerValsAny = farmerVals as any;
  const inspValsAny = inspVals as any;

  const keys = [
    "brix",
    "acidityPercentage",
    "pressure",
    "colorPercentage",
    "weightPerUnitG",
    "diameterMM",
    "maxDefectRatioLengthDiameter",
    "rejectionRate",
  ];

  const within2Percent = (a: number, b: number) => {
    const A = Number(a),
      B = Number(b);
    if (!Number.isFinite(A) || !Number.isFinite(B)) return true; // ignore non-finite
    const denom = Math.max(Math.abs(A), Math.abs(B), 1e-9); // avoid divide-by-zero
    return Math.abs(A - B) / denom <= 0.02; // 2% relative tolerance
  };

  for (const k of keys) {
    const fv = farmerValsAny?.[k];
    const iv = inspValsAny?.[k];
    if (fv == null || iv == null) continue; // only compare when both are present
    if (!within2Percent(fv, iv)) {
      (this as any).inspectionStatus = "failed";
      return;
    }
  }

  (this as any).inspectionStatus = "passed";
};

// ---------- hooks ----------
// Keep aggregates consistent even if orders changed via direct array ops
FarmerOrderSchema.pre("validate", function (next) {
  const doc = this as HydratedDocument<FarmerOrder> & FarmerOrderMethods;
  doc.recalcQuantities();
  next();
});

// ---------- model ----------
export const FarmerOrder = model<FarmerOrder, FarmerOrderModel>(
  "FarmerOrder",
  FarmerOrderSchema
);
export default FarmerOrder;
