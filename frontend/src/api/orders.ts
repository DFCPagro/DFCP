// src/api/orders.ts
// Basic Orders API used by the Checkout flow.
// - POST /orders (create)
// - GET  /orders/:id (fetch)

import { api } from "./config";
import type {
  CreateOrderBody,
  Order,
  OrderRowAPI,
  StageKey,
} from "@/types/orders";
import type { CSOrdersResponse, OrderStatus } from "@/types/cs.orders";

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

/* ---------------------------- Helpers ---------------------------- */

function toApiError(err: any): ApiError {
  const status = err?.response?.status ?? err?.status ?? 0;

  const message =
    err?.response?.data?.error ??
    err?.response?.data?.message ??
    err?.message ??
    "API error";

  const details = err?.response?.data ?? err;
  return { status, message, details };
}

// Internal: Normalize field casing for API POST body
function normalizeCreateBody(body: CreateOrderBody): Record<string, any> {
  const logisticsCenterId =
    (body as any).logisticsCenterId ??
    (body as any).LogisticsCenterId ??
    undefined;

  const payload: Record<string, any> = {
    amsId: body.amsId,
    logisticsCenterId,
    deliveryDate: body.deliveryDate,
    deliveryAddress: body.deliveryAddress,
    shiftName: body.shiftName,
    items: body.items,
  };

  if (typeof (body as any).tolerancePct === "number") {
    payload.tolerancePct = (body as any).tolerancePct;
  }

  return payload;
}

/* --------------------------- Customers --------------------------- */

/** Create an order for the authenticated customer. */
export async function createOrder(body: CreateOrderBody): Promise<Order> {
  try {
    const payload = normalizeCreateBody(body);
    const res = await api.post("/orders", payload);
    const out = res?.data?.data ?? res?.data;
    return out as Order;
  } catch (err: any) {
    throw toApiError(err);
  }
}

export async function fetchOrders(limit = 15): Promise<OrderRowAPI[]> {
  const { data } = await api.get<{ data: any[] }>("/orders/my", {
    params: { limit },
  });

  const items = (data?.data ?? []).map((o: any) => {
    const id = o._id ?? o.id ?? String(Math.random());
    const orderId = o.orderId ?? o.orderNumber ?? id;

    return {
      id,
      orderId,
      stageKey: (o.stageKey as StageKey) ?? "pending",
      createdAt: o.createdAt ?? new Date().toISOString(),
      acceptedAt: o.acceptedAt,
      deliveryDate: o.deliveryDate,
      deliverySlot: o.deliverySlot ?? o.slot ?? undefined,
      items: o.items ?? [],
      deliveryAddress: o.deliveryAddress,
      shippingAddress: o.shippingAddress,
      ...o,
    } as OrderRowAPI;
  });

  return items as OrderRowAPI[];
}

/* ------------------- Logistics staff / managers ------------------ */

/** Fetch an order by id. */
export async function getOrderById(orderId: string): Promise<Order> {
  try {
    const res = await api.get(`/orders/${encodeURIComponent(orderId)}`);
    const out = res?.data?.data ?? res?.data;
    return out as Order;
  } catch (err: any) {
    throw toApiError(err);
  }
}

/** Patch stage: PATCH /orders/:orderId/stage { stageKey } */
// src/api/orders.ts
export async function updateOrderStage(
  orderId: string,
  stageKey: StageKey,
  action: "setCurrent" | "ok" | "done" | "problem" | "cancel" = "ok"
) {
  try {
    const { data } = await api.patch(
      `/orders/${encodeURIComponent(orderId)}/stage`,
      { stageKey, action }
    );
    return data?.data ?? data;
  } catch (err: any) {
    throw toApiError(err);
  }
}

/** Pack order: POST /orders/:id/pack */
export async function packOrder(orderId: string, body?: Record<string, any>) {
  try {
    const { data } = await api.post(
      `/orders/${encodeURIComponent(orderId)}/pack`,
      body ?? {}
    );
    return data?.data ?? data;
  } catch (err: any) {
    throw toApiError(err);
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

export async function getOrdersSummaryFromLC(lcId: string, count = 6) {
  const { data } = await api.get<{ data: LCSummaryResponse }>(
    "/orders/summary",
    {
      params: { lc: lcId, count },
    }
  );

  const payload = data?.data;
  const windows = [payload.current, ...(payload.next ?? [])].filter(
    Boolean
  ) as LCWindow[];

  return windows.map((w) => ({
    dateISO: w.date,
    shift: w.shiftName as any,
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

type GetOrdersForShiftParams = {
  logisticCenterId: string;
  date: string; // yyyy-mm-dd
  shiftName: string;
  stageKey?: OrderStatus;
  page?: number;
  limit?: number;
  fields?: string[];
};

export async function getOrderByOpsToken(token: string) {
  const { data } = await api.get(`/orders/by-ops-token/${token}`);
  return data;
}

export async function getOrdersForShift(
  params: GetOrdersForShiftParams
): Promise<CSOrdersResponse> {
  const { date, shiftName, stageKey, page, limit, fields } = params;

  // Only send defined params
  const query: Record<string, any> = {
    date,
    shiftName,
  };
  if (stageKey) query.stageKey = stageKey;
  if (page) query.page = page;
  if (limit) query.limit = limit;
  if (fields?.length) query.fields = fields.join(",");

  const { data } = await api.get("/orders/by-shift", { params: query });
  return (data?.data ?? data) as CSOrdersResponse;
}
