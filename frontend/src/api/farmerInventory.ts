// src/api/farmerOrders.ts
import { api } from "./config";
import type { FarmerInventoryResponse } from "@/types/farmerInventory";
import {
  FarmerInventoryResponseSchema,
  DemandStatisticsResponseSchema,
  FarmerInventoryItemSchema,
} from "@/types/farmerInventory";
import type { DemandStatisticsResponse } from "@/types/farmerInventory";

// src/api/farmerInventory.ts (or wherever your function lives)

export async function getFarmerInventory(): Promise<FarmerInventoryResponse> {
  const { data } = await api.get("/farmer-inventory/farmer/inventory");
  console.log("API response data:", data);

  // Normalize different BE payload shapes to { data: [...] }
  // Supports:
  // 1) bare array:            [ {...}, {...} ]
  // 2) wrapped object:        { data: [ {...}, {...} ] }
  // 3) accidentally sent obj: { ...singleRow... }  <-- we coerce to one-element array
  let normalized: unknown;

  if (Array.isArray(data)) {
    normalized = { data }; // bare array -> wrap
  } else if (data && typeof data === "object" && "data" in data) {
    normalized = data; // already wrapped
  } else {
    // Last resort: if backend sent a single object, coerce into an array of one
    // (This avoids cryptic crashes; adjust if you never expect this shape.)
    const maybeSingle = data;
    const isSingleValid =
      FarmerInventoryItemSchema.safeParse(maybeSingle).success;
    normalized = isSingleValid ? { data: [maybeSingle] } : { data: [] };
  }

  return FarmerInventoryResponseSchema.parse(normalized);
}

/** Demand statistics (slots → items) */
export async function getDemandStatistics(params?: {
  page?: number;
  limit?: number;
  slotKey?: string;
}): Promise<DemandStatisticsResponse> {
  // NOTE: Endpoint path assumed; change if your backend differs.
  const { data } = await api.get("/demand-statics/", {
    params,
  });
  // console.log("Demand statistics API response data:", data);
  // Support either { data: ... } or bare object:
  const payload = data?.data ?? data;
  return DemandStatisticsResponseSchema.parse(payload);
}
