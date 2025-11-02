// src/api/packing.ts

import { api } from "./config";
import type { PackedOrder, PackOrderResponse } from "@/types/packing";

/**
 * POST /orders/:id/pack
 * Returns a full packing plan (PackedOrder)
 */
export async function packOrder(orderId: string): Promise<PackedOrder> {
  const { data } = await api.post<PackOrderResponse>(`/orders/${orderId}/pack`);
  return data.data;
}
