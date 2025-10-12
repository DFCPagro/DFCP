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

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "farmer",
  "in-transit",
  "packing",
  "ready_for_pickUp",
  "out_for_delivery",
  "delivered",
  "received",
  "canceled",
  "problem",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const UNIT_MODES = ["kg", "unit", "mixed"] as const;
export type UnitMode = (typeof UNIT_MODES)[number];

const DELIVERY_FEE_USD = 5;
const DEFAULT_TOLERANCE = 0.10; // 10%

/**
 * Order line:
 * - pricePerUnit is price per KG (aligned with AMS; kept for backward compatibility)
 * - pricePerKg is an explicit snapshot of Item.price.a (same value as pricePerUnit)
 * - derivedUnitPrice is optional (UI-only helper) when unit/mixed — derived or overridden per-unit price
 * - Estimated effective kg = quantityKg + units * estimatesSnapshot.avgWeightPerUnitKg
 * - Final pricing/weights use finalWeightKg when present (after packing)
 */
const OrderItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },

    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "" },
    category: { type: String, default: "" },

    // Legacy field name used throughout billing math (per KG):
    pricePerUnit: { type: Number, required: true, min: 0 }, // per KG

    // NEW: explicit snapshot of price per KG (same as pricePerUnit) for clarity/analytics
    pricePerKg: { type: Number, required: true, min: 0 }, // mirrors price.a

    // NEW: optional UI helper — per-unit price shown when unit/mixed (can be derived or overridden)
    derivedUnitPrice: { type: Number, default: null, min: 0 },

    unitMode: { type: String, enum: UNIT_MODES, required: true, default: "kg" },

    // Requested / estimated amounts:
    quantityKg: { type: Number, default: 0, min: 0 },
    units: { type: Number, default: 0, min: 0 },

    // Snapshot from AMS for unit conversion:
    estimatesSnapshot: {
      avgWeightPerUnitKg: { type: Number, default: null, min: 0 },
      stdDevKg: { type: Number, default: null, min: 0 }, // keep name to avoid breaking other code
    },

    // PACKING / FINAL (actual net packed kg):
    finalWeightKg: { type: Number, min: 0 }, // optional (undefined until packed)
    finalizedAt: { type: Date },
    finalizedBy: { type: Schema.Types.ObjectId, ref: "User", index: true },

    // Provenance:
    sourceFarmerName: { type: String, required: true, trim: true },
    sourceFarmName: { type: String, required: true, trim: true },
    farmerOrderId: { type: Schema.Types.ObjectId, ref: "FarmerOrder", required: true, index: true },
  },
  { _id: false, timestamps: false }
);

// ---------- Line helpers (methods; not persisted) ----------
(OrderItemSchema as any).methods.estimatedEffectiveKg = function (): number {
  const avg = this.estimatesSnapshot?.avgWeightPerUnitKg || 0;
  const fromUnits = (this.units || 0) * avg;
  const fromKg = this.quantityKg || 0;
  return Math.round((fromKg + fromUnits) * 1000) / 1000; // 3dp internal
};

(OrderItemSchema as any).methods.estimatedLineSubtotal = function (): number {
  const kg = (this as any).estimatedEffectiveKg();
  return Math.round(((this.pricePerUnit || 0) * kg) * 100) / 100;
};

(OrderItemSchema as any).methods.finalLineSubtotal = function (): number {
  if (!Number.isFinite(this.finalWeightKg)) return 0;
  return Math.round(((this.pricePerUnit || 0) * (this.finalWeightKg || 0)) * 100) / 100;
};

