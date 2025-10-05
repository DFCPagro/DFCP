// src/api/market.ts
import { api } from "./config";
import { z } from "zod";

import { AddressSchema, AddressListSchema, type Address } from "@/types/address";
import {
  MarketStockDocSchema,
  type MarketStockDoc,
  type MarketItem,
  flattenMarketDocToItems as flattenDocToItemsFromTypes,
} from "@/types/market";

/* -----------------------------------------------------------------------------
 * Raw (backend-aligned) zod schemas
 * -------------------------------------------------------------------------- */

const ItemRaw = z.object({
  _id: z.string(), // subdoc id
  itemId: z.string(),
  displayName: z.string(),
  imageUrl: z.string().url().optional(),
  category: z.string().optional(),
  pricePerUnit: z.number().nonnegative().optional(),
  avgWeightPerUnitKg: z.number().nonnegative().optional(), // NEW (backend will add)
  originalCommittedQuantityKg: z.number().nonnegative().optional(),
  currentAvailableQuantityKg: z.number().nonnegative().optional(),
  farmerID: z.string().optional(),
  farmerName: z.string().optional(),
  farmName: z.string().optional(),
  farmLogo: z.string().url().optional(),
  status: z.enum(["active", "soldout", "removed"]).optional(),
  farmerOrderId: z.string().optional(),
});

const DocRaw = z.object({
  _id: z.string(),
  LCid: z.string(),
  availableDate: z.union([z.string(), z.date()]), // we normalize to YYYY-MM-DD
  availableShift: z
    .string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(["morning", "afternoon", "evening", "night"])),
  items: z.array(ItemRaw).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/* -----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

const toYMD = (d: string | Date): string => {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  // If it's already YYYY-MM-DD, keep it; else, parse as Date
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date(d).toISOString().slice(0, 10);
};

// local re-export with a friendly name to keep import sites clean
export const flattenMarketDocToItems = (doc: MarketStockDoc): MarketItem[] =>
  flattenDocToItemsFromTypes(doc);

/* -----------------------------------------------------------------------------
 * Addresses
 * -------------------------------------------------------------------------- */

export async function getCustomerAddresses(): Promise<Address[]> {
  const { data } = await api.get("/users/addresses");
  return AddressSchema.array().parse(data?.data ?? data);
}

type AddressInput = Omit<Address, "logisticCenterId">;

export async function addCustomerAddress(input: AddressInput): Promise<Address[]> {
  const { data } = await api.post("/users/addresses", input);
  return AddressListSchema.parse(data?.data ?? data);
}

/* -----------------------------------------------------------------------------
 * Shifts (keep light typing to avoid coupling)
 * -------------------------------------------------------------------------- */

export type AvailableShift = {
  marketStockId?: string;        // from docId | _id | marketStockId (if provided)
  LCid?: string;                 // from payload or the function arg
  date: string;                  // YYYY-MM-DD
  shift: "morning" | "afternoon" | "evening" | "night";
  slotLabel?: string;            // from deliverySlotLabel | slotLabel (if provided)
};


export async function getAvailableShiftsByLC(LCid: string): Promise<AvailableShift[]> {
  const { data } = await api.get("/market/available-stock/next5", {
    params: { LCid }, // must match backend name exactly
  });

  // Allow either { data: [...] } or [...]
  const raw = (Array.isArray(data?.data) ? data.data : data) as any[] | undefined;
  if (!Array.isArray(raw)) return [];

  const out: AvailableShift[] = [];

  for (const r of raw) {
    const date = toYMD(r?.availableDate ?? r?.date);
    const shiftStr = String(r?.availableShift ?? r?.shift ?? "").toLowerCase();

    // strictly accept only known shifts; skip invalid rows safely
    const isKnownShift =
      shiftStr === "morning" || shiftStr === "afternoon" || shiftStr === "evening" || shiftStr === "night";
    if (!date || !isKnownShift) continue;

    out.push({
      // prefer explicit docId; fallback to _id/marketStockId if backend returns them
      marketStockId: r?.docId ?? r?.marketStockId ?? r?._id ?? undefined,
      LCid: r?.LCid ?? LCid,
      date,
      shift: shiftStr as AvailableShift["shift"],
      // accept either deliverySlotLabel or slotLabel if present
      slotLabel: r?.deliverySlotLabel ?? r?.slotLabel ?? undefined,
    });
  }

  return out;
}

/* -----------------------------------------------------------------------------
 * Stock (the important one)
 * -------------------------------------------------------------------------- */

export async function getStockByMarketStockId(marketStockId: string): Promise<MarketStockDoc> {
  const { data } = await api.get(`/market/available-stock/${encodeURIComponent(marketStockId)}`);
  const raw = DocRaw.parse(data?.data ?? data);

  const normalized: MarketStockDoc = {
    _id: raw._id,
    date: toYMD(raw.availableDate),
    shift: raw.availableShift, // already lowercased enum
    logisticCenterId: raw.LCid,
    lines: raw.items.map((x) => {
      const itemId = x.itemId;
      const farmerID = x.farmerID ?? "unknown";

      return {
        lineId: x._id,
        stockId: `${itemId}_${farmerID}`,
        itemId,

        // Keep original display name in the normalized line
        displayName: x.displayName,
        imageUrl: x.imageUrl,

        // Normalize category: non-empty, lowercased
        category: (x.category ?? "misc").toString().trim().toLowerCase() || "misc",

        // Pricing & quantities (undefined if truly missing; do not coerce to 0)
        pricePerUnit: x.pricePerUnit,
        avgWeightPerUnitKg: x.avgWeightPerUnitKg ? x.avgWeightPerUnitKg : 1, // NEW (backend will add)
        originalCommittedQuantityKg: x.originalCommittedQuantityKg,
        currentAvailableQuantityKg: x.currentAvailableQuantityKg,

        // Provenance (keep exact canonical names used elsewhere)
        farmerID, // keep backend's casing in normalized line (UI-flat will rename to farmerId)
        farmerName: x.farmerName ?? "",
        farmName: x.farmName,
        farmLogo: x.farmLogo,

        status: x.status,
        farmerOrderId: x.farmerOrderId,
      };
    }),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  // Validate normalized shape against the canonical schema
  return MarketStockDocSchema.parse(normalized);
}

/* -----------------------------------------------------------------------------
 * (Optional) Convenience: fetch & flatten in one call
 * -------------------------------------------------------------------------- */

export async function getFlatItemsByMarketStockId(marketStockId: string): Promise<MarketItem[]> {
  const doc = await getStockByMarketStockId(marketStockId);
  return flattenMarketDocToItems(doc);
}
