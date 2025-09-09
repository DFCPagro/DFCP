import { api } from "./config";
import type { MarketItem, MarketQuery, ShiftOption, UserLocation } from "@/types/market";

export async function fetchMyLocations(): Promise<UserLocation[]> {
  const { data } = await api.get("/market/locations/me");
  return data;
}
export async function addLocation(payload: Partial<UserLocation>): Promise<UserLocation> {
  const { data } = await api.post("/market/locations", payload);
  return data;
}
export async function fetchShiftsForLocation(locationId: string): Promise<ShiftOption[]> {
  const { data } = await api.get("/market/shifts", { params: { locationId } });
  return data;
}
export async function fetchMarket(q: MarketQuery): Promise<MarketItem[]> {
  const { data } = await api.get("/market", { params: q });
  return data;
}
