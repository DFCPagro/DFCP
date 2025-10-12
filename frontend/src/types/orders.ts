// src/types/order.ts
// Frontend types aligned 1:1 with backend src/models/order.model.ts

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

/* --------------------------------- Create --------------------------------- */
/** Snapshot used when ordering in unit/mixed modes. */
export type EstimatesSnapshot = {
  avgWeightPerUnitKg?: number | null;
  stdDevKg?: number | null;
};

export type CreateOrderItemInput = {
  /** Item reference (ObjectId as string). */
  itemId: string;

  /** Price per KG at order time. */
  pricePerUnit: number;

  /** "kg" | "unit" | "mixed". */
  unitMode: UnitMode;

  /** For kg or mixed modes. */
  quantityKg?: number;

  /** For unit or mixed modes. */
  units?: number;

  /**
   * Required by backend validation when:
   *  - unitMode="unit", or
   *  - unitMode="mixed" and units > 0.
   */
  estimatesSnapshot?: EstimatesSnapshot;

  /** Optional hints; backend usually derives these. */
  name?: string;
  imageUrl?: string;
  category?: string;

  /** Optional; backend usually derives these provenance fields. */
  sourceFarmerName?: string;
  sourceFarmName?: string;
  farmerOrderId?: string;
};

export type CreateOrderBody = {
  deliveryAddress: Address;      // required
  deliveryDate: string;          // ISO date/time
  shiftName: string;             // required

  /** Note casing: capital L matches backend. */
  LogisticsCenterId: string;
  amsId: string;                 // one AMS per order

  items: CreateOrderItemInput[]; // non-empty

  /** Optional override; backend default 0.10, range [0, 0.5]. */
  tolerancePct?: number;
};

/* ------------------------------- Read/Return ------------------------------- */

export type OrderItem = {
  itemId: string;

  // Display
  name: string;
  imageUrl?: string;
  category?: string;

  // Pricing & requested amounts
  pricePerUnit: number;   // per KG
  unitMode: UnitMode;
  quantityKg?: number;
  units?: number;

  // Snapshot for unit conversions
  estimatesSnapshot?: EstimatesSnapshot;

  // Packing / final
  finalWeightKg?: number;
  finalizedAt?: string;   // ISO
  finalizedBy?: string;   // user id

  // Provenance
  sourceFarmerName: string;
  sourceFarmName: string;
  farmerOrderId: string;
};

export type AuditEntry = {
  userId?: string;
  action: string;
  note?: string;
  meta?: Record<string, any>;
  timestamp?: string; // backend pushes { timestamp: Date }
};

export type Order = {
  _id: string;
  customerId: string;

  deliveryAddress: Address;
  deliveryDate: string; // ISO
  shiftName: string;

  /** Casing kept exactly as in schema. */
  LogisticsCenterId: string;
  amsId: string;

  items: OrderItem[];

  // Estimated totals (pre-packing)
  itemsSubtotal: number;
  deliveryFee: number;        // backend default: 15
  totalPrice: number;
  totalOrderWeightKg: number;

  // Final totals (post-packing)
  finalItemsSubtotal?: number;
  finalTotalPrice?: number;
  finalOrderWeightKg?: number;

  // Per-order tolerance
  tolerancePct: number;       // default 0.10

  status: OrderStatus;

  assignedDelivererId?: string;
  customerDeliveryId?: string;

  // Audit trail
  historyAuditTrail: AuditEntry[];

  createdAt: string;
  updatedAt: string;
};

/** Typical API envelope from create endpoint. */
export type CreateOrderResponse = { data: Order };

/* ------------------------------- UI helpers --------------------------------
 * Front-only light row used by lists/cards. Not a backend contract.
 * Keep optional extras here to avoid polluting server-aligned types.
 */
export type OrderRowAPI = {
  id: string;               // local/ui id or order _id
  orderId: string;          // human-readable number if present
  status: OrderStatus;

  createdAt: string;
  deliveryDate?: string | null;
  shiftName?: string | null;     // e.g., "morning"
  deliverySlot?: string | null;  // legacy alias for shift

  deliveryAddress?: Address | null;

  items: OrderItem[];

  // UI-only hints
  currencySymbol?: string;
  acceptedAt?: string | null;
};
export * from "./orders";
