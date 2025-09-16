// src/api/market.ts
import type {
  MarketItem,
  MarketQuery,
  ShiftCode,
  ShiftOption,
  UserLocation,
} from "@/types/market";
import { adaptToMarketItems } from "@/helpers/marketMockAdapter";
export type ShiftOptionDTO = ShiftOption;

// @ts-ignore – local JSON mock
import mockDataJson from "@/data/mock-items.json";

/* -------------------------------- utils ---------------------------------- */

const shortShift = (s: ShiftCode) =>
  s === "MORNING" ? "MOR" : s === "AFTERNOON" ? "AFT" : s === "EVENING" ? "EVE" : "NIG";

const pad3 = (n: number) => String(n).padStart(3, "0");

/* ---------------------------- in-memory storage --------------------------- */

let savedLocations: UserLocation[] = [
  {
    _id: "LOC-1",
    label: "Home – Tel Aviv",
    street: "Ben Gurion 22",
    city: "Tel Aviv",
    lat: 32.08,
    lng: 34.78,
    logisticCenterId: "LC-CENTER",
  },
];

/* --------------------------- LC resolution (demo) ------------------------- */

const SHIFT_LABEL: Record<ShiftCode, string> = {
  MORNING: "Morning (06:00–12:00)",
  AFTERNOON: "Afternoon (12:00–16:00)",
  EVENING: "Evening (16:00–22:00)",
  NIGHT: "Night (22:00–06:00)",
};

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

/* ------------------------------ locations API ---------------------------- */

export async function fetchMyLocations(): Promise<UserLocation[]> {
  return structuredClone(savedLocations);
}

export async function addLocation(payload: Partial<UserLocation>): Promise<UserLocation> {
  const logisticCenterId =
    payload.logisticCenterId ?? resolveLogisticCenter(payload.city, payload.lat);

  const loc: UserLocation = {
    _id: crypto.randomUUID(),
    label: payload.label || `${payload.street}, ${payload.city}`,
    street: payload.street || "",
    city: payload.city || "",
    lat: payload.lat || 0,
    lng: payload.lng || 0,
    logisticCenterId,
  };
  savedLocations = [loc, ...savedLocations];
  return loc;
}

/* ------------------------------- shifts API ------------------------------ */

export async function fetchShiftsForLocation(_locationId: string): Promise<ShiftOption[]> {
  const total = (mockDataJson as any[]).filter((i) => (i?.count ?? 0) > 0).length;
  const perShift = Math.max(0, Math.floor(total / 4));
  return (["MORNING", "AFTERNOON", "EVENING", "NIGHT"] as ShiftCode[]).map((code) => ({
    code,
    label: SHIFT_LABEL[code],
    remainingSkus: perShift,
    isOpenNow: false,
  }));
}

// Used by ShiftPicker (LC-aware). For the mock we reuse the same options.
export async function fetchShiftOptionsByLC(_logisticCenterId: string): Promise<ShiftOptionDTO[]> {
  return fetchShiftsForLocation("any");
}

/* ------------------------------- market API ------------------------------ */

export async function fetchMarket(q: MarketQuery): Promise<MarketItem[]> {
  // 1) Resolve LC for the selected location
  const loc = (await fetchMyLocations()).find((l) => l._id === q.locationId);
  const lcId = loc?.logisticCenterId ?? "LC-CENTER"; // default aligns with demo

  // 2) Adapt raw JSON -> MarketItem[]
  let items = adaptToMarketItems(mockDataJson as any[], {
    logisticCenterId: lcId,
    shift: q.shift,
  });

  // 3) Ensure each item has an inventoryId with the expected prefix
  const prefix = `${lcId}-${shortShift(q.shift)}-`;
  items = items.map((it, idx) => {
    const inv = (it as any).inventoryId as string | undefined;
    const normalized =
      inv && inv.startsWith(prefix) ? inv : `${prefix}${pad3(idx + 1)}`;
    return { ...it, inventoryId: normalized } as MarketItem & { inventoryId: string };
  });

  // 4) If your mock mixes LC/shift rows, explicitly keep only the current window
  items = items.filter((it: any) => it.inventoryId.startsWith(prefix));

  // 5) Category filter (if provided)
  if (q.category && q.category !== "ALL") {
    items = items.filter((i) => i.category === q.category);
  }

  // Debug (comment out if noisy)
  console.log("fetchMarket ->", {
    locationId: q.locationId,
    lcId,
    shift: q.shift,
    category: q.category,
    count: items.length,
    sample: items[0],
  });

  return items;
}
