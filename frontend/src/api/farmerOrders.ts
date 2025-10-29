// src/api/farmerOrders.ts
import { api } from "./config";
import {
  FarmerOrdersSummarySchema,
  type FarmerOrderDTO,
  type FarmerOrdersSummary as FarmerOrdersSummaryResponse,
} from "@/types/farmerOrders";
import type { ListFarmerOrdersParams } from "./fakes/farmerOrders.fake";

/**
 * Fetch dashboard summary for the current user's logistics center.
 * Backend infers LC from the JWT; no params needed.
 *
 * Response shape (per your sample):
 * {
 *   current: { date, shiftName, count, problemCount, okFO, pendingFO, problemFO, okFarmers, pendingFarmers, problemFarmers },
 *   next:    Array<...same as current...>,
 *   tz: "Asia/Jerusalem",
 *   lc: "66e007000000000000000001"
 * }
 */
export async function getFarmerOrdersSummary(): Promise<FarmerOrdersSummaryResponse> {
  const { data } = await api.get("/farmer-orders/summary");
  // Support either { data: ... } or bare object:
  const payload = data?.data ?? data;
  return FarmerOrdersSummarySchema.parse(payload);
}

/* -------------------------------------------------------------------------- */
/* (Optional, for later) Accept / Reject actions                               */
/* -------------------------------------------------------------------------- */

// export async function acceptFarmerOrder(orderId: string): Promise<void> {
//   if (!orderId) throw new Error("orderId is required");
//   await api.patch(`/farmer-orders/${encodeURIComponent(orderId)}/accept`);
// }

// export async function rejectFarmerOrder(orderId: string, note: string): Promise<void> {
//   if (!orderId) throw new Error("orderId is required");
//   if (!note?.trim()) throw new Error("A non-empty note is required for rejection");
//   await api.patch(`/farmer-orders/${encodeURIComponent(orderId)}/reject`, { note });
// }

let fakeApi: null | typeof import("@/api/fakes/farmerOrders.fake") = null;

export async function listFarmerOrders(
  params?: ListFarmerOrdersParams
): Promise<FarmerOrderDTO[]> {
  if (true) {
    return fakeApi.listFarmerOrders(params);
  }
}
