import { api } from "./config";
import type {
  PaginatedOrders,
  OrderRowAPI,
  MintResult,
} from "@/types/orders";

export async function fetchOrders(page = 1, pageSize = 20) {
  const { data } = await api.get<PaginatedOrders>("/orders", {
    params: { page, pageSize },
  });
  return data;
}

export async function updateOrderStatus(
  id: string,
  status: OrderRowAPI["status"]
) {
  const { data } = await api.patch<{ id: string; status: OrderRowAPI["status"] }>(
    `/orders/${id}/status`,
    { status }
  );
  return data;
}

export async function mintQrs(id: string, ttlDays = 30) {
  const { data } = await api.post<MintResult>(
    `/orders/${id}/qrs`,
    null,
    { params: { ttlDays } }
  );
  return data;
}


/** Fetch order details via an ops token (for logistics staff). */
export async function getOrderByOpsToken(token: string) {
  const { data } = await api.get(`/orders/by-ops-token/${token}`);
  return data;
}

/** Confirm an order via the customer token. Accepts an optional rating and comment. */
export async function confirmOrderByCustomerToken(
  token: string,
  body: { rating?: number; comment?: string },
) {
  const { data } = await api.post(`/orders/confirm/${token}`, body);
  return data;
}


// src/api/orders.ts
export async function createOrder(payload: any): Promise<{ orderId: string }> {
  // TODO: replace with your real backend call
  // return fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json());

  // mock success so you can wire UI first
  return Promise.resolve({ orderId: Math.random().toString(36).slice(2, 10) });
}
