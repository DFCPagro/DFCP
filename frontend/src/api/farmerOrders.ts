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
import type { FarmerViewByShiftResponse } from "@/pages/farmer/farmerOrder.type";
import { getFakeByShift } from "./fakes/farmerOrders.fake";
import { get } from "mongoose";
import type { QualityStandards } from "@/components/common/items/QualityStandardsSection";
import type {
  DairyQualityMeasurements,
  QualityMeasurements,
} from "@/types/items";
import type { DairyQualityStandards } from "@/components/common/items/DairyQualityStandardsTable";

export type UpdateQualityStandardsPayload = {
  category?: string | null;
  // keep it simple: we accept the flat measurements object from the form
  standards?: any;
  tolerance?: string | null;
};

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

function getShiftWindow(shiftName: ShiftFarmerOrdersQuery["shiftName"]) {
  const shiftWindows: Record<
    ShiftFarmerOrdersQuery["shiftName"],
    { start: string; end: string }
  > = {
    morning: { start: "08:00", end: "12:00" },
    afternoon: { start: "12:00", end: "16:00" },
    evening: { start: "16:00", end: "20:00" },
    night: { start: "20:00", end: "00:00" },
  };

  return shiftWindows[shiftName];
}
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
export async function getMyFarmerOrdersByShift(
  params: ShiftFarmerOrdersQuery & { fake?: boolean; fakeNum?: number },
  opts?: { signal?: AbortSignal }
): Promise<FarmerViewByShiftResponse> {
  // Optional: keep your fake path if you want parity
  if (params.fake) {
    const { orders } = getFakeByShift({
      date: params.date,
      shiftName: params.shiftName as any,
      fakeNum: params.fakeNum ?? 12,
    });
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? orders.length);
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      meta: {
        lc: "fake",
        date: params.date,
        shiftName: params.shiftName as any,
        tz: "Asia/Jerusalem",
        page,
        limit,
        total: orders.length,
        pages: Math.max(1, Math.ceil(orders.length / Math.max(1, limit))),
        problemCount: 0,
        scopedToFarmer: true,
        forFarmerView: true,
      },
      items: orders.slice(start, end) as any,
    };
  }

  const sp = new URLSearchParams();
  sp.set("date", params.date);
  sp.set("shiftName", params.shiftName);
  if (params.page != null) sp.set("page", String(params.page));
  if (params.limit != null) sp.set("limit", String(params.limit));

  const { data } = await api.get<FarmerViewByShiftResponse>(
    `${BASE}/by-shift?${sp.toString()}`,
    { signal: opts?.signal }
  );
  return data;
}

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
    const sp = new URLSearchParams();
    sp.set("date", "2025-11-09"); // snapshot date on backend
    sp.set("shiftName", "afternoon"); // snapshot shift on backend
    if (params.page != null) sp.set("page", String(params.page));
    if (params.limit != null) sp.set("limit", String(params.limit));

    const { data } = await api.get<ShiftFarmerOrdersResponse>(
      `${BASE}/by-shift?${sp.toString()}`,
      { signal: opts?.signal }
    );

    // Force meta to reflect the caller's params (not the snapshot)
    return {
      ...data,
      meta: {
        ...(data.meta ?? {}),
        date: params.date,
        shiftName:
          params.shiftName as ShiftFarmerOrdersResponse["meta"]["shiftName"],
        shiftWindow: getShiftWindow(params.shiftName),
      },
    };
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
  /** Target stage key (BE spelling preserved, e.g. "received") */
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

//*---------------FARMER----------------*/

// --- Query keys for dashboard lists ---
export const qkMyOrdersPending = (p?: { from?: string; to?: string }) =>
  ["farmerOrders", { status: "pending", from: p?.from, to: p?.to }] as const;

export const qkMyOrdersAccepted = () =>
  ["farmerOrders", { status: "ok" }] as const;

// --- Slim projection for cards ---
export const FARMER_ORDER_CARD_FIELDS = [
  "pickUpDate",
  "shift",
  "farmerStatus",
  "type",
  "variety",
  "forcastedQuantityKg",
  "finalQuantityKg",
] as const;

// --- Query-string helper + unwrap (if you don't already have it) ---
const toQuery = (params: Record<string, any>) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return;
    if (Array.isArray(v)) v.forEach((x) => usp.append(k, String(x)));
    else usp.set(k, String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
};
const unwrap = <T>(p: any): T => (p?.data ?? p) as T;

