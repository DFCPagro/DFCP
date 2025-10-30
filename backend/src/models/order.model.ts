// src/models/order.model.ts
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
import { AddressSchema } from "./shared/address.schema";
import { AuditEntrySchema } from "./shared/audit.schema";
import { StageSchema } from "./shared/stage.schema";
import {
  ORDER_STAGE_KEYS,
  OrderStageKey,
} from "./shared/stage.types";

export const UNIT_MODES = ["kg", "unit", "mixed"] as const;
export type UnitMode = (typeof UNIT_MODES)[number];

const DELIVERY_FEE_USD = 5;
const DEFAULT_TOLERANCE = 0.1; // 10%

/**
 * Order line:
 * - pricePerUnit is price per KG
 * - pricePerKg mirrors pricePerUnit for clarity
 * - derivedUnitPrice is optional UI helper for "unit"/"mixed"
 * - estimatedEffectiveKg = quantityKg + units * avgWeightPerUnitKg
 * - finalWeightKg is from packing
 */
const OrderItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },

    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    category: { type: String, default: "" },

    pricePerUnit: { type: Number, required: true, min: 0 }, // per KG (legacy name)
    pricePerKg: { type: Number, required: true, min: 0 },   // same value, explicit
    derivedUnitPrice: { type: Number, default: null, min: 0 },

    unitMode: { type: String, enum: UNIT_MODES, required: true, default: "kg" },

    quantityKg: { type: Number, default: 0, min: 0 },
    units: { type: Number, default: 0, min: 0 },

    estimatesSnapshot: {
      avgWeightPerUnitKg: { type: Number, default: null, min: 0 },
      stdDevKg: { type: Number, default: null, min: 0 },
    },

    finalWeightKg: { type: Number, min: 0 }, // actual after packing
    finalizedAt: { type: Date },
    finalizedBy: { type: Schema.Types.ObjectId, ref: "User", index: true },

    sourceFarmerName: { type: String, required: true, trim: true },
    sourceFarmName: { type: String, required: true, trim: true },
    farmerOrderId: { type: Schema.Types.ObjectId, ref: "FarmerOrder", required: true },
  },
  { _id: false, timestamps: false }
);

// ----- Line methods -----
(OrderItemSchema as any).methods.estimatedEffectiveKg = function (): number {
  const avg = this.estimatesSnapshot?.avgWeightPerUnitKg || 0;
  const fromUnits = (this.units || 0) * avg;
  const fromKg = this.quantityKg || 0;
  return Math.round((fromKg + fromUnits) * 1000) / 1000;
};

(OrderItemSchema as any).methods.estimatedLineSubtotal = function (): number {
  const kg = (this as any).estimatedEffectiveKg();
  return Math.round(((this.pricePerUnit || 0) * kg) * 100) / 100;
};

(OrderItemSchema as any).methods.finalLineSubtotal = function (): number {
  if (!Number.isFinite(this.finalWeightKg)) return 0;
  return Math.round(((this.pricePerUnit || 0) * (this.finalWeightKg || 0)) * 100) / 100;
};

// ----- Per-line validation -----
OrderItemSchema.pre("validate", function (next) {
  const line = this as any;

  if (!Number.isFinite(line.quantityKg)) line.quantityKg = 0;
  if (!Number.isFinite(line.units)) line.units = 0;

  if (line.unitMode === "kg") {
    if (!(line.quantityKg > 0)) {
      return next(new Error("For unitMode='kg', quantityKg must be > 0."));
    }
  } else if (line.unitMode === "unit") {
    if (!(line.units > 0)) {
      return next(new Error("For unitMode='unit', units must be > 0."));
    }
    if (
      !Number.isFinite(line.estimatesSnapshot?.avgWeightPerUnitKg) ||
      !(line.estimatesSnapshot.avgWeightPerUnitKg > 0)
    ) {
      return next(
        new Error(
          "For unitMode='unit', estimatesSnapshot.avgWeightPerUnitKg must be > 0."
        )
      );
    }
  } else if (line.unitMode === "mixed") {
    if (!((line.quantityKg > 0) || (line.units > 0))) {
      return next(
        new Error(
          "For unitMode='mixed', at least one of quantityKg or units must be > 0."
        )
      );
    }
    if (
      line.units > 0 &&
      (!Number.isFinite(line.estimatesSnapshot?.avgWeightPerUnitKg) ||
        !(line.estimatesSnapshot.avgWeightPerUnitKg > 0))
    ) {
      return next(
        new Error(
          "For unitMode='mixed' with units > 0, estimatesSnapshot.avgWeightPerUnitKg must be > 0."
        )
      );
    }
  }

  // tolerance enforcement vs estimated
  if (Number.isFinite(line.finalWeightKg) && line.finalWeightKg != null) {
    const estimated = (line as any).estimatedEffectiveKg();
    const tolerance = Number.isFinite(line._parentTolerancePct)
      ? line._parentTolerancePct
      : DEFAULT_TOLERANCE;
    const maxAllowed = estimated * (1 + tolerance);
    if (line.finalWeightKg > maxAllowed) {
      return next(
        new Error(
          `Final weight exceeds tolerance: ${line.finalWeightKg}kg > ${maxAllowed.toFixed(
            3
          )}kg`
        )
      );
    }
  }

  next();
});

