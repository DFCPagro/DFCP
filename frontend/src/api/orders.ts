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
import type { CreateOrderBody, Order } from "@/types/orders";

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

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
      err?.response?.data?.error ??
      err?.message ??
      "Order creation failed";
    const details = err?.response?.data?.details ?? err?.response?.data;

    const apiErr: ApiError = { status, message, details };
    throw apiErr;
  }
}

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
