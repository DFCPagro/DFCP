// src/api/orders.ts
import { api } from "./config";
import type { OrderRowAPI } from "@/types/orders";

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