// ---------- Per-line validation ----------
OrderItemSchema.pre("validate", function (next) {
  const line = this as any;

  if (!Number.isFinite(line.quantityKg)) line.quantityKg = 0;
  if (!Number.isFinite(line.units)) line.units = 0;

  if (line.unitMode === "kg") {
    if (!(line.quantityKg > 0)) {
      return next(new Error("For unitMode='kg', quantityKg must be > 0."));
    }
  } else if (line.unitMode === "unit") {
    if (!(line.units > 0)) return next(new Error("For unitMode='unit', units must be > 0."));
    if (
      !Number.isFinite(line.estimatesSnapshot?.avgWeightPerUnitKg) ||
      !(line.estimatesSnapshot.avgWeightPerUnitKg > 0)
    ) {
      return next(new Error("For unitMode='unit', estimatesSnapshot.avgWeightPerUnitKg must be > 0."));
    }
  } else if (line.unitMode === "mixed") {
    if (!((line.quantityKg > 0) || (line.units > 0))) {
      return next(new Error("For unitMode='mixed', at least one of quantityKg or units must be > 0."));
    }
    if (
      (line.units > 0) &&
      (!Number.isFinite(line.estimatesSnapshot?.avgWeightPerUnitKg) ||
        !(line.estimatesSnapshot.avgWeightPerUnitKg > 0))
    ) {
      return next(new Error("For unitMode='mixed' with units > 0, estimatesSnapshot.avgWeightPerUnitKg must be > 0."));
    }
  }

  // If final weight provided, enforce tolerance vs estimated
  if (Number.isFinite(line.finalWeightKg) && line.finalWeightKg != null) {
    const estimated = (line as any).estimatedEffectiveKg();
    const tolerance = Number.isFinite(line._parentTolerancePct) ? line._parentTolerancePct : DEFAULT_TOLERANCE;
    const maxAllowed = estimated * (1 + tolerance);
    if (line.finalWeightKg > maxAllowed) {
      return next(new Error(`Final weight exceeds tolerance: ${line.finalWeightKg}kg > ${maxAllowed.toFixed(3)}kg`));
    }
  }

  next();
});

// ---------- Main Order schema ----------
const OrderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deliveryAddress: { type: AddressSchema, required: true },

    deliveryDate: { type: Date, required: true },
    shiftName: { type: String, required: true },

    LogisticsCenterId: { type: Schema.Types.ObjectId, ref: "LogisticsCenter", required: true, index: true },

    // One AMS per order (same amsId for all lines)
    amsId: { type: Schema.Types.ObjectId, ref: "AvailableMarketStock", required: true, index: true },

    items: {
      type: [OrderItemSchema],
      default: [],
      validate: {
        validator: (val: unknown[]) => Array.isArray(val) && val.length > 0,
        message: "Order must contain at least one item.",
      },
    },

    // ---- Estimated totals (pre-packing) ----
    itemsSubtotal: { type: Number, required: true, min: 0, default: 0 },
    deliveryFee: { type: Number, required: true, default: DELIVERY_FEE_USD },
    totalPrice: { type: Number, required: true, min: 0, default: 0 },
    totalOrderWeightKg: { type: Number, required: true, min: 0, default: 0 },

    // ---- Final totals (after packing); optional numbers (no nulls) ----
    finalItemsSubtotal: { type: Number, min: 0 },
    finalTotalPrice: { type: Number, min: 0 },
    finalOrderWeightKg: { type: Number, min: 0 },

    // Per-order tolerance (override if needed)
    tolerancePct: { type: Number, default: DEFAULT_TOLERANCE, min: 0, max: 0.5 },

    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },

    assignedDelivererId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    customerDeliveryId: { type: Schema.Types.ObjectId, ref: "CustomerDelivery", index: true },

    historyAuditTrail: { type: [AuditEntrySchema], default: [] },
  },
  { timestamps: true }
);

// ---------- Plugins & indexes ----------
OrderSchema.plugin(toJSON as any);
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ "items.farmerOrderId": 1 });
OrderSchema.index({ amsId: 1, createdAt: -1 });

// ---------- Types ----------
export type Order = InferSchemaType<typeof OrderSchema>;
export type OrderDoc = HydratedDocument<Order>;

export interface OrderMethods {
  addAudit(userId: Types.ObjectId, action: string, note?: string, meta?: any): void;
  recalcEstimatedTotals(): void;
  recalcFinalTotals(): void;
  /**
   * Apply packing weights by farmerOrderId.
   * If capToTolerance=true, weights above tolerance are auto-capped and audited.
   * Otherwise, method throws on first violation.
   */
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
  this.historyAuditTrail.push({ userId, action, note, meta, timestamp: new Date() });
};

OrderSchema.methods.recalcEstimatedTotals = function (this: HydratedDocument<Order> & OrderMethods) {
  let subtotal = 0;
  let totalKg = 0;

  for (const line of this.items || []) {
    const kg =
      typeof (line as any).estimatedEffectiveKg === "function"
        ? (line as any).estimatedEffectiveKg()
        : ((line.quantityKg || 0) + (line.units || 0) * (line.estimatesSnapshot?.avgWeightPerUnitKg || 0));

    subtotal += (line.pricePerUnit || 0) * kg;
    totalKg += kg;
  }

  this.itemsSubtotal = Math.round(subtotal * 100) / 100;
  this.deliveryFee = this.deliveryFee ?? DELIVERY_FEE_USD;
  this.totalPrice = Math.round((this.itemsSubtotal + this.deliveryFee) * 100) / 100;
  this.totalOrderWeightKg = Math.round(totalKg * 100) / 100;
};

