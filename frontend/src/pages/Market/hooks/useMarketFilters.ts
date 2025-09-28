import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

/** Sort options used in the Market page */
export type SortKey =
  | "relevance"
  | "priceAsc"
  | "priceDesc"
  | "nameAsc"
  | "nameDesc";

/** Options for initializing and configuring the hook */
export type UseMarketFiltersOptions = {
  /** Initial category code (string). If you have a stricter type elsewhere, it will still accept string unions. */
  initialCategory?: string | null;
  /** Initial search text (not debounced) */
  initialSearch?: string;
  /** Initial sort key (default: "relevance") */
  initialSort?: SortKey;
  /** Initial page number (1-based; default: 1) */
  initialPage?: number;
  /** Page size for pagination (default: 16) */
  pageSize?: number;
  /**
   * If true, we read from and write to the URL query params (cat, q, sort, page).
   * Default: true (because it’s useful for shareable/filterable URLs).
   */
  syncToURL?: boolean;
  /** Debounce delay for search, in ms (default: 250) */
  searchDebounceMs?: number;
};

/** Return type */
export type UseMarketFilters = {
  // state
  category: string | null;
  search: string;
  debouncedSearch: string;
  sort: SortKey;
  page: number; // 1-based
  pageSize: number;

  // setters
  setCategory: (cat: string | null) => void;
  setSearch: (text: string) => void;
  /** For programmatic immediate updates that should NOT debounce */
  setSearchImmediate: (text: string) => void;
  setSort: (key: SortKey) => void;
  setPage: (p: number) => void;

  // helpers
  resetFilters: () => void;
  /** A stable string suitable as a memo key for filtered queries */
  filtersKey: string;
  /** Export filters as a plain object (handy for API params if needed) */
  toQuery: () => { cat?: string; q?: string; sort?: SortKey; page?: number; limit?: number };
};

/* ------------------------- tiny debounce utility ------------------------- */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/* ------------------------------- main hook ------------------------------- */
export function useMarketFilters({
  initialCategory = null,
  initialSearch = "",
  initialSort = "relevance",
  initialPage = 1,
  pageSize: pageSizeOpt = 16,
  syncToURL = true,
  searchDebounceMs = 250,
}: UseMarketFiltersOptions = {}): UseMarketFilters {
  const [searchParams, setSearchParams] = useSearchParams();

  // --- initialize from URL (if enabled) ---
  const urlInit = useRef<boolean>(false);
  const readURL = useCallback(() => {
    if (!syncToURL) return {
      category: initialCategory,
      search: initialSearch,
      sort: initialSort as SortKey,
      page: initialPage,
    };
    const cat = searchParams.get("cat");
    const q = searchParams.get("q");
    const sortParam = (searchParams.get("sort") as SortKey | null) ?? undefined;
    const pageParam = parseInt(searchParams.get("page") ?? "", 10);
    return {
      category: (cat ?? initialCategory) || null,
      search: q ?? initialSearch,
      sort: (sortParam && isValidSort(sortParam) ? sortParam : initialSort) as SortKey,
      page: Number.isFinite(pageParam) && pageParam > 0 ? pageParam : initialPage,
    };
  }, [initialCategory, initialPage, initialSearch, initialSort, searchParams, syncToURL]);

  const [{ category, search, sort, page }, setState] = useState(() => readURL());
  const pageSize = pageSizeOpt;

  // hydrate from URL exactly once
  useEffect(() => {
    if (urlInit.current) return;
    urlInit.current = true;
    setState(readURL());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounced search value (for expensive operations)
  const debouncedSearch = useDebouncedValue(search, searchDebounceMs);

  // --- setters (reset page to 1 on most filter changes) ---
  const setCategory = useCallback((cat: string | null) => {
    setState((s) => ({ ...s, category: cat, page: 1 }));
  }, []);

  const setSearchImmediate = useCallback((text: string) => {
    setState((s) => ({ ...s, search: text, page: 1 }));
  }, []);

  const setSearch = useCallback((text: string) => {
    // keep API the same; we just route to immediate setter
    setSearchImmediate(text);
  }, [setSearchImmediate]);

  const setSort = useCallback((key: SortKey) => {
    setState((s) => ({ ...s, sort: isValidSort(key) ? key : s.sort, page: 1 }));
  }, []);

  const setPage = useCallback((p: number) => {
    setState((s) => ({ ...s, page: Math.max(1, Math.floor(p || 1)) }));
  }, []);

  const resetFilters = useCallback(() => {
    setState({
      category: initialCategory,
      search: initialSearch,
      sort: initialSort,
      page: 1,
    });
  }, [initialCategory, initialSearch, initialSort]);

  // --- write changes to URL (if enabled) ---
  useEffect(() => {
    if (!syncToURL) return;
    const params = new URLSearchParams(searchParams);
    // cat
    if (category) params.set("cat", category);
    else params.delete("cat");
    // q
    if (search) params.set("q", search);
    else params.delete("q");
    // sort
    params.set("sort", sort);
    // page
    params.set("page", String(page));

    // Only update if changed (avoid re-renders/loop)
    const next = params.toString();
    const curr = searchParams.toString();
    if (next !== curr) setSearchParams(params, { replace: true });
  }, [category, search, sort, page, searchParams, setSearchParams, syncToURL]);

  // memo helpers
  const filtersKey = useMemo(
    () => JSON.stringify({ category, q: debouncedSearch, sort, page, limit: pageSize }),
    [category, debouncedSearch, sort, page, pageSize]
  );

  const toQuery = useCallback(() => {
    const q: { cat?: string; q?: string; sort?: SortKey; page?: number; limit?: number } = {};
    if (category) q.cat = category;
    if (search) q.q = search;
    if (sort) q.sort = sort;
    if (page > 1) q.page = page;
    if (pageSize) q.limit = pageSize;
    return q;
  }, [category, search, sort, page, pageSize]);

  return {
    category,
    search,
    debouncedSearch,
    sort,
    page,
    pageSize,
    setCategory,
    setSearch,
    setSearchImmediate,
    setSort,
    setPage,
    resetFilters,
    filtersKey,
    toQuery,
  };
}

/* ------------------------------- internals ------------------------------- */
function isValidSort(v: string): v is SortKey {
  return v === "relevance" || v === "priceAsc" || v === "priceDesc" || v === "nameAsc" || v === "nameDesc";
}
