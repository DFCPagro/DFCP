// src/types/cs.orders.ts
// ----------------------
// Shift-level order types for CS Manager
// ----------------------
import type { Address } from "./address";

/** Keep in sync with backend ORDER_STATUSES */
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

/** UI expects this alias in some places */
export type CSOrderStatus = OrderStatus;

/** One line as shown in CS detail panel
 *  NOTE: `mode` corresponds to backend `unitMode`
 */
export type CSOrderLine = {
  id: string;               // prefer farmerOrderId if exists, else itemId
  itemId: string;
  itemName: string;
  mode: "kg" | "unit" | "mixed";
  quantityKg?: number;
  units?: number;
  pricePerUnit?: number;    // per KG (snapshot)
  farmerOrderId?: string;
};

/** Row used in CS shift table */
export type CSOrder = {
  id: string;
  orderId: string;          // human-friendly short id/seq if you have it
  customerId?: string;      // table shows short suffix
  createdAt?: string;       // ISO; optional to be safe
  stageKey: OrderStatus;
  deliveryAddress?: Address;
  totalPrice?: number;
  shiftName: string;
  deliveryDate: string;     // ISO (yyyy-mm-dd or full ISO)
  lines?: CSOrderLine[];    // only present in detail
};

// ----------------------
// Shift-level query response
// ----------------------
export type CSOrdersMeta = {
  date: string;
  shiftName: string;
  tz: string;
  page: number;
  limit: number;
  total: number;
  problemCount: number;
  pages: number;
};

export type CSOrdersResponse = {
  meta: CSOrdersMeta;
  items: CSOrder[];
};

// ----------------------
// Helpful DTOs for client <-> API
// ----------------------
export type GetCSOrdersForShiftParams = {
  date: string;           // yyyy-mm-dd
  shiftName: string;      // "morning" | "afternoon" | ...
  stageKey?: OrderStatus;   // optional filter; UI sends "problem" if toggle on
  page?: number;
  limit?: number;
  fields?: string[];      // optional projection hint
};

export type GetCSOrderDetailResponse = {
  id: string;
  orderId: string;
  stageKey: OrderStatus;
  lines: CSOrderLine[];
};

export type PatchOrderStatusBody = {
  stageKey: OrderStatus;
};
export type PatchOrderStatusResponse = {
  ok: true;
  stageKey: OrderStatus;
};

// ----------------------
// Barrel helpers (optional, but convenient)
// ----------------------
// Re-export common names so imports can be concise:
// import type { CSOrder, CSOrdersResponse, CSOrderStatus } from "@/types/cs.orders";
export type {
  Address as CSAddress
} from "./address";