OrderSchema.methods.recalcFinalTotals = function (this: HydratedDocument<Order> & OrderMethods) {
  let subtotal = 0;
  let totalKg = 0;
  let hasAnyFinal = false;

  const tol = Number.isFinite(this.tolerancePct) ? this.tolerancePct : DEFAULT_TOLERANCE;

  for (const line of this.items || []) {
    // inject parent tolerance for line validation
    (line as any)._parentTolerancePct = tol;

    if (Number.isFinite(line.finalWeightKg) && line.finalWeightKg != null) {
      hasAnyFinal = true;
      subtotal += (line.pricePerUnit || 0) * (line.finalWeightKg || 0);
      totalKg += (line.finalWeightKg || 0);
    }
  }

  if (!hasAnyFinal) {
    // Ensure these are truly undefined (play nice with TS `number | undefined`)
    this.finalItemsSubtotal = undefined as any;
    this.finalTotalPrice = undefined as any;
    this.finalOrderWeightKg = undefined as any;
  } else {
    this.finalItemsSubtotal = Math.round(subtotal * 100) / 100;
    const fee = this.deliveryFee ?? DELIVERY_FEE_USD;
    this.finalTotalPrice = Math.round(((this.finalItemsSubtotal || 0) + fee) * 100) / 100;
    this.finalOrderWeightKg = Math.round(totalKg * 100) / 100;
  }
};

// Small helper so we can pass string or ObjectId for finalizedBy
const toObjectId = (v: Types.ObjectId | string): Types.ObjectId =>
  v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));

OrderSchema.methods.applyPackingWeights = function (
  this: HydratedDocument<Order> & OrderMethods,
  weightsByFarmerOrderId: Record<string, number>,
  finalizedBy: Types.ObjectId | string,
  opts?: { capToTolerance?: boolean }
) {
  const capToTolerance = !!opts?.capToTolerance;
  const tol = Number.isFinite(this.tolerancePct) ? this.tolerancePct : DEFAULT_TOLERANCE;
  const finalizedById = toObjectId(finalizedBy);

  for (const line of this.items || []) {
    const key = String(line.farmerOrderId);
    if (!(key in weightsByFarmerOrderId)) continue;

    const estimatedKg =
      typeof (line as any).estimatedEffectiveKg === "function"
        ? (line as any).estimatedEffectiveKg()
        : ((line.quantityKg || 0) + (line.units || 0) * (line.estimatesSnapshot?.avgWeightPerUnitKg || 0));

    const maxAllowed = estimatedKg * (1 + tol);
    let proposed = Number(weightsByFarmerOrderId[key]);

    if (!Number.isFinite(proposed) || proposed < 0) {
      throw new Error(`Invalid weight for line (farmerOrderId=${key}).`);
    }

    if (proposed > maxAllowed) {
      if (capToTolerance) {
        const capped = Math.round(maxAllowed * 1000) / 1000;
        this.addAudit(finalizedById, "PACKING_WEIGHT_CAPPED", `Capped to tolerance`, {
          farmerOrderId: key,
          proposed,
          cappedTo: capped,
          tolerancePct: tol,
        });
        proposed = capped;
      } else {
        throw new Error(
          `Final weight exceeds tolerance for line (farmerOrderId=${key}): ${proposed}kg > ${maxAllowed.toFixed(3)}kg`
        );
      }
    }

    line.finalWeightKg = Math.round(proposed * 1000) / 1000;
    line.finalizedBy = finalizedById;
    line.finalizedAt = new Date();
  }

  this.recalcFinalTotals();
};

// Keep both totals up to date on validate/save
OrderSchema.pre("validate", function (next) {
  const doc = this as HydratedDocument<Order> & OrderMethods;
  doc.recalcEstimatedTotals();
  doc.recalcFinalTotals();
  next();
});

export const Order =
  (models.Order as OrderModel) ||
  model<Order, OrderModel>("Order", OrderSchema);

export default Order;
