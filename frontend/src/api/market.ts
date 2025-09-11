// src/api/market.ts
import { api } from "./config";
import type { MarketItem, MarketQuery, ShiftOption, UserLocation } from "@/types/market";

/**
 * Get all saved delivery locations for the logged-in user
 */
export async function fetchMyLocations(): Promise<UserLocation[]> {
  const { data } = await api.get("/market/locations/me");
  return data;
}

/**
 * Add a new delivery location
 */
export async function addLocation(payload: Partial<UserLocation>): Promise<UserLocation> {
  // if the api location does not eixist pick location from mock data

    const { data } = await api.post("/market/locations", payload);
  return data;
}

/**
 * Get available shifts for a given location
 */
export async function fetchShiftsForLocation(locationId: string): Promise<ShiftOption[]> {
  const { data } = await api.get("/market/shifts", { params: { locationId } });
  return data;
}

/**
 * Get all available market items for a given location & shift
 */
export async function fetchMarket(q: MarketQuery): Promise<MarketItem[]> {
  const { data } = await api.get("/market", { params: q });
  return data;
}
