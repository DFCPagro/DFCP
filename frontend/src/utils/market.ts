// src/utils/market.ts
import type { MarketItem } from "@/types/market";

type ByFarmerOptions = {
  excludeStockId?: string;  // avoid the currently-open line
  excludeItemId?: string;   // avoid same itemId if you want
  limit?: number;           // cap result length
  distinctBy?: "stockId" | "itemId"; // dedupe key
};

function uniqBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const x of arr) {
    const k = key(x);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/**
 * Select items that belong to the same farmer.
 * - Optional: exclude the current stockId / itemId
 * - Optional: dedupe (by stockId or itemId)
 * - Optional: limit results
 */
export function selectItemsByFarmer(
  items: MarketItem[],
  farmerId: string,
  opts: ByFarmerOptions = {}
): MarketItem[] {
  if (!Array.isArray(items) || !farmerId) return [];

  const {
    excludeStockId,
    excludeItemId,
    limit = 20,
    distinctBy = "stockId",
  } = opts;

  let result = items.filter((it: any) => it?.farmerId === farmerId);

  if (excludeStockId) result = result.filter((it: any) => it.stockId !== excludeStockId);
  if (excludeItemId)  result = result.filter((it: any) => it.itemId  !== excludeItemId);

  // Dedupe
  result = uniqBy(
    result,
    (it: any) => (distinctBy === "itemId" ? it.itemId : it.stockId) || JSON.stringify(it)
  );

  // Optional: stable sort (by name then itemId) so it doesn’t jump
  result.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "") || (a.itemId || "").localeCompare(b.itemId || ""));

  return result.slice(0, Math.max(0, limit));
}
