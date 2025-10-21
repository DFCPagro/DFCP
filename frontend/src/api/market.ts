// src/api/market.ts
import { api } from "./config";
import { z } from "zod";
import { ASSET_BASE_URL } from "@/helpers/env"; 

import { AddressSchema, AddressListSchema, type Address } from "@/types/address";
import {
  MarketStockDocSchema,
  type MarketStockDoc,
  type MarketItem,
  flattenMarketDocToItems as flattenDocToItemsFromTypes,
} from "@/types/market";

/* -----------------------------------------------------------------------------
 * Raw (backend-aligned) zod schemas
 *  - Extended to support new model: unitMode + estimates{...}
 *  - Kept legacy root-level avgWeightPerUnitKg for compatibility.
 * -------------------------------------------------------------------------- */

function normalizeAssetUrl(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  // Absolute (http/https/data) — leave as is
  if (/^(https?:|data:)/i.test(s)) return s;
  // Protocol-relative //cdn... — make it https
  if (/^\/\//.test(s)) return `https:${s}`;
  // Relative path /uploads/… — prefix with base
  if (s.startsWith("/") && ASSET_BASE_URL) {
    return `${ASSET_BASE_URL.replace(/\/+$/, "")}${s}`;
  }
  // Anything else that isn’t a valid absolute URL gets dropped
  return undefined;
}
const UnitModeRaw = z.enum(["kg", "unit", "mixed"]);

const ItemEstimatesRaw = z.object({
  avgWeightPerUnitKg: z.number().nonnegative().nullable().optional(),
  sdKg: z.number().nonnegative().nullable().optional(),
  availableUnitsEstimate: z.number().nonnegative().nullable().optional(),
});

const ItemRaw = z.object({
  _id: z.string(), // subdoc id
  itemId: z.string(),
  displayName: z.string(),
  imageUrl: z.preprocess(normalizeAssetUrl, z.string().url().optional()),
  category: z.string().optional(),
  pricePerUnit: z.number().nonnegative().optional(),

  // LEGACY (pre-new-model) – kept for compatibility:
  avgWeightPerUnitKg: z.number().nonnegative().optional(),

  originalCommittedQuantityKg: z.number().nonnegative().optional(),
  currentAvailableQuantityKg: z.number().nonnegative().optional(),

  farmerID: z.string().optional(),
  farmerName: z.string().optional(),
  farmName: z.string().optional(),
  farmLogo: z.preprocess(normalizeAssetUrl, z.string().url().optional()),
  status: z.enum(["active", "soldout", "removed"]).optional(),
  farmerOrderId: z.string().optional(),

  // NEW (post-new-model):
  unitMode: UnitModeRaw.optional(),
  estimates: ItemEstimatesRaw.optional(),
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
 *  - Now reads new fields and keeps legacy behavior:
 *    * avgWeightPerUnitKg falls back to 1 if not provided anywhere.
 *    * Pass through unitMode and estimates (if present).
 *    * If availableUnitsEstimate is missing but we have avgWeightPerUnitKg and currentAvailableQuantityKg,
 *      we derive an integer estimate (= floor(qtyKg / avgW)).
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

      // Prefer new estimates.avgWeightPerUnitKg; fall back to legacy root; then to 1 (keep old behavior)
      const avgW =
        (x.estimates?.avgWeightPerUnitKg ?? x.avgWeightPerUnitKg ?? undefined);
      const avgWeightPerUnitKg =
        typeof avgW === "number" && Number.isFinite(avgW) && avgW > 0 ? avgW : 1;

      // Derive availableUnitsEstimate if backend omitted it but provided enough info
      let availableUnitsEstimate =
        x.estimates?.availableUnitsEstimate ?? null;

      if (
        (availableUnitsEstimate == null || Number.isNaN(availableUnitsEstimate)) &&
        typeof x.currentAvailableQuantityKg === "number" &&
        Number.isFinite(x.currentAvailableQuantityKg) &&
        x.currentAvailableQuantityKg >= 0 &&
        typeof avgWeightPerUnitKg === "number" &&
        Number.isFinite(avgWeightPerUnitKg) &&
        avgWeightPerUnitKg > 0
      ) {
        availableUnitsEstimate = Math.floor(x.currentAvailableQuantityKg / avgWeightPerUnitKg);
      }

      return {
       
        stockId: `${itemId}_${farmerID}`,
        itemId,

        // Keep original display name in the normalized line
        displayName: x.displayName,
        imageUrl: x.imageUrl,

        // Normalize category: non-empty, lowercased
        category: (x.category ?? "misc").toString().trim().toLowerCase() || "misc",

        // Pricing & quantities (undefined if truly missing; do not coerce to 0)
        pricePerUnit: x.pricePerUnit,
        avgWeightPerUnitKg, // <- preserves previous default(1) while supporting new nested field
        originalCommittedQuantityKg: x.originalCommittedQuantityKg,
        currentAvailableQuantityKg: x.currentAvailableQuantityKg,

        // Provenance (keep exact canonical names used elsewhere)
        farmerID, // keep backend's casing in normalized line (UI-flat will rename to farmerId)
        farmerName: x.farmerName ?? "",
        farmName: x.farmName,
        farmLogo: x.farmLogo,

        status: x.status,
        farmerOrderId: x.farmerOrderId,

        // NEW passthroughs (optional in types, so UI remains unchanged if unused)
        unitMode: x.unitMode,
        estimates: {
          avgWeightPerUnitKg: x.estimates?.avgWeightPerUnitKg ?? avgWeightPerUnitKg ?? null,
          sdKg: x.estimates?.sdKg ?? null,
          availableUnitsEstimate: availableUnitsEstimate ?? null,
        },
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



/**
 * GET /marketItemPage/:itemId/:farmerUserId
 * (Optionally pass marketStockId to help the backend compute related items)
 */
/*-----------ITEM PAGE-----------*/
export type MarketItemPageData = {
  farmerBio?: string;
  farmName?: string;
  farmerLogo?: string;
  farmLogo?: string;
  benefits?: string[];
  caloriesPer100g?: number;
};

export async function getMarketItemPage(itemId: string, farmerUserId: string): Promise<MarketItemPageData> {
  const { data } = await api.get(`items/marketItemPage/${encodeURIComponent(itemId)}/${encodeURIComponent(farmerUserId)}`);
  const item = data?.data?.item ?? {};
  const farmer = data?.data?.farmer ?? {};
  return {
    farmerBio: farmer.farmerBio ?? "",
    farmName: farmer.farmName ?? "",
    farmerLogo: farmer.logo ?? "",
    farmLogo: farmer.farmLogo ?? "",
    benefits: Array.isArray(item.customerInfo) ? item.customerInfo : [],
    caloriesPer100g: typeof item.caloriesPer100g === "number" ? item.caloriesPer100g : undefined,
  };
}

