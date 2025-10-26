// src/api/packing.ts

import { api } from "./config"; 
import type { PackingPlan } from "@/types/packing";

export async function packOrder(orderId: string): Promise<PackingPlan> {
  const { data } = await api.post<{ data: PackingPlan }>(`/orders/${orderId}/pack`);
  return data.data;
}
