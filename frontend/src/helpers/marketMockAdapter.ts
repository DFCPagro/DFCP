import type { MarketItem } from "@/types/market";

export type MockItem = {
  _id: string;
  name: string;
  imageUrl?: string;
  price: { a: number; b?: number; c?: number };
  count: number; // total units
  // ...other fields ignored by Market for now
};

export function adaptToMarketItems(
  raw: MockItem[],
  opts?: { splitAcrossShifts?: boolean }
): MarketItem[] {
  const split = opts?.splitAcrossShifts ?? false;

  return raw.map((r) => ({
    _id: r._id,
    name: r.name,
    imageUrl: r.imageUrl,
    price: Number(r.price?.a ?? 0),
    inStock: split ? Math.max(0, Math.floor((r.count ?? 0) / 4)) : (r.count ?? 0),
    farmer: {
      _id: "FARM-000",
      farmName: "Demo Farm",
      name: "Demo Farmer",
    },
  }));
}
