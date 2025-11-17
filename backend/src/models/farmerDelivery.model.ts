// models/farmerDelivery.model.ts
import {
  Schema,
  model,
  Types,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";
import { StageSchema } from "./shared/stage.schema";
import { AuditEntrySchema } from "./shared/audit.schema";
import { AddressSchema } from "./shared/address.schema";
import {
  FARMER_DELIVERY_STAGE_KEYS,
  type FarmerDeliveryStageKey,
} from "./shared/stage.types";
import { buildFarmerDeliveryDefaultStages } from "./shared/stage.utils";
import { SHIFTS } from "./farmerOrder.model";
import toJSON from "../utils/toJSON";

/* -------------------------------------------------------------------------- */
/*                           Stop-status enum (per stop)                      */
/* -------------------------------------------------------------------------- */

export const FARMER_DELIVERY_STOP_STATUSES = [
  "planned",
  "on_route",
  "arrived",
  "loading",
  "loaded",
  "skipped",
  "problem",
] as const;

export type FarmerDeliveryStopStatus =
  (typeof FARMER_DELIVERY_STOP_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*                               Scan sub-schema                              */
/* -------------------------------------------------------------------------- */

const StopScanSchema = new Schema(
  {
    containerId: { type: String, required: true },
    qrUrl: { type: String, required: true },

    farmerOrderId: {
      type: Types.ObjectId,
      ref: "FarmerOrder",
      required: true,
    },

    timestamp: { type: Date, default: Date.now },
    weightKg: { type: Number, min: 0, default: 0 },
    note: { type: String, default: "" },
  },
  { _id: false }
);

/* -------------------------------------------------------------------------- */
/*                              DeliveryStop schema                           */
/* -------------------------------------------------------------------------- */

const DeliveryStopSchema = new Schema(
  {
    // pickup or dropoff (LC could be modeled as a dropoff if you want later)
    type: {
      type: String,
      enum: ["pickup", "dropoff"],
      required: true,
    },

    // For UI: "Farm - Levy Cohen #2", "Warehouse LC-1", etc.
    label: { type: String, default: "" },

    // 🔹 Full address+location snapshot (AddressSchema)
    address: { type: AddressSchema, required: true },

    // 🔹 Logical info about this stop
    farmerId: {
      type: Types.ObjectId,
      ref: "Farmer",
      required: true,
    },
    farmerName: { type: String, required: true, trim: true },
    farmName: { type: String, required: true, trim: true },

    // All farmer orders collected at this stop
    farmerOrderIds: [
      {
        type: Types.ObjectId,
        ref: "FarmerOrder",
        required: true,
        index: true,
      },
    ],

    // sequence within the trip (0,1,2,...)
    sequence: { type: Number, required: true, min: 0 },

    // expectations (for checklist)
    expectedContainers: { type: Number, min: 0, default: 0 },
    expectedWeightKg: { type: Number, min: 0, default: 0 },

    // actuals (from container scans)
    scans: { type: [StopScanSchema], default: [] },
    loadedContainersCount: { type: Number, min: 0, default: 0 },
    loadedWeightKg: { type: Number, min: 0, default: 0 },

    // stop-level lifecycle
    status: {
      type: String,
      enum: FARMER_DELIVERY_STOP_STATUSES,
      default: "planned",
      index: true,
    },

    // time window for SLA checks
    plannedAt: { type: Date, required: true }, // ETA/plan
    arrivedAt: { type: Date, default: null },
    departedAt: { type: Date, default: null },

    // optional: more detailed loading timestamps
    loadingStartedAt: { type: Date, default: null },
    loadingFinishedAt: { type: Date, default: null },

    note: { type: String, default: "" },
  },
  { _id: false }
);

/* -------------------------------------------------------------------------- */
/*                            FarmerDelivery main schema                      */
/* -------------------------------------------------------------------------- */

const FarmerDeliverySchema = new Schema(
  {
    /* ------------------------- assignment / relations ------------------------ */

    // For planning we may not have a driver yet → make it optional
    delivererId: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // If you later have a LogisticCenter model, you can change to ObjectId+ref
    logisticCenterId: {
      // keep as string for now, e.g. "LC-1"
      type: String,
      required: true,
      index: true,
    },

    // Date + shift context
    pickUpDate: {
      type: String,
      required: true,
      index: true, // "YYYY-MM-DD"
    },
    shift: {
      type: String,
      enum: SHIFTS,
      required: true,
      index: true,
    },

    // shiftStartAt is key for your SLA: first stop ≤ +1.5h, return ≤ +3h
    shiftStartAt: { type: Date, default: null },

    /* ------------------------------ itinerary -------------------------------- */

    stops: { type: [DeliveryStopSchema], default: [] },

    /* ------------------------------ lifecycle (trip) ------------------------- */

    // Trip-level stage key, like FarmerOrder.stageKey
    stageKey: {
      type: String,
      enum: FARMER_DELIVERY_STAGE_KEYS,
      default: "planned",
      index: true,
    },

    // Timeline of trip stages (planned → assigned → en_route_to_farms → ...)
    stages: {
      type: [StageSchema],
      default: () => buildFarmerDeliveryDefaultStages(),
      validate: [
        {
          validator: (arr: any[]) =>
            (arr || []).every((s) =>
              FARMER_DELIVERY_STAGE_KEYS.includes(s?.key)
            ),
          message: "Invalid stage key in FarmerDelivery.stages",
        },
        {
          validator: (arr: any[]) =>
            (arr || []).filter((s) => s?.status === "current").length <= 1,
          message: "Only one stage may have status 'current'",
        },
      ],
    },

    // Rough planned/actual timings of whole trip
    plannedStartAt: { type: Date, default: null },
    actualStartAt: { type: Date, default: null },
    plannedEndAt: { type: Date, default: null },
    actualEndAt: { type: Date, default: null },

    // aggregates
    totalExpectedContainers: { type: Number, min: 0, default: 0 },
    totalLoadedContainers: { type: Number, min: 0, default: 0 },
    totalExpectedWeightKg: { type: Number, min: 0, default: 0 },
    totalLoadedWeightKg: { type: Number, min: 0, default: 0 },

    distanceKmPlanned: { type: Number, min: 0, default: null },
    distanceKmActual: { type: Number, min: 0, default: null },

    // audit trail
    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

/* -------------------------------------------------------------------------- */
/*                            plugins & indexes                                */
/* -------------------------------------------------------------------------- */

FarmerDeliverySchema.plugin(toJSON as any);

FarmerDeliverySchema.index({
  delivererId: 1,
  pickUpDate: 1,
  shift: 1,
});

FarmerDeliverySchema.index({
  logisticCenterId: 1,
  pickUpDate: 1,
  shift: 1,
});

/* -------------------------------------------------------------------------- */
/*                          types & methods                                   */
/* -------------------------------------------------------------------------- */

export type FarmerDelivery = InferSchemaType<typeof FarmerDeliverySchema>;
export type FarmerDeliveryDoc = HydratedDocument<FarmerDelivery>;

export interface FarmerDeliveryMethods {
  addAudit(
    userId: Types.ObjectId,
    action: string,
    note?: string,
    meta?: any
  ): void;

  setStageCurrent(
    key: FarmerDeliveryStageKey,
    userId: Types.ObjectId,
    opts?: { note?: string; expectedAt?: Date }
  ): void;

  markStageDone(
    key: FarmerDeliveryStageKey,
    userId: Types.ObjectId,
    opts?: { note?: string }
  ): void;

  recomputeAggregates(): void;
}

export type FarmerDeliveryModel = Model<
  FarmerDelivery,
  {},
  FarmerDeliveryMethods
>;

/* ------------------------------ method impls -------------------------------- */

FarmerDeliverySchema.methods.addAudit = function (
  this: FarmerDeliveryDoc & FarmerDeliveryMethods,
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

FarmerDeliverySchema.methods.setStageCurrent = function (
  this: FarmerDeliveryDoc & FarmerDeliveryMethods,
  key: FarmerDeliveryStageKey,
  userId: Types.ObjectId,
  opts: { note?: string; expectedAt?: Date } = {}
) {
  if (!FARMER_DELIVERY_STAGE_KEYS.includes(key)) {
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
    target = {
      key,
      label: key,
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

  this.stageKey = key;
  this.addAudit(userId, "STAGE_SET_CURRENT", opts.note, {
    key,
    expectedAt: opts.expectedAt,
  });
};

FarmerDeliverySchema.methods.markStageDone = function (
  this: FarmerDeliveryDoc & FarmerDeliveryMethods,
  key: FarmerDeliveryStageKey,
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

  if (this.stageKey === key) {
    // let the service decide next stage
  }

  this.addAudit(userId, "STAGE_MARK_DONE", opts.note, { key });
};

FarmerDeliverySchema.methods.recomputeAggregates = function (
  this: FarmerDeliveryDoc & FarmerDeliveryMethods
) {
  const stops = (this.stops || []) as any[];

  let expContainers = 0;
  let loadContainers = 0;
  let expKg = 0;
  let loadKg = 0;

  for (const s of stops) {
    expContainers += s.expectedContainers || 0;
    loadContainers += s.loadedContainersCount || 0;

    expKg += s.expectedWeightKg || 0;
    loadKg += s.loadedWeightKg || 0;
  }

  this.totalExpectedContainers = expContainers;
  this.totalLoadedContainers = loadContainers;
  this.totalExpectedWeightKg = expKg;
  this.totalLoadedWeightKg = loadKg;
};

/* ------------------------------- hooks -------------------------------------- */

FarmerDeliverySchema.pre("validate", function (next) {
  const doc = this as FarmerDeliveryDoc & FarmerDeliveryMethods;
  doc.recomputeAggregates();
  next();
});

/* ------------------------------- model export ------------------------------- */

export const FarmerDelivery = model<FarmerDelivery, FarmerDeliveryModel>(
  "FarmerDelivery",
  FarmerDeliverySchema
);

export default FarmerDelivery;
