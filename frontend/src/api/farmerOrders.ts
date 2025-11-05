// src/api/farmerOrders.ts
import { api } from "./config";
import {
  FarmerOrdersSummarySchema,
  FarmerOrderDTOSchema,
  // Keep this available for future response validation if desired
  // GetFarmerOrderByShiftResponseSchema,
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

// NEW: fake helpers (no network)
import { getFakeByShift } from "./fakes/farmerOrders.fake";

/* -------------------------------- Constants ------------------------------- */

const BASE = "/farmer-orders";

/**
 * React Query key for "by shift" lookups.
 * - Includes fake controls so caches don't collide.
 */
export const qkFarmerOrdersByShift = (
  p: ShiftFarmerOrdersQuery & { fake?: boolean; fakeNum?: number }
) =>
  [
    "farmerOrders",
    "byShift",
    p.date,
    p.shiftName,
    p.page ?? "all",
    p.limit ?? "all",
    p.fake ? "fake" : "real",
    p.fake ? String(p.fakeNum ?? 12) : "n/a",
  ] as const;

/* ------------------------------- Summary API ------------------------------ */

/**
 * Fetch dashboard summary for the current user's logistics center.
 * Backend infers LC from the JWT; no params needed.
 */
export async function getFarmerOrdersSummary(): Promise<FarmerOrdersSummaryResponse> {
  const { data } = await api.get(`${BASE}/summary`);
  const payload = (data as any)?.data ?? data;
  return FarmerOrdersSummarySchema.parse(payload);
}

/* --------------------------- Create Farmer Order -------------------------- */

export async function createFarmerOrder(
  req: CreateFarmerOrderRequest
): Promise<FarmerOrderDTO> {
  if (!req?.itemId) throw new Error("itemId is required");
  if (!req?.farmerId) throw new Error("farmerId is required");
  if (!req?.shift) throw new Error("shift is required");
  if (!req?.pickUpDate) throw new Error("pickUpDate is required");
  if (!(Number.isFinite as (n: unknown) => boolean)(req.forcastedQuantityKg))
    throw new Error("forcastedQuantityKg must be a finite number");

  const { data } = await api.post(BASE, req);
  const payload = (data as any)?.data ?? data;
  return FarmerOrderDTOSchema.parse(payload);
}

/* ----------------------------- By-Shift lookup ---------------------------- */

/**
 * GET /api/farmer-orders/by-shift
 *
 * Now supports a **fake mode**:
 *  - If `params.fake === true`, returns a locally generated response with
 *    `params.fakeNum` orders (clamped to 8–12) using the canonical fake dataset.
 *  - Otherwise, performs the real API request.
 *
 * This keeps the component/hook contract identical regardless of the source.
 */
export async function getFarmerOrdersByShift(
  params: ShiftFarmerOrdersQuery & { fake?: boolean; fakeNum?: number },
  opts?: { signal?: AbortSignal }
): Promise<ShiftFarmerOrdersResponse> {
  // FAKE PATH (no network)
  if (params.fake) {
    const { orders } = getFakeByShift({
      date: params.date,
      shiftName: params.shiftName as any, // "morning" | "afternoon" | "evening" | "night"
      fakeNum: params.fakeNum ?? 12,
    });

    // Pagination (always compute page/limit as numbers)
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? orders.length);
    const start = (page - 1) * limit;
    const end = start + limit;

    const paged = orders.slice(start, end);

    const fakeResponse: ShiftFarmerOrdersResponse = {
      meta: {
        date: params.date,
        shiftName: params.shiftName as any,
        page,
        limit,
        total: orders.length,
        pages: Math.max(1, Math.ceil(orders.length / Math.max(1, limit))),
        problemCount: 0, // all OK in fake mode for now
        // lc, tz can be added if you want
      },
      items: paged as any, // matches your item shape
    };

    return fakeResponse;
  }

  // REAL PATH (network)
  const sp = new URLSearchParams();
  sp.set("date", params.date);
  sp.set("shiftName", params.shiftName);
  if (params.page != null) sp.set("page", String(params.page));
  if (params.limit != null) sp.set("limit", String(params.limit));

  // (Future: when BE adds support, you can uncomment the next two lines)
  // if (params.fake != null) sp.set("fake", String(params.fake));
  // if (params.fakeNum != null) sp.set("fakeNum", String(params.fakeNum));

  const { data } = await api.get<ShiftFarmerOrdersResponse>(
    `${BASE}/by-shift?${sp.toString()}`,
    { signal: opts?.signal }
  );
  return data;
}

/* ------------------------- Stage & Status mutations ----------------------- */

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
 * PATCH /api/v1/farmer-orders/:id/stage
 * Advance a farmer order to a specific stage.
 */
export async function advanceFarmerOrderStage(
  orderId: string,
  body: AdvanceFarmerOrderStageBody
): Promise<ShiftFarmerOrderItem> {
  const { data } = await api.patch(
    `${BASE}/${encodeURIComponent(orderId)}/stage`,
    body
  );
  return ((data as any)?.data ?? data) as ShiftFarmerOrderItem;
}

/**
 * PATCH /api/v1/farmer-orders/:id/farmer-status
 */
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
  return ((data as any)?.data ?? data) as ShiftFarmerOrderItem;
}
