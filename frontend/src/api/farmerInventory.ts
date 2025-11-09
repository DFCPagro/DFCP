// src/api/farmerOrders.ts
import { api } from "./config";
import type {
  FarmerInventoryResponse,
  ItemCatalogEntry,
} from "@/types/farmerInventory";
import {
  FarmerInventoryResponseSchema,
  DemandStatisticsResponseSchema,
  FarmerInventoryItemSchema,
  ItemCatalogResponseSchema,
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
  // Fetch demand + catalog in parallel
  const [demandResp, catalog] = await Promise.all([
    api.get("/demand-statics/", { params }),
    getItemsCatalog(),
  ]);

  // Normalize demand payload ({ data: ... } or bare)
  const demandPayload = demandResp?.data?.data ?? demandResp?.data;

  // Build a fast lookup: _id -> catalog entry
  const byId = new Map(catalog.map((e) => [e._id, e]));

  // Enrich every item (flattened fields)
  const enriched = {
    ...demandPayload,
    items: (demandPayload?.items ?? []).map((slot: any) => ({
      ...slot,
      items: (slot?.items ?? []).map((it: any) => {
        const meta = byId.get(it.itemId);
        if (!meta) return it;
        const { category, type, variety, imageUrl } = meta;
        return { ...it, category, type, variety, imageUrl };
      }),
    })),
  };

  // console.log(" [getDemandStatistics] API response data:", enriched);

  // Final validation against the UPDATED schema (with flattened fields)
  return DemandStatisticsResponseSchema.parse(enriched);
}

export async function getItemsCatalog(): Promise<ItemCatalogEntry[]> {
  const { data } = await api.get("/items/public"); // 👈 adjust path if different
  return ItemCatalogResponseSchema.parse(data).data;
}
