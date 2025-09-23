import { api } from "./config";
import { z } from "zod";

import { AddressSchema, AddressListSchema, type Address } from "@/types/address";
import {
  MarketStockDocSchema,
  type AvailableShift,
  type MarketStockDoc,
} from "@/types/market";

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
  availableDate: z.string(),                        // "2025-09-23T00:00:00.000Z"
  availableShift: z.enum(["morning","afternoon","evening","night"]),
  items: z.array(ItemRaw).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
const ymd = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : new Date(s).toISOString().slice(0,10);

/** 1) Get customer addresses (list only) */
export async function getCustomerAddresses(): Promise<Address[]> {
  const { data } = await api.get("/users/addresses");
  return AddressSchema.array().parse(data?.data ?? data);
}

type AddressInput = Omit<Address, "logisticCenterId">;

export async function addCustomerAddress(input: AddressInput): Promise<Address[]> {
  const { data } = await api.post("/users/addresses", input);   // <-- flat body
  return AddressListSchema.parse(data?.data ?? data);           // <-- parse array
}

/** 2) After user selects an address, fetch shifts by LC of that address */
// Upcoming (today and forward) for LC
export async function getAvailableShiftsByLC(LCid: string): Promise<AvailableShift[]> {
  const { data } = await api.get("/market/available-stock/next5", {
    params: { LCid },
  });
  return Array.isArray(data?.data) ? data.data : data;
}

/** 3) Based on selected shift (with marketStockId), fetch the stock doc */
// export async function getStockByMarketStockId(marketStockId: string): Promise<MarketStockDoc> {
//   const { data } = await api.get(
//     `/market/available-stock/${encodeURIComponent(marketStockId)}`
//   );
//   return MarketStockDocSchema.parse(data?.data ?? data);
// }
export async function getStockByMarketStockId(marketStockId: string): Promise<MarketStockDoc> {
  const { data } = await api.get(`/market/available-stock/${encodeURIComponent(marketStockId)}`);
  const raw = DocRaw.parse(data?.data ?? data);

  const normalized = {
    _id: raw._id,
    date: ymd(raw.availableDate),
    shift: raw.availableShift,
    logisticCenterId: raw.LCid,
    lines: raw.items.map((x) => ({
      lineId: x._id,
      stockId: `${x.itemId}_${x.farmerID ?? "unknown"}`,
      itemId: x.itemId,
      itemDisplayName: x.displayName,
      itemImageUrl: x.imageUrl,
      category: String(x.category ?? "").toLowerCase(),
      pricePerUnit: Number(x.pricePerUnit ?? 0),
      sourceFarmerId: x.farmerID ?? "",
      sourceFarmerName: x.farmerName ?? "",
      sourceFarmName: x.farmName,
      originalCommittedQuantityKg: Number(x.originalCommittedQuantityKg ?? 0),
      currentAvailableQuantityKg: Number(x.currentAvailableQuantityKg ?? 0),
    })),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  return MarketStockDocSchema.parse(normalized);
}