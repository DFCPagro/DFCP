import { api } from "./config";
import { AddressSchema, AddressListSchema, type Address} from "@/types/address";
import {
  AvailableShiftSchema,
  MarketStockDocSchema,
  type AvailableShift,
  type MarketStockDoc,
} from "@/types/market";

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
  const { data } = await api.get("/market/available-stock/next5",
 {
    params: { LCid },
  });
  return Array.isArray(data?.data) ? data.data : data;
}

/** 3) Based on selected shift (with marketStockId), fetch the stock doc */
export async function getStockByMarketStockId(marketStockId: string): Promise<MarketStockDoc> {
  const { data } = await api.get(`/market/available-stock/${encodeURIComponent(marketStockId)}`);
  return MarketStockDocSchema.parse(data?.data ?? data);
}