// ---------- Main Order schema ----------
const OrderSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    deliveryAddress: { type: AddressSchema, required: true },

    deliveryDate: { type: Date, required: true },
    shiftName: { type: String, required: true },

    LogisticsCenterId: {
      type: Schema.Types.ObjectId,
      ref: "LogisticsCenter",
      required: true,
      index: true,
    },

    // AMS snapshot (source stock for this order)
    amsId: {
      type: Schema.Types.ObjectId,
      ref: "AvailableMarketStock",
      required: true,
      index: true,
    },

    items: {
      type: [OrderItemSchema],
      default: [],
      validate: {
        validator: (val: unknown[]) => Array.isArray(val) && val.length > 0,
        message: "Order must contain at least one item.",
      },
    },

    // ---- running stage for the order ----
    // this used to be called 'status' in your code
    stageKey: {
      type: String,
      enum: ORDER_STAGE_KEYS,        // e.g. "packing", "out_for_delivery"
      default: "pending",
      index: true,
    },

    // full stage timeline, same shape you use for farmer orders
    stages: {
      type: [StageSchema],
      default: [],
    },

    // ---- Estimated totals (pre-packing) ----
    itemsSubtotal: { type: Number, required: true, min: 0, default: 0 },
    deliveryFee: {
      type: Number,
      required: true,
      default: DELIVERY_FEE_USD,
    },
    totalPrice: { type: Number, required: true, min: 0, default: 0 },
    totalOrderWeightKg: { type: Number, required: true, min: 0, default: 0 },

    // ---- Final totals (after packing); optional ----
    finalItemsSubtotal: { type: Number, min: 0 },
    finalTotalPrice: { type: Number, min: 0 },
    finalOrderWeightKg: { type: Number, min: 0 },

    // tolerance override
    tolerancePct: {
      type: Number,
      default: DEFAULT_TOLERANCE,
      min: 0,
      max: 0.5,
    },

    assignedDelivererId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    customerDeliveryId: {
      type: Schema.Types.ObjectId,
      ref: "CustomerDelivery",
      index: true,
    },

    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// ---------- Plugins & indexes ----------
OrderSchema.plugin(toJSON as any);

OrderSchema.index({ stageKey: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ "items.farmerOrderId": 1 });
OrderSchema.index({ amsId: 1, createdAt: -1 });

OrderSchema.index({
  LogisticsCenterId: 1,
  shiftName: 1,
  deliveryDate: 1,
  stageKey: 1,
});

// ---------- Types ----------
export type Order = InferSchemaType<typeof OrderSchema>;
export type OrderDoc = HydratedDocument<Order>;

export interface OrderMethods {
  addAudit(
    userId: Types.ObjectId,
    action: string,
    note?: string,
    meta?: any
  ): void;
  recalcEstimatedTotals(): void;
  recalcFinalTotals(): void;
  applyPackingWeights(
    weightsByFarmerOrderId: Record<string, number>,
    finalizedBy: Types.ObjectId | string,
    opts?: { capToTolerance?: boolean }
  ): void;
}

export type OrderModel = Model<Order, {}, OrderMethods>;

