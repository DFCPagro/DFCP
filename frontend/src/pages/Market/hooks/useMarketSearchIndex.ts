import { useMemo } from "react";
import type { MarketItem } from "@/types/market";

/** What shows in the search dropdown */
export type SearchSuggestion =
  | {
      kind: "item";
      /** unique key for this suggestion (we use item name for item-kind) */
      key: string;
      label: string;            // visible label (item name)
      secondary?: string;       // optional subtitle (e.g., category)
      /** All itemIds sharing this display name (for filtering on click) */
      itemIds: string[];
    }
  | {
      kind: "farmer";
      /** unique key for this suggestion (farmerId) */
      key: string;
      label: string;            // visible label (farmer name)
      secondary?: string;       // optional subtitle (e.g., farm name)
      /** All farmerIds for this name (usually one) */
      farmerIds: string[];
    };

export type UseMarketSearchIndexOptions = {
  items: MarketItem[];
  /** Input text to search (use debounced text from useMarketFilters for smooth UX) */
  text: string;
  /** Max suggestions to return (default: 8) */
  maxSuggestions?: number;
};

/**
 * Build a simple index from MarketItem[] and produce ranked suggestions and a filter.
 * - Suggests unique item names and unique farmers.
 * - Ranking: exact-prefix > word-prefix > substring; longer matches tie-break by label length and alpha.
 * - Filter matches item name OR farmer name (case-insensitive).
 */
export function useMarketSearchIndex({
  items,
  text,
  maxSuggestions = 8,
}: UseMarketSearchIndexOptions) {
  // Normalize and pre-index items (unique item names, unique farmers)
  const { itemNameIndex, farmerIndex } = useMemo(() => {
    const itemNameIndex = new Map<
      string, // lowercased item display name
      { label: string; category?: string; itemIds: string[] }
    >();

    const farmerIndex = new Map<
      string, // lowercased farmer name
      { label: string; farmerIds: string[]; farmName?: string }
    >();

    for (const it of items) {
      // ---- Item names
      const itemKey = (it.name ?? "").trim();
      if (itemKey) {
        const k = itemKey.toLowerCase();
        const rec = itemNameIndex.get(k);
        if (rec) {
          if (!rec.itemIds.includes(it.itemId)) rec.itemIds.push(it.itemId);
        } else {
          itemNameIndex.set(k, {
            label: itemKey,
            category: it.category,
            itemIds: [it.itemId],
          });
        }
      }

      // ---- Farmers
      const farmerKey = (it.farmerName ?? "").trim();
      if (farmerKey) {
        const k = farmerKey.toLowerCase();
        const rec = farmerIndex.get(k);
        if (rec) {
          if (!rec.farmerIds.includes(it.farmerId)) rec.farmerIds.push(it.farmerId);
        } else {
          farmerIndex.set(k, {
            label: farmerKey,
            farmerIds: [it.farmerId],
            farmName: it.farmName,
          });
        }
      }
    }

    return { itemNameIndex, farmerIndex };
  }, [items]);

  // Compute suggestions for current text
  const suggestions: SearchSuggestion[] = useMemo(() => {
    const q = (text ?? "").trim().toLowerCase();
    if (!q) return [];

    // Scoring helper
    const score = (candidate: string) => {
      // exact prefix -> highest; word prefix -> mid; substring -> low
      if (candidate.startsWith(q)) return 100 - (candidate.length - q.length);
      // word-prefix: " q" inside words
      if (candidate.includes(` ${q}`)) return 70 - candidate.indexOf(` ${q}`);
      // substring anywhere
      const idx = candidate.indexOf(q);
      if (idx >= 0) return 40 - idx;
      return -1e9; // not matched
    };

    const pool: Array<{ s: SearchSuggestion; rank: number }> = [];

    // Items
    for (const [k, rec] of itemNameIndex) {
      const r = score(k);
      if (r > -1e8) {
        pool.push({
          s: {
            kind: "item",
            key: rec.label, // use human label to keep uniqueness by name
            label: rec.label,
            secondary: rec.category,
            itemIds: rec.itemIds,
          },
          rank: r,
        });
      }
    }

    // Farmers
    for (const [k, rec] of farmerIndex) {
      const r = score(k);
      if (r > -1e8) {
        pool.push({
          s: {
            kind: "farmer",
            key: rec.label, // label is unique enough; if not, we could use rec.farmerIds[0]
            label: rec.label,
            secondary: rec.farmName,
            farmerIds: rec.farmerIds,
          },
          rank: r,
        });
      }
    }

    // Sort by rank desc, then label length asc, then alpha
    pool.sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      if (a.s.label.length !== b.s.label.length) return a.s.label.length - b.s.label.length;
      return a.s.label.localeCompare(b.s.label);
    });

    // De-dup by (kind,key) to be safe
    const seen = new Set<string>();
    const out: SearchSuggestion[] = [];
    for (const p of pool) {
      const key = `${p.s.kind}:${p.s.key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p.s);
      if (out.length >= maxSuggestions) break;
    }
    return out;
  }, [text, itemNameIndex, farmerIndex, maxSuggestions]);

  // Filter predicate for grid (matches on item name OR farmer name)
  const matchFilter = useMemo(() => {
    const q = (text ?? "").trim().toLowerCase();
    if (!q) return () => true;
    return (it: MarketItem) => {
      const name = (it.name ?? "").toLowerCase();
      const farmer = (it.farmerName ?? "").toLowerCase();
      return name.includes(q) || farmer.includes(q);
    };
  }, [text]);

  return { suggestions, matchFilter };
}
