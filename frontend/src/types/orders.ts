// src/types/order.ts
// Frontend types aligned to backend src/models/order.model.ts

import type { Address } from "@/types/address";

/* ---------------------------------- Enums --------------------------------- */

export type OrderStatus =
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
 * Names/casing mirror the backend schema exactly.
 */
export type EstimatesSnapshot = {
  avgWeightPerUnitKg?: number | null;
  stdDevKg?: number | null;
};



export type CreateOrderItemInput = {
  /** Item reference (required) */
  itemId: string;

  /**
   * Price per KG (USD) snapshot at time of ordering.
   * The backend schema requires pricePerUnit and treats it as per-KG.
   */
  pricePerUnit: number;

  /** "kg" | "unit" | "mixed" (backend validates combinations below) */
  unitMode: UnitMode;

  /** For kg or mixed modes */
  quantityKg?: number;

  /** For unit or mixed modes */
  units?: number;

  /**
   * Required by backend validation when unitMode is "unit" or when "mixed" with units > 0.
   * When present, must be > 0.
   */
  estimatesSnapshot?: {
    avgWeightPerUnitKg?: number | null;
    stdDevKg?: number | null;
  };

  /** Optional UI hints (backend schema has these fields on lines, but backend can also derive them) */
  name?: string;
  imageUrl?: string;
  category?: string;

  /** Provenance fields (the backend populates these from AMS/farmer orders; allow optional here) */
  sourceFarmerName?: string;
  sourceFarmName?: string;
  farmerOrderId?: string;
};

export type CreateOrderBody = {
  /** Full address object as per AddressSchema (backend requires deliveryAddress) */
  deliveryAddress: Address;

  /** ISO date (YYYY-MM-DD or full ISO). Backend stores as Date. */
  deliveryDate: string;

  /** e.g., "morning" (backend requires string) */
  shiftName: string;

  /**
   * IMPORTANT: Casing matches schema (`LogisticsCenterId` with capital L).
   * Mongoose expects ObjectId; send string id.
   */
  LogisticsCenterId: string;

  /**
   * One AMS per order; same amsId for all lines. Mongoose expects ObjectId; send string id.
   */
  amsId: string;

  /** At least one item (backend enforces non-empty array) */
  items: CreateOrderItemInput[];

  /**
   * Optional override for per-order tolerance (default 0.10 on backend, 0–0.5).
   * If not set, backend uses default.
   */
  tolerancePct?: number;
};

/* ------------------------------- Read/Return ------------------------------- */

export type OrderItem = {
  itemId: string;
  name: string;
  imageUrl?: string;
  category?: string;

  pricePerUnit: number; // per KG
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
  deliveryDate: string;    // ISO string
  shiftName: string;

  /** Note: casing kept exactly as in schema */
  LogisticsCenterId: string;
  amsId: string;

  items: OrderItem[];

  // Estimated totals (pre-packing)
  itemsSubtotal: number;
  deliveryFee: number;     // backend default: 15 (USD)
  totalPrice: number;
  totalOrderWeightKg: number;

  // Final totals (post-packing) – optional until finalized
  finalItemsSubtotal?: number;
  finalTotalPrice?: number;
  finalOrderWeightKg?: number;

  // Per-order tolerance
  tolerancePct: number;    // default 0.10

  status: OrderStatus;

  assignedDelivererId?: string;
  customerDeliveryId?: string;

  // Audit
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
