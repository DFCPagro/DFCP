// src/api/farmerOrders.ts
import { api } from "./config";
import {
  FarmerOrdersSummarySchema,
  FarmerOrderDTOSchema,
  GetFarmerOrderByShiftResponseSchema,
} from "@/types/farmerOrders";
import type {
  FarmerOrdersSummaryResponse,
  CreateFarmerOrderRequest,
  FarmerOrderDTO,
  ShiftFarmerOrdersQuery,
  ShiftFarmerOrdersResponse,
  FarmerOrderStageKey,
  ShiftFarmerOrderItem,
  FarmerOrderStatus,
} from "@/types/farmerOrders";
import type { ListFarmerOrdersParams } from "./fakes/farmerOrders.fake";

/* -------------------------------- Constants ------------------------------- */

const BASE = "/farmer-orders";

export const qkFarmerOrdersByShift = (p: ShiftFarmerOrdersQuery) =>
  [
    "farmerOrders",
    "byShift",
    p.date,
    p.shiftName,
    p.page ?? "all",
    p.limit ?? "all",
  ] as const;

/* ------------------------------- Summary API ------------------------------ */

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
  const { data } = await api.get(`${BASE}/summary`);
  // Support either { data: ... } or bare object:
  const payload = data?.data ?? data;
  return FarmerOrdersSummarySchema.parse(payload);
}

/* --------------------------- Create Farmer Order -------------------------- */
/**
 * Create a farmer order.
 * Expected request (exactly as backend expects):
 * {
 *   itemId: string,
 *   farmerId: string,
 *   shift: "morning" | "afternoon" | "evening" | "night",
 *   pickUpDate: "YYYY-MM-DD",
 *   forcastedQuantityKg: number
 * }
 *
 * Backend returns either { data: FarmerOrderDTO } or a bare FarmerOrderDTO.
 */
export async function createFarmerOrder(
  req: CreateFarmerOrderRequest
): Promise<FarmerOrderDTO> {
  // Light runtime guards (dev-friendly messages; Zod still validates the response)
  if (!req?.itemId) throw new Error("itemId is required");
  if (!req?.farmerId) throw new Error("farmerId is required");
  if (!req?.shift) throw new Error("shift is required");
  if (!req?.pickUpDate) throw new Error("pickUpDate is required");
  if (!(Number.isFinite as (n: unknown) => boolean)(req.forcastedQuantityKg))
    throw new Error("forcastedQuantityKg must be a finite number");

  const { data } = await api.post(BASE, req);
  const payload = data?.data ?? data;
  return FarmerOrderDTOSchema.parse(payload);
}

// ADD: GET /api/farmer-orders/by-shift
export async function getFarmerOrdersByShift(
  params: ShiftFarmerOrdersQuery,
  opts?: { signal?: AbortSignal }
): Promise<ShiftFarmerOrdersResponse> {
  const sp = new URLSearchParams();
  sp.set("date", params.date);
  sp.set("shiftName", params.shiftName);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));

  const { data } = await api.get<ShiftFarmerOrdersResponse>(
    `/farmer-orders/by-shift?${sp.toString()}`,
    { signal: opts?.signal }
  );
  // console.log("[getFarmerOrdersByShift] data:", data);
  return data;
}

/** Body for advancing a farmer order to a specific stage */
export type AdvanceFarmerOrderStageBody = {
  /** Target stage key (BE spelling preserved, e.g. "recieved") */
  key: FarmerOrderStageKey;
  /** Action verb required by BE contract */
  action: "setCurrent";
  /** Optional audit note */
  note?: string;
};

/**
 * Advance a farmer order to a specific stage.
 * POST /api/v1/farmer-orders/:id/advance-stage
 *
 * Returns the updated order item (server is the source of truth for timestamps/audit).
 */
export async function advanceFarmerOrderStage(
  orderId: string,
  body: AdvanceFarmerOrderStageBody
): Promise<ShiftFarmerOrderItem> {
  const { data } = await api.patch(
    `/farmer-orders/${encodeURIComponent(orderId)}/stage`,
    body
  );
  return (data as any)?.data ?? data;
}

// PATCH /api/v1/farmer-orders/:id/farmer-status
export async function updateFarmerOrderStatus(
  orderId: string,
  status: FarmerOrderStatus,
  note?: string
): Promise<ShiftFarmerOrderItem> {
  if (!orderId) throw new Error("orderId is required");
  if (!status) throw new Error("status is required");

  const { data } = await api.patch(
    `${BASE}/${encodeURIComponent(orderId)}/farmer-status`,
    { status, note }
  );
  return (data as any)?.data ?? data;
}

/* ------------------------------ (Optional) AR ----------------------------- */

// export async function acceptFarmerOrder(orderId: string): Promise<void> {
//   if (!orderId) throw new Error("orderId is required");
//   await api.patch(`${BASE}/${encodeURIComponent(orderId)}/accept`);
// }

// export async function rejectFarmerOrder(orderId: string, note: string): Promise<void> {
//   if (!orderId) throw new Error("orderId is required");
//   if (!note?.trim()) throw new Error("A non-empty note is required for rejection");
//   await api.patch(`${BASE}/${encodeURIComponent(orderId)}/reject`, { note });
// }

/* ------------------------- (Optional) Fake listing ------------------------ */

let fakeApi: null | typeof import("@/api/fakes/farmerOrders.fake") = null;

export async function listFarmerOrders(
  params?: ListFarmerOrdersParams
): Promise<FarmerOrderDTO[]> {
  // Keep fake listing behavior, but make the dynamic import safe:
  if (!fakeApi) {
    fakeApi = await import("@/api/fakes/farmerOrders.fake");
  }
  return fakeApi.listFarmerOrders(params);
}
