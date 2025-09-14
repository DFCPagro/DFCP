import type { MarketItem, MarketQuery, ShiftCode, ShiftOption, UserLocation } from "@/types/market";
import { adaptToMarketItems } from "@/helpers/marketMockAdapter";
// @ts-ignore
import mockDataJson from "@/data/mock-items.json";

const shortShift = (s: ShiftCode) =>
  s === "MORNING" ? "MOR" : s === "AFTERNOON" ? "AFT" : s === "EVENING" ? "EVE" : "NIG";

let savedLocations: UserLocation[] = [
  { _id: "LOC-1", label: "Home – Tel Aviv", street: "Ben Gurion 22", city: "Tel Aviv", lat: 32.08, lng: 34.78, logisticCenterId: "LC-CENTER" },
];

const SHIFT_LABEL: Record<ShiftCode, string> = {
  MORNING: "Morning (06:00–12:00)",
  AFTERNOON: "Afternoon (12:00–16:00)",
  EVENING: "Evening (16:00–22:00)",
  NIGHT: "Night (22:00–06:00)",
};

// very simple demo resolution (by city / latitude)
function resolveLogisticCenter(city?: string, lat?: number): string {
  const c = (city || "").toLowerCase();
  if (/tel.?aviv|ramat|givat/i.test(c)) return "LC-CENTER";
  if (/jerusalem|beit.?shemesh/i.test(c)) return "LC-JERUSALEM";
  if (/haifa|krayot|akk?o/i.test(c)) return "LC-NORTH";
  if (/beer.?sheva|ashkelon|ashdod/i.test(c)) return "LC-SOUTH";
  if (typeof lat === "number") {
    if (lat >= 32.8) return "LC-NORTH";
    if (lat <= 31.2) return "LC-SOUTH";
  }
  return "LC-CENTER";
}

export async function fetchMyLocations(): Promise<UserLocation[]> {
  return structuredClone(savedLocations);
}

export async function addLocation(payload: Partial<UserLocation>): Promise<UserLocation> {
  const logisticCenterId = payload.logisticCenterId ?? resolveLogisticCenter(payload.city, payload.lat);
  const loc: UserLocation = {
    _id: crypto.randomUUID(),
    label: payload.label || `${payload.street}, ${payload.city}`,
    street: payload.street || "",
    city: payload.city || "",
    lat: payload.lat || 0,
    lng: payload.lng || 0,
    logisticCenterId, // ← store it
  };
  savedLocations = [loc, ...savedLocations];
  return loc;
}

export async function fetchShiftsForLocation(_locationId: string): Promise<ShiftOption[]> {
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
  // resolve LC of this location (use your existing logic)
  const loc = (await fetchMyLocations()).find(l => l._id === q.locationId);
  const lcId = loc?.logisticCenterId ?? "LC1";

  // adapt raw -> MarketItem[] (build/accept inventoryId)
  let items = adaptToMarketItems(mockDataJson as any[], {
    logisticCenterId: lcId,
    shift: q.shift,
  });

  // if your mock file mixes different LC/Shift rows, narrow to this selection
  items = items.filter(i =>
    i.inventoryId.startsWith(`${lcId}-${shortShift(q.shift)}-`)
  );

  if (q.category && q.category !== "ALL") {
    items = items.filter(i => i.category === q.category);
  }

  return items;
}