// src/api/farmerOrders.ts
import type { FarmerOrdersSummary } from "@/types/farmerOrders";
import { FarmerOrdersSummarySchema } from "@/types/farmerOrders";
import { api } from "./config";

export async function listFarmerOrders(): Promise<FarmerOrdersSummary[]> {
  const { data } = await api.get("/farmer-orders/summary");
  return FarmerOrdersSummarySchema.array().parse(data?.data ?? data);
}

/**
 * Accept an incoming farmer order.
 * - Sets farmerStatus="ok" on the backend.
 * - Returns void (204 or 200).
 */
// export async function acceptFarmerOrder(orderId: string): Promise<void> {
//   if (!orderId) throw new Error("orderId is required");
//   const url = `${API_BASE}/farmer-orders/${encodeURIComponent(orderId)}/accept`;
//   await http<void>(url, {
//     method: "PATCH",
//     headers: {
//       "Content-Type": "application/json",
//       ...buildAuthHeaders(),
//     },
//     // no body needed per our contract
//   });
// }

// /**
//  * Reject an incoming farmer order with a required note.
//  * - Sets farmerStatus="problem" and creates a stage entry server-side.
//  * - Returns void (204 or 200).
//  */
// export async function rejectFarmerOrder(
//   orderId: string,
//   note: string
// ): Promise<void> {
//   if (!orderId) throw new Error("orderId is required");
//   if (!note?.trim()) throw new Error("A non-empty note is required for rejection");
//   const url = `${API_BASE}/farmer-orders/${encodeURIComponent(orderId)}/reject`;
//   await http<void>(url, {
//     method: "PATCH",
//     headers: {
//       "Content-Type": "application/json",
//       ...buildAuthHeaders(),
//     },
//     body: JSON.stringify({ note }),
//   });
// }
