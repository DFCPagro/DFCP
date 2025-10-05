// src/api/orders.ts
import { api } from "./config";
import type {
  OrderRowAPI,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateOrderResponseData,
} from "@/types/orders";

/**
 * Fetch the authenticated user's recent orders.
 * Backend: GET /orders/my?limit=15
 * Returns up to 15 most-recent orders.
 */
export async function fetchOrders(limit = 15): Promise<OrderRowAPI[]> {
  const { data } = await api.get<{ data: any[] }>("/orders/my", { params: { limit } });

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

/* ----------------------------------------------------------------------------
 * Create Order (POST /orders)
 * - Uses the Swagger contract you provided.
 * - Normalizes the response to always have `.logisticsCenterId` (camelCase).
 * - Surfaces helpful error messages on 400/404.
 * --------------------------------------------------------------------------*/
export async function createOrder(
  payload: CreateOrderRequest
): Promise<CreateOrderResponseData> {
  try {
    const { data } = await api.post<CreateOrderResponse>("/orders", payload);
    const raw = data?.data ?? (data as any);

    // Normalize LogisticsCenterId → logisticsCenterId if backend uses capital L
    const normalized: CreateOrderResponseData = {
      ...raw,
      logisticsCenterId: raw?.logisticsCenterId ?? raw?.LogisticsCenterId,
    };

    return normalized;
  } catch (err: any) {
    const status = err?.response?.status;
    const body = err?.response?.data;
    const serverMsg = body?.error || body?.message || err?.message || "Unknown error";
    const details = body?.details;

    // Build a developer-friendly message (also useful for toasts)
    let friendly = `Order creation failed`;
    if (status === 400) friendly = `Validation error`;
    else if (status === 404) friendly = `Not found`;
    else if (status === 401) friendly = `Unauthorized`;

    const e = new Error(
      `${friendly}: ${serverMsg}${details ? ` — ${JSON.stringify(details)}` : ""}`
    ) as Error & { status?: number; details?: unknown };
    e.status = status;
    e.details = details ?? null;
    throw e;
  }
}
