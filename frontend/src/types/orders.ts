// src/types/order.ts
// Frontend types aligned to backend src/models/order.model.ts
import type { Address } from "./address";

/* ---------------------------------- Enums --------------------------------- */

export type OrderStages =
  | "pending"
  | "confirmed"
  | "farmer"
  | "in-transit"
  | "packing"
  | "ready_for_pickUp"
  | "out_for_delivery"
  | "delivered"
  | "received"
  | "canceled"
  | "problem";

export type UnitMode = "kg" | "unit" | "mixed";

export type PaymentMethod = "card" | "google_pay" | "paypal";

/* --------------------------------- Create --------------------------------- */
/**
 * What Checkout should POST to the backend create-order endpoint.
 * Names/casing MUST mirror backend validation (CreateOrderInputSchema).
 */
export type EstimatesSnapshot = {
  avgWeightPerUnitKg?: number | null;
};

export type CreateOrderItemInput = {
  /** Item reference (required) */
  itemId: string;

  farmerOrderId?: string;
  sourceFarmerName?: string;
  sourceFarmName?: string;

  name?: string;
  imageUrl?: string;
  category?: string;

  // price snapshot (if unitMode="unit", this is per unit; if "kg", per kg)
  pricePerUnit: number;

  /** "kg" | "unit" | "mixed" */
  unitMode: UnitMode;

  /** For kg or mixed modes */
  quantityKg?: number;

  /** For unit or mixed modes */
  units?: number;

  /**
   * Required by backend when unitMode is "unit", or "mixed" with units > 0.
   * Must be > 0 when present.
   */
  estimatesSnapshot?: EstimatesSnapshot;
};

export type CreateOrderBody = {
  /** Full address object as per DeliveryAddressSchema (backend requires deliveryAddress) */
  deliveryAddress: Address;

  /** ISO date (YYYY-MM-DD or full ISO). Backend stores as Date. */
  deliveryDate: string;

  /** We send shiftName for UI, but backend will override using AMS.availableShift */
  shiftName: string;

  /**
   * EXACT name expected by backend Zod:
   * logisticsCenterId (lowercase 'l').
   *
   * This should correspond to the LC that will fulfill this delivery.
   * In your flow this is known from the selected address.
   */
  logisticsCenterId: string;

  /**
   * One AMS per order; same amsId for all lines. Backend expects ObjectId string.
   */
  amsId: string;

  /** At least one item */
  items: CreateOrderItemInput[];

  /**
   * Optional override for per-order tolerance (0–0.5).
   * If not set, backend will use its default tolerancePct.
   */
  tolerancePct?: number;
};

/* ------------------------------- Read/Return ------------------------------- */

export type OrderItem = {
  itemId: string;
  name: string;
  imageUrl?: string;
  category?: string;

  // price snapshot for this line
  pricePerUnit: number;
  unitMode: UnitMode;

  quantityKg?: number;
  units?: number;

  estimatesSnapshot?: {
    avgWeightPerUnitKg?: number | null;
    stdDevKg?: number | null;
  };

  // Finalization (after packing)
  finalWeightKg?: number;
  finalizedAt?: string;
  finalizedBy?: string;

  // Provenance
  sourceFarmerName: string;
  sourceFarmName: string;
  farmerOrderId: string;
};

export type Order = {
  _id: string;
  customerId: string;

  deliveryAddress: Address;
  deliveryDate: string; // ISO string
  shiftName: string;

  /**
   * Note:
   * The stored model on the backend may still expose `LogisticsCenterId`
   * (capital L) in the returned Order. That's fine.
   * Input uses logisticsCenterId, output may use LogisticsCenterId.
   */
  LogisticsCenterId: string;
  amsId: string;

  items: OrderItem[];

  // Estimated totals (pre-packing)
  itemsSubtotal: number;
  deliveryFee: number;
  totalPrice: number;
  totalOrderWeightKg: number;

  // Final totals (post-packing)
  finalItemsSubtotal?: number;
  finalTotalPrice?: number;
  finalOrderWeightKg?: number;

  // Per-order tolerance
  tolerancePct: number;

  status: OrderStages;

  assignedDelivererId?: string;
  customerDeliveryId?: string;

  // Audit trail
  historyAuditTrail: Array<{
    userId?: string;
    action: string;
    note?: string;
    meta?: Record<string, any>;
    createdAt?: string;
  }>;

  createdAt: string;
  updatedAt: string;
};

/** Typical API envelope if your controllers wrap data */
export type CreateOrderResponse = {
  data: Order;
};

export type OrderRowAPI = {
  id: string;
  orderId: string;
  stages: OrderStages;
  deliverySlot?: string | null;
  createdAt: string;
  items: OrderItem[];
  // you can add consumerName etc.
};
