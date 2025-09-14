// src/helpers/marketMockAdapter.ts
import type { MarketItem, FarmerInfo, CategoryCode, ShiftCode } from "@/types/market";

type Raw = {
  id?: string;               // may be "LC1-MOR-001" OR just a SKU
  name: string;
  price: number;
  count: number;
  imageUrl?: string;
  image?: string;
  farmer?: { id?: string; name?: string; farmName?: string };
  farmName?: string;
  category?: string;         // optional free text
  sku?: string;              // optional explicit SKU if you have it
};

type AdaptOpts = {
  logisticCenterId?: string; // fallback if id isn't composite
  shift?: ShiftCode;         // fallback if id isn't composite
};

const PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'>
      <rect width='100%' height='100%' fill='#f3f4f6'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
        fill='#9ca3af' font-family='Arial' font-size='24'>No image</text>
     </svg>`
  );

const shortToFull: Record<string, ShiftCode> = {
  MOR: "MORNING",
  AFT: "AFTERNOON",
  EVE: "EVENING",
  NIG: "NIGHT",
  MORNING: "MORNING",
  AFTERNOON: "AFTERNOON",
  EVENING: "EVENING",
  NIGHT: "NIGHT",
};
const fullToShort: Record<ShiftCode, "MOR" | "AFT" | "EVE" | "NIG"> = {
  MORNING: "MOR",
  AFTERNOON: "AFT",
  EVENING: "EVE",
  NIGHT: "NIG",
};

function parseCompositeId(id?: string):
  | { lc: string; shift: ShiftCode; sku: string }
  | null {
  if (!id) return null;
  const m = id.match(/^([A-Za-z0-9]+)-([A-Za-z]+)-([A-Za-z0-9]+)$/);
  if (!m) return null;
  const lc = m[1];
  const shiftRaw = m[2].toUpperCase();
  const sku = m[3];
  const shift = shortToFull[shiftRaw];
  if (!shift) return null;
  return { lc, shift, sku };
}

function detectCategory(r: Raw): CategoryCode {
  if (r.category) {
    const up = r.category.toUpperCase();
    if (["VEGETABLES","FRUITS","EGGS","DAIRY"].includes(up)) return up as CategoryCode;
  }
  const n = r.name.toLowerCase();
  if (/\begg/.test(n)) return "EGGS";
  if (/(milk|cheese|yogurt|labneh|dairy)/.test(n)) return "DAIRY";
  if (/(apple|banana|orange|lemon|strawber|grape|pear|peach|mango|melon|avocado|fruit)/.test(n)) return "FRUITS";
  return "VEGETABLES";
}

export function adaptToMarketItems(data: Raw[], opts: AdaptOpts = {}): MarketItem[] {
  return data
    .filter((r) => typeof r.count === "number")
    .map((r, i) => {
      const stock = Math.max(0, Number(r.count ?? 0));
      const parsed = parseCompositeId(r.id);
      const lc = parsed?.lc ?? opts.logisticCenterId ?? "LC1";
      const shift = parsed?.shift ?? opts.shift ?? "MORNING";

      // product/catalog id (stable per product across centers/shifts)
      const sku = parsed?.sku ?? r.sku ?? r.id ?? `item-${i}`;

      const farmerName = r.farmer?.name ?? "Unknown";
      const farmer: FarmerInfo = {
        _id: r.farmer?.id ?? `farmer-${i}`,
        name: farmerName,
        farmName: r.farmer?.farmName ?? r.farmName ?? `${farmerName} Farm`,
      };

      const inventoryId =
        parsed?.lc && parsed?.shift && parsed?.sku
          ? (r.id as string) // already composite in data
          : `${lc}-${fullToShort[shift]}-${sku}`;

      return {
        _id: sku,                        // catalog/product id
        inventoryId,                     // LC-SHIFT-SKU
        name: r.name,
        price: Number(r.price ?? 0),
        stock: stock,
        inStock: stock,
        imageUrl: r.imageUrl ?? r.image ?? PLACEHOLDER,
        farmer,
        category: detectCategory(r),
      };
    });
}