// --- List my orders (role-aware on BE) ---
export type ListMyOrdersParams = {
  farmerStatus?: "pending" | "ok" | "problem";
  from?: string;
  to?: string;
  fields?: string[];
  limit?: number;
  offset?: number;
  window?: "future" | "past" | "all";
};

export async function listMyOrders(params: ListMyOrdersParams = {}) {
  const q = toQuery(params);
  const { data } = await api.get(`${BASE}${q}`);
  return unwrap<FarmerOrderDTO[]>(data);
}

// --- Accept / Reject convenience (reusing your mutation) ---
export async function acceptMyFarmerOrder(orderId: string) {
  return updateFarmerOrderStatus(orderId, "ok");
}
export async function rejectMyFarmerOrder(orderId: string, note: string) {
  return updateFarmerOrderStatus(orderId, "problem", note);
}
/* ------------------ Print payload & container operations ------------------ */
/**
 * The following types and functions support the "Farmer Order Report" screen:
 *  - Get a printable payload (order + QRs)
 *  - Initialize N container QRs
 *  - Patch container weights
 *
 * NOTE:
 *  - These types are exported with the exact names used by the UI:
 *    ShiftName, ContainerQR, Container, FarmerOrder, PrintPayload
 *  - Endpoints are based on the same BASE used above (no leading /api here).
 */

export type ShiftName = "morning" | "afternoon" | "evening" | "night";

export type ContainerQR = {
  token: string;
  sig: string;
  scope: string;
  subjectType: string;
  subjectId: string; // containerId
};

export type Container = {
  containerId: string;
  weightKg: number;
};

export type FarmerOrder = {
  _id: string;
  itemId: string;
  type: string;
  variety?: string;
  pictureUrl?: string;

  /** ISO date string "YYYY-MM-DD" */
  pickUpDate: string;

  /** NEW: ISO datetime string from the backend, e.g. "2025-11-13T00:30:00.000Z" */
  pickUpTime?: string;

  shift: ShiftName;
  category: string;
  farmerName: string;
  farmName: string;
  farmerId: string;
  logisticCenterId?: string;

  // quantities (BE may send any of these)
  sumOrderedQuantityKg?: number;
  forcastedQuantityKg?: number; // BE original spelling
  forecastedQuantityKg?: number; // alias some places may use

  containers?: Container[];

  farmerStatus?: "pending" | "ok" | "problem";

  // legacy/optional
  pickupAddress?: string;
  qualityStandards?: QualityMeasurements | null;

  /** Per-order flat QS for dairy/eggs (if you use it) */
  qualityStandardsDairy?: DairyQualityMeasurements | null;

  /** Whether these were copied from item or custom-edited */
  qualityStandardsType?: "default" | "custom" | null;

  /** Per-order tolerance saved on the FO */
  qualityTolerance?: string | null;
};

export type PrintPayload = {
  farmerOrder: FarmerOrder;
  farmerOrderQR: { token: string; sig: string; scope: string };
  containerQrs: ContainerQR[];
};

/**
 * GET /farmer-orders/:id/print
 * Prepared API call – wire this when mockMode=false
 */
export async function getFarmerOrderPrintPayload(
  farmerOrderId: string
): Promise<PrintPayload> {
  const { data } = await api.get<{ data: PrintPayload }>(
    `${BASE}/${encodeURIComponent(farmerOrderId)}/print`
  );
  // Align with caller expectations: unwrap `{ data }`
  return (data as any)?.data ?? data;
}

/**
 * POST /farmer-orders/:id/containers/init
 * Initialize N new containers; backend returns the created IDs.
 */
export async function initContainers(
  farmerOrderId: string,
  count: number
): Promise<{ ok: boolean; added: number; containerIds: string[] }> {
  const { data } = await api.post(
    `${BASE}/${encodeURIComponent(farmerOrderId)}/containers/init`,
    { count }
  );
  return (data as any)?.data ?? data;
}

/**
 * PATCH /farmer-orders/:id/containers/weights
 * Upsert weights for a list of containers.
 */
export async function patchContainerWeights(
  farmerOrderId: string,
  weights: Array<{ containerId: string; weightKg: number }>
): Promise<{ ok: boolean; updated: number }> {
  const { data } = await api.patch(
    `${BASE}/${encodeURIComponent(farmerOrderId)}/containers/weights`,
    { weights }
  );
  return (data as any)?.data ?? data;
}

export async function updateFarmerOrderQualityStandards(
  farmerOrderId: string,
  payload: UpdateQualityStandardsPayload
) {
  const { data } = await api.patch(
    `${BASE}/${encodeURIComponent(farmerOrderId)}/quality-standards`,
    payload
  );
  return (data as any)?.data ?? data;
}
