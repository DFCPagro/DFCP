// src/api/orders.ts
// Basic Orders API used by the Checkout flow.
// - POST /orders (create)
// - GET  /orders/:id (fetch)
//
// Notes:
// • Swagger request example shows `logisticsCenterId` (lowercase 'l') in the *request body*,
//   while the backend model stores `LogisticsCenterId` (capital 'L').
//   This client will accept either in the input body and send `logisticsCenterId` to the API.
// • Response envelope is `{ data: Order }` — we unwrap and return `Order` directly.

import { api } from "./config";
import type { CreateOrderBody, Order, OrderRowAPI } from "@/types/orders";
import type { CSOrdersResponse } from "@/types/cs.orders";
export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};


/*  FOR CUSTOMERS */



// Internal: Normalize field casing for API POST body
function normalizeCreateBody(body: CreateOrderBody): Record<string, any> {
  // Prefer `logisticsCenterId` for the HTTP request body (as shown in Swagger).
  const logisticsCenterId =
    // already lower-cased?
    (body as any).logisticsCenterId ??
    // from capitalized form (types aligned to model)?
    (body as any).LogisticsCenterId ??
    undefined;

  // Build final payload for API
  const payload: Record<string, any> = {
    amsId: body.amsId,
    logisticsCenterId, // API expects this name in the request
    deliveryDate: body.deliveryDate,
    deliveryAddress: body.deliveryAddress,
    shiftName: body.shiftName,
    items: body.items,
  };

  // Only send if caller provided tolerancePct
  if (typeof (body as any).tolerancePct === "number") {
    payload.tolerancePct = (body as any).tolerancePct;
  }

  return payload;
}

/**
 * Create an order for the authenticated customer.
 * Returns the created Order object (envelope `data` unwrapped).
 */
export async function createOrder(body: CreateOrderBody): Promise<Order> {
  try {
    const payload = normalizeCreateBody(body);
    const res = await api.post("/orders", payload);
    // Swagger shows { data: { ...Order } }
    const out = res?.data?.data ?? res?.data;
    return out as Order;
  } catch (err: any) {
    // Normalize error
    const status = err?.response?.status ?? 0;
    const message =
      err?.response?.data?.error ?? err?.message ?? "Order creation failed";
    const details = err?.response?.data?.details ?? err?.response?.data;

    const apiErr: ApiError = { status, message, details };
    throw apiErr;
  }
}


export async function fetchOrders(limit = 15): Promise<OrderRowAPI[]> {
  const { data } = await api.get<{ data: any[] }>("/orders/my", {
    params: { limit },
  });

  // Light normalization into our OrderRowAPI-ish shape (keep extra fields intact).
  const items = (data?.data ?? []).map((o: any) => {
    const id = o._id ?? o.id ?? String(Math.random());
    const orderId = o.orderId ?? o.orderNumber ?? id;

    return {
      id,
      orderId,
      status: o.status ?? "created",
      createdAt: o.createdAt ?? new Date().toISOString(),
      acceptedAt: o.acceptedAt,
      deliveryDate: o.deliveryDate,
      deliverySlot: o.deliverySlot ?? o.slot ?? undefined,
      // keep original items and address so our UI mappers can read different keys
      items: o.items ?? [],
      deliveryAddress: o.deliveryAddress, // our UI reads this in getDeliveryCoord
      shippingAddress: o.shippingAddress, // keep if backend ever sends it
      ...o,
    } as OrderRowAPI;
  });

  return items as OrderRowAPI[];
}




/*  FOR LOGISTICS STAFF /MANAGERS */

/**
 * Fetch an order by id.
 * If your backend returns { data: Order }, we unwrap; otherwise we return the raw object.
 */
export async function getOrderById(orderId: string): Promise<Order> {
  try {
    const res = await api.get(`/orders/${encodeURIComponent(orderId)}`);
    const out = res?.data?.data ?? res?.data;
    return out as Order;
  } catch (err: any) {
    const status = err?.response?.status ?? 0;
    const message =
      err?.response?.data?.error ?? err?.message ?? "Failed to fetch order";
    const details = err?.response?.data?.details ?? err?.response?.data;

    const apiErr: ApiError = { status, message, details };
    throw apiErr;
  }
}


type LCWindow = {
  date: string;
  shiftName: "morning" | "afternoon" | "evening" | "night";
  count: number;
  problemCount: number;
};
type LCSummaryResponse = {
  current: LCWindow | null;
  next: LCWindow[];
  tz: string;
  lc: string;
};

// maps server shape -> UI rows for your dashboard
export async function getOrdersSummaryFromLC(lcId: string, count = 6) {
  // your controller accepts ?lc=... OR ?logisticCenterId=...
  const { data } = await api.get<{ data: LCSummaryResponse }>(
    "/orders/summary",
    {
      params: { lc: lcId, count },
    }
  );

  const payload = data?.data; // unwrap envelope
  const windows = [payload.current, ...(payload.next ?? [])].filter(
    Boolean
  ) as LCWindow[];

  return windows.map((w) => ({
    dateISO: w.date, // "yyyy-LL-dd"
    shift: w.shiftName as any, // cast to your ShiftName union if needed
    total: w.count,
    problem: w.problemCount,
  }));
}

export async function confirmOrderByCustomerToken(
  token: string,
  body: { rating?: number; comment?: string }
) {
  const { data } = await api.post(`/orders/confirm/${token}`, body);
  return data;
}

/** Fetch order details via an ops token (for logistics staff). */
export async function getOrderByOpsToken(token: string) {
  const { data } = await api.get(`/orders/by-ops-token/${token}`);
  return data;
}



export async function getOrdersForShift(params: {
  logisticCenterId: string;
  date: string;
  shiftName: string;
}): Promise<CSOrdersResponse> {
  const { data } = await api.get("/orders/by-shift", { params });
  return (data?.data ?? data) as CSOrdersResponse; // unwrap if enveloped
}
