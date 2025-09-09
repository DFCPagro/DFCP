import type { MarketItem, MarketQuery, ShiftCode, ShiftOption, UserLocation } from "@/types/market";
import { adaptToMarketItems } from "@/helpers/marketMockAdapter";
// @ts-ignore – put your JSON next to this file or adjust the path
import mockDataJson from "@/data/mock-items.json"; 

let savedLocations: UserLocation[] = [
  { _id: "LOC-1", label: "Home – Tel Aviv", street: "Ben Gurion 22", city: "Tel Aviv", lat: 32.08, lng: 34.78 },
];

const SHIFT_LABEL: Record<ShiftCode, string> = {
  MORNING: "Morning (06:00–12:00)",
  AFTERNOON: "Afternoon (12:00–16:00)",
  EVENING: "Evening (16:00–22:00)",
  NIGHT: "Night (22:00–06:00)",
};

export async function fetchMyLocations(): Promise<UserLocation[]> {
  return structuredClone(savedLocations);
}

export async function addLocation(payload: Partial<UserLocation>): Promise<UserLocation> {
  const loc: UserLocation = {
    _id: crypto.randomUUID(),
    label: payload.label || `${payload.street}, ${payload.city}`,
    street: payload.street || "",
    city: payload.city || "",
    lat: payload.lat || 0,
    lng: payload.lng || 0,
  };
  savedLocations = [loc, ...savedLocations];
  return loc;
}

export async function fetchShiftsForLocation(_locationId: string): Promise<ShiftOption[]> {
  // Use mock remaining SKUs based on total items available
  const total = (mockDataJson as any[]).filter(i => (i?.count ?? 0) > 0).length;
  const perShift = Math.max(0, Math.floor(total / 4));
  return (["MORNING","AFTERNOON","EVENING","NIGHT"] as ShiftCode[]).map(code => ({
    code,
    label: SHIFT_LABEL[code],
    remainingSkus: perShift,
    isOpenNow: false,
  }));
}

export async function fetchMarket(q: MarketQuery): Promise<MarketItem[]> {
  // You can vary stock by shift if you want:
  const splitAcrossShifts = true;
  const items = adaptToMarketItems(mockDataJson as any[], { splitAcrossShifts });
  // Optionally simulate fewer items at night:
  const filtered = q.shift === "NIGHT" ? items.slice(0, Math.ceil(items.length * 0.6)) : items;
  return filtered;
}
