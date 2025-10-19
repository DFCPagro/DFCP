// ----------------------
// Shift-level order types for CS Manager
// ----------------------

export type CSOrderStatus =
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

export type CSOrderLine = {
  id: string;
  itemId: string;
  itemName: string;
  mode: "kg" | "unit" | "mixed";
  quantityKg?: number;
  units?: number;
  pricePerUnit?: number;
};

export type CSOrder = {
  id: string;
  orderId: string;
  customerId?: string;
  customerName?: string;
  createdAt: string;
  status: CSOrderStatus;
  deliveryAddress?: {
    label?: string;
    city?: string;
    street?: string;
  };
  totalPrice?: number;
  shiftName: string;
  deliveryDate: string; // ISO string
  lines?: CSOrderLine[];
};

// ----------------------
// Shift-level query response
// ----------------------

export type CSOrdersMeta = {
  lc: string;
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
