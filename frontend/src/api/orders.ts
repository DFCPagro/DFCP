// src/api/orders.ts
import { api } from "./config";
import type { PaginatedOrders, OrderRowAPI, OrderStatus, MintResult } from "@/types/orders";

// ---------- MOCK TOGGLE ----------
const USE_MOCK = true; // set to false when backend is ready

// ---------- MOCK DATA ----------
const STATUSES: OrderStatus[] = [
  "created",
  "packed",
  "out_for_delivery",
  "delivered",
  "confirmed",
];

const CATALOG = [
  { id: "apples", unit: "kg" },
  { id: "tomatoes", unit: "kg" },
  { id: "milk-1l", unit: "bottle" },
  { id: "eggs-12", unit: "box" },
  { id: "lettuce", unit: "pc" },
];

function genItems(seed: number) {
  const count = (seed % 3) + 1;
  const out = Array.from({ length: count }, (_, i) => {
    const p = CATALOG[(seed + i) % CATALOG.length];
    return {
      productId: p.id,
      quantity: ((seed + i) % 4) + 1,
      unit: p.unit,
    };
  });
  return out;
}

function genOrder(i: number): OrderRowAPI {
  const status = STATUSES[i % STATUSES.length];
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(i / 2));
  d.setHours(10 + (i % 8), 15, 0, 0);

  const slot =
    status === "out_for_delivery" || status === "delivered" || status === "confirmed"
      ? `${String(16 + (i % 4)).padStart(2, "0")}:00–${String(17 + (i % 4)).padStart(2, "0")}:00`
      : null;

  return {
    id: `ord_${i.toString().padStart(4, "0")}`,
    orderId: `#${1000 + i}`,
    status,
    deliverySlot: slot,
    createdAt: d.toISOString(),
    items: genItems(i),
  };
}

function getMockPage(page = 1, pageSize = 20): PaginatedOrders {
  const total = 60;
  const start = Math.max(0, (page - 1) * pageSize);
  const end = Math.min(total, start + pageSize);
  const items = Array.from({ length: total }, (_, i) => genOrder(i)).slice(start, end);
  return { page, pageSize, total, items };
}

// ---------- LIVE + MOCK API ----------
export async function fetchOrders(page = 1, pageSize = 20) {
  if (USE_MOCK) {
    return Promise.resolve(getMockPage(page, pageSize));
  }
  const { data } = await api.get<PaginatedOrders>("/orders", { params: { page, pageSize } });
  return data;
}

export async function updateOrderStatus(id: string, status: OrderRowAPI["status"]) {
  if (USE_MOCK) return Promise.resolve({ id, status });
  const { data } = await api.patch<{ id: string; status: OrderRowAPI["status"] }>(
    `/orders/${id}/status`,
    { status }
  );
  return data;
}

export async function mintQrs(id: string, ttlDays = 30) {
  if (USE_MOCK) {
    const base = `${location.origin}/mock`;
    return Promise.resolve({
      opsUrl: `${base}/ops/${id}`,
      customerUrl: `${base}/c/${id}`,
      opsToken: `ops_${id}`,
      customerToken: `cust_${id}`,
    } as MintResult);
  }
  const { data } = await api.post<MintResult>(`/orders/${id}/qrs`, null, { params: { ttlDays } });
  return data;
}

/** Optional keepers from your file */
export async function getOrderByOpsToken(token: string) {
  if (USE_MOCK) return Promise.resolve(genOrder(1));
  const { data } = await api.get(`/orders/by-ops-token/${token}`);
  return data;
}

export async function confirmOrderByCustomerToken(
  token: string,
  body: { rating?: number; comment?: string }
) {
  if (USE_MOCK) return Promise.resolve({ ok: true, token, ...body });
  const { data } = await api.post(`/orders/confirm/${token}`, body);
  return data;
}

export async function createOrder(payload: any): Promise<{ orderId: string }> {
  if (USE_MOCK) return Promise.resolve({ orderId: Math.random().toString(36).slice(2, 10) });
  // real call when ready
   const { data } = await api.post('/orders', payload);
  return data;
  return Promise.resolve({ orderId: Math.random().toString(36).slice(2, 10) });
}