// ---------- Methods ----------
OrderSchema.methods.addAudit = function (
  this: HydratedDocument<Order> & OrderMethods,
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

OrderSchema.methods.recalcEstimatedTotals = function (
  this: HydratedDocument<Order> & OrderMethods
) {
  let subtotal = 0;
  let totalKg = 0;

  for (const line of this.items || []) {
    const kg =
      typeof (line as any).estimatedEffectiveKg === "function"
        ? (line as any).estimatedEffectiveKg()
        : (line.quantityKg || 0) +
          (line.units || 0) *
            (line.estimatesSnapshot?.avgWeightPerUnitKg || 0);

    subtotal += (line.pricePerUnit || 0) * kg;
    totalKg += kg;
  }

  this.itemsSubtotal = Math.round(subtotal * 100) / 100;
  this.deliveryFee = this.deliveryFee ?? DELIVERY_FEE_USD;
  this.totalPrice = Math.round(
    (this.itemsSubtotal + this.deliveryFee) * 100
  ) / 100;
  this.totalOrderWeightKg = Math.round(totalKg * 100) / 100;
};

OrderSchema.methods.recalcFinalTotals = function (
  this: HydratedDocument<Order> & OrderMethods
) {
  let subtotal = 0;
  let totalKg = 0;
  let hasAnyFinal = false;

  const tol = Number.isFinite(this.tolerancePct)
    ? this.tolerancePct
    : DEFAULT_TOLERANCE;

  for (const line of this.items || []) {
    (line as any)._parentTolerancePct = tol;

    if (
      Number.isFinite(line.finalWeightKg) &&
      line.finalWeightKg != null
    ) {
      hasAnyFinal = true;
      subtotal +=
        (line.pricePerUnit || 0) * (line.finalWeightKg || 0);
      totalKg += line.finalWeightKg || 0;
    }
  }

  if (!hasAnyFinal) {
    this.finalItemsSubtotal = undefined as any;
    this.finalTotalPrice = undefined as any;
    this.finalOrderWeightKg = undefined as any;
  } else {
    this.finalItemsSubtotal = Math.round(subtotal * 100) / 100;
    const fee = this.deliveryFee ?? DELIVERY_FEE_USD;
    this.finalTotalPrice = Math.round(
      ((this.finalItemsSubtotal || 0) + fee) * 100
    ) / 100;
    this.finalOrderWeightKg = Math.round(totalKg * 100) / 100;
  }
};

// helper so we can pass string or ObjectId for finalizedBy
const toObjectId = (
  v: Types.ObjectId | string
): Types.ObjectId =>
  v instanceof Types.ObjectId
    ? v
    : new Types.ObjectId(String(v));

OrderSchema.methods.applyPackingWeights = function (
  this: HydratedDocument<Order> & OrderMethods,
  weightsByFarmerOrderId: Record<string, number>,
  finalizedBy: Types.ObjectId | string,
  opts?: { capToTolerance?: boolean }
) {
  const capToTolerance = !!opts?.capToTolerance;
  const tol = Number.isFinite(this.tolerancePct)
    ? this.tolerancePct
    : DEFAULT_TOLERANCE;
  const finalizedById = toObjectId(finalizedBy);

  for (const line of this.items || []) {
    const key = String(line.farmerOrderId);
    if (!(key in weightsByFarmerOrderId)) continue;

    const estimatedKg =
      typeof (line as any).estimatedEffectiveKg === "function"
        ? (line as any).estimatedEffectiveKg()
        : (line.quantityKg || 0) +
          (line.units || 0) *
            (line.estimatesSnapshot?.avgWeightPerUnitKg || 0);

    const maxAllowed = estimatedKg * (1 + tol);
    let proposed = Number(weightsByFarmerOrderId[key]);

    if (!Number.isFinite(proposed) || proposed < 0) {
      throw new Error(
        `Invalid weight for line (farmerOrderId=${key}).`
      );
    }

    if (proposed > maxAllowed) {
      if (capToTolerance) {
        const capped = Math.round(maxAllowed * 1000) / 1000;
        this.addAudit(
          finalizedById,
          "PACKING_WEIGHT_CAPPED",
          "Capped to tolerance",
          {
            farmerOrderId: key,
            proposed,
            cappedTo: capped,
            tolerancePct: tol,
          }
        );
        proposed = capped;
      } else {
        throw new Error(
          `Final weight exceeds tolerance for line (farmerOrderId=${key}): ${proposed}kg > ${maxAllowed.toFixed(
            3
          )}kg`
        );
      }
    }

    line.finalWeightKg = Math.round(proposed * 1000) / 1000;
    line.finalizedBy = finalizedById;
    line.finalizedAt = new Date();
  }

  this.recalcFinalTotals();
};

// ---------- Pre-validate ----------
OrderSchema.pre("validate", function (next) {
  const doc = this as HydratedDocument<Order> & OrderMethods;
  doc.recalcEstimatedTotals();
  doc.recalcFinalTotals();
  next();
});

export const Order =
  (models.Order as OrderModel) || model<Order, OrderModel>("Order", OrderSchema);

export default Order;
