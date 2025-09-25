// src/api/farmerOrders.ts
import type { FarmerOrderDTO, FarmerOrderStatus } from "@/types/farmerOrders";

// NOTE: Keep the env toggle consistent with your crops API.
// Default to FAKE unless VITE_USE_FAKE_FARMER_API === "false"
const USE_FAKE =
  (import.meta.env.VITE_USE_FAKE_FARMER_API ?? "true").toLowerCase() !== "false";

const API_BASE: string = (import.meta.env.VITE_API_BASE_URL as string) ?? "/api/v1";

// Lazy import fake impl to avoid bundling it in production if not needed
let fakeApi: null | typeof import("@/api/fakes/farmerOrders.fake") = null;
if (USE_FAKE) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  fakeApi = await import("@/api/fakes/farmerOrders.fake");
}

/** ---------- Types local to this facade ---------- */
export type ListFarmerOrdersParams = {
  farmerStatus?: Extract<FarmerOrderStatus, "pending" | "ok">; // dashboard uses only these two
  from?: string; // ISO date "YYYY-MM-DD" (optional)
  to?: string;   // ISO date "YYYY-MM-DD" (optional)
};

/** Build Authorization header (farmer-scoped) if token exists */
function buildAuthHeaders(): HeadersInit {
  // Try common keys used across the app; harmless if missing
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Basic fetch wrapper aligned with your existing style (farmerCrops.ts) */
async function http<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.message) msg = data.message;
    } catch {
      // ignore json parse errors
    }
    throw new Error(msg);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  // Attempt JSON
  return (await res.json()) as T;
}

/** Build query string from params */
function toQuery(params?: ListFarmerOrdersParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.farmerStatus) sp.set("farmerStatus", params.farmerStatus);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/** =========================
 * Public Facade
 * ======================= */

/**
 * List farmer orders by filter.
 * - For dashboard we only pull `pending` and `ok`.
 * - Response is already in the UI’s DTO shape (keeps forcastedQuantityKg as-is).
 */
export async function listFarmerOrders(
  params?: ListFarmerOrdersParams
): Promise<FarmerOrderDTO[]> {
  if (USE_FAKE && fakeApi) {
    return fakeApi.listFarmerOrders(params);
  }
  const url = `${API_BASE}/farmer-orders${toQuery(params)}`;
  return http<FarmerOrderDTO[]>(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
  });
}

/**
 * Accept an incoming farmer order.
 * - Sets farmerStatus="ok" on the backend.
 * - Returns void (204 or 200).
 */
export async function acceptFarmerOrder(orderId: string): Promise<void> {
  if (!orderId) throw new Error("orderId is required");
  if (USE_FAKE && fakeApi) {
    return fakeApi.acceptFarmerOrder(orderId);
  }
  const url = `${API_BASE}/farmer-orders/${encodeURIComponent(orderId)}/accept`;
  await http<void>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
    // no body needed per our contract
  });
}

/**
 * Reject an incoming farmer order with a required note.
 * - Sets farmerStatus="problem" and creates a stage entry server-side.
 * - Returns void (204 or 200).
 */
export async function rejectFarmerOrder(
  orderId: string,
  note: string
): Promise<void> {
  if (!orderId) throw new Error("orderId is required");
  if (!note?.trim()) throw new Error("A non-empty note is required for rejection");
  if (USE_FAKE && fakeApi) {
    return fakeApi.rejectFarmerOrder(orderId, note);
  }
  const url = `${API_BASE}/farmer-orders/${encodeURIComponent(orderId)}/reject`;
  await http<void>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({ note }),
  });
}
