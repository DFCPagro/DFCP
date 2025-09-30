// src/api/market.ts
import { api } from "./config";
import { z } from "zod";

import { AddressSchema, AddressListSchema, type Address } from "@/types/address";
import {
  MarketStockDocSchema,
  type AvailableShift,
  type MarketStockDoc,
} from "@/types/market";

/* ----------------------------- Raw payloads ----------------------------- */

const ItemRaw = z.object({
  _id: z.string(),
  itemId: z.string(),
  displayName: z.string(),
  imageUrl: z.string().url().optional(),
  category: z.string().optional(),
  pricePerUnit: z.number().optional(),
  currentAvailableQuantityKg: z.number().optional(),
  originalCommittedQuantityKg: z.number().optional(),
  farmerID: z.string().optional(),
  farmerName: z.string().optional(),
  farmName: z.string().optional(),
  status: z.string().optional(),
});

const DocRaw = z.object({
  _id: z.string(),
  LCid: z.string(),
  // can be ISO or yyyy-mm-dd; we will normalize to yyyy-mm-dd
  availableDate: z.string(),
  // be tolerant to backend casing and then enforce enum
  availableShift: z
    .string()
    .transform((s) => s.toLowerCase())
    .pipe(z.enum(["morning", "afternoon", "evening", "night"])),
  items: z.array(ItemRaw).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const ymd = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date(s).toISOString().slice(0, 10);

/* ------------------------------- Addresses ------------------------------ */

export async function getCustomerAddresses(): Promise<Address[]> {
  const { data } = await api.get("/users/addresses");
  // backend may wrap in { data }; accept both
  return AddressSchema.array().parse(data?.data ?? data);
}

type AddressInput = Omit<Address, "logisticCenterId">;

export async function addCustomerAddress(input: AddressInput): Promise<Address[]> {
  // flat body expected by your backend
  const { data } = await api.post("/users/addresses", input);
  return AddressListSchema.parse(data?.data ?? data);
}

/* -------------------------------- Shifts -------------------------------- */

export async function getAvailableShiftsByLC(LCid: string): Promise<AvailableShift[]> {
  const { data } = await api.get("/market/available-stock/next5", {
    params: { LCid }, // ensure param name matches backend exactly
  });
  return Array.isArray(data?.data) ? data.data : data;
}

/* --------------------------------- Stock -------------------------------- */

export async function getStockByMarketStockId(marketStockId: string): Promise<MarketStockDoc> {
  const { data } = await api.get(`/market/available-stock/${encodeURIComponent(marketStockId)}`);
  const raw = DocRaw.parse(data?.data ?? data);

  const normalized: MarketStockDoc = {
    _id: raw._id,
    date: ymd(raw.availableDate),
    shift: raw.availableShift, // guaranteed lowercase by DocRaw
    logisticCenterId: raw.LCid,
    lines: raw.items.map((x) => ({
      lineId: x._id,
      stockId: `${x.itemId}_${x.farmerID ?? "unknown"}`,
      itemId: x.itemId,

      // ✅ canonical keys that grid/cards & flatteners usually expect
      displayName: x.displayName,
      imageUrl: x.imageUrl,

      // safe category (avoid empty string so filters don't exclude)
      category: (x.category ?? "misc").toString().toLowerCase(),

      // don’t auto-zero; preserve "unknown" as undefined
      pricePerUnit: x.pricePerUnit == null ? undefined : Number(x.pricePerUnit),
      originalCommittedQuantityKg:
        x.originalCommittedQuantityKg == null ? undefined : Number(x.originalCommittedQuantityKg),
      currentAvailableQuantityKg:
        x.currentAvailableQuantityKg == null ? undefined : Number(x.currentAvailableQuantityKg),

      // provenance
      sourceFarmerId: x.farmerID ?? "",
      sourceFarmerName: x.farmerName ?? "",
      sourceFarmName: x.farmName,
    })),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  // validate against your frontend schema
  return MarketStockDocSchema.parse(normalized);
}
