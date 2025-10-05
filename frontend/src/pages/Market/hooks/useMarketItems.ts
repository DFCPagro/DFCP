import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFlatItemsByMarketStockId } from "@/api/market";
import type { SortKey } from "./useMarketFilters";
import type { MarketItem } from "@/types/market";

export type UseMarketItemsOptions = {
  /** When null, fetching is disabled (inactive market) */
  marketStockId: string | null;

  /** Gate network calls (default: true when marketStockId is truthy) */
  enabled?: boolean;

  /** Current filters from useMarketFilters (all optional to keep this hook flexible) */
  category?: string | null;
  /** A debounced search *string* OR an external predicate via `matchFilter` */
  debouncedSearch?: string;

  /** Optional external predicate built by useMarketSearchIndex (preferred) */
  matchFilter?: (it: MarketItem) => boolean;

  /** Sort key (default: "relevance" = server/native order) */
  sort?: SortKey;

  /** Paging config */
  page?: number;        // 1-based
  pageSize?: number;    // default 16

  /** If provided, called when a fresh fetch completes */
  onFetched?: (items: MarketItem[]) => void;
};

export type UseMarketItems = {
  // Raw data
  allItems: MarketItem[];
  isLoading: boolean;   // first load
  isFetching: boolean;  // subsequent refetches
  error: string | null;

  // Derived lists
  filteredItems: MarketItem[];
  pageItems: MarketItem[];

  // Paging
  page: number;
  totalItems: number;
  totalPages: number;
  setPage: (p: number) => void;

  // Actions
  refetch: () => Promise<void>;
};

/* ----------------------------- Price extractor ---------------------------- */
/**
 * Your MarketItem type may name the price field differently in places.
 * We try a few common keys and coerce to number safely without TS errors.
 */
function getUnitPriceUSD(it: MarketItem): number {
  const n = Number(it.pricePerUnit);
  return Number.isFinite(n) ? n : 0;
}


/* ------------------------------ Name helpers ------------------------------ */
function norm(s: string | undefined | null) {
  return (s ?? "").trim().toLowerCase();
}

/* --------------------------------- Hook ---------------------------------- */
export function useMarketItems({
  marketStockId,
  enabled,
  category = null,
  debouncedSearch = "",
  matchFilter,
  sort = "relevance",
  page = 1,
  pageSize = 16,
  onFetched,
}: UseMarketItemsOptions): UseMarketItems {
  const shouldFetch = enabled ?? !!marketStockId;

  const [allItems, setAllItems] = useState<MarketItem[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [isFetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currPage, setCurrPage] = useState<number>(Math.max(1, Math.floor(page)));

  // keep page in sync with external `page` prop
  useEffect(() => {
    setCurrPage(Math.max(1, Math.floor(page || 1)));
  }, [page]);

  // request in-flight guard
  const reqIdRef = useRef(0);

  const fetchItems = useCallback(async () => {
    if (!shouldFetch || !marketStockId) {
      setAllItems([]);
      setError(null);
      return;
    }
    const reqId = ++reqIdRef.current;

    // show loading only if first time; otherwise show isFetching
    setError(null);
    setFetching(true);
    if (allItems.length === 0) setLoading(true);

    try {
      const arr = await getFlatItemsByMarketStockId(marketStockId);
      if (reqId !== reqIdRef.current) return;

      setAllItems(arr);
      onFetched?.(arr);

    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      setError(e?.message ?? "Failed to load market items");
      setAllItems([]);
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, [shouldFetch, marketStockId, allItems.length, onFetched]);

  // initial + when marketStockId changes
  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketStockId, shouldFetch]);

  // public refetch
  const refetch = useCallback(async () => {
    await fetchItems();
  }, [fetchItems]);

  /* ----------------------------- Local filtering ----------------------------- */

  const filteredItems = useMemo(() => {
    let arr = allItems;

    // Category filter (string equality on your item.category)
    if (category) {
      const cat = norm(category);
      arr = arr.filter((it) => norm(it.category) === cat);
    }

    // Search: prefer external predicate (from useMarketSearchIndex),
    // otherwise do a basic name/farmer includes match.
    if (matchFilter) {
      arr = arr.filter(matchFilter);
    } else {
      const q = norm(debouncedSearch);
      if (q) {
        arr = arr.filter((it) => {
          const name = norm(it.name);
          const farmer = norm(it.farmerName);
          return name.includes(q) || farmer.includes(q);
        });
      }
    }

    // Sort
    switch (sort) {
      case "priceAsc":
        arr = [...arr].sort((a, b) => getUnitPriceUSD(a) - getUnitPriceUSD(b));
        break;
      case "priceDesc":
        arr = [...arr].sort((a, b) => getUnitPriceUSD(b) - getUnitPriceUSD(a));
        break;
      case "nameAsc":
        arr = [...arr].sort((a, b) =>
          String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
            sensitivity: "base",
          })
        );
        break;
      case "nameDesc":
        arr = [...arr].sort((a, b) =>
          String(b.name ?? "").localeCompare(String(a.name ?? ""), undefined, {
            sensitivity: "base",
          })
        );
        break;
      case "relevance":
      default:
        // keep server/native order (no-op)
        break;
    }

    return arr;
  }, [allItems, category, debouncedSearch, matchFilter, sort]);

  /* -------------------------------- Pagination ------------------------------- */

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currPage), totalPages);

  // If filters reduce the list and current page becomes out of range,
  // snap back to last valid page.
  useEffect(() => {
    if (currPage !== safePage) setCurrPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return filteredItems.slice(start, end);
  }, [filteredItems, safePage, pageSize]);

  const setPage = useCallback((p: number) => {
    setCurrPage(Math.max(1, Math.floor(p || 1)));
    // caller may also update URL via useMarketFilters.setPage
  }, []);

  return {
    allItems,
    isLoading,
    isFetching,
    error,
    filteredItems,
    pageItems,
    page: safePage,
    totalItems,
    totalPages,
    setPage,
    refetch,
  };
}
