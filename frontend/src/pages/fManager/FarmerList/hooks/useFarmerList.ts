// src/pages/FarmerManager/FarmerList/hooks/useFarmerList.ts
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listFarmers,
  qkFarmersList,
  type ListFarmersParams,
} from "@/api/farmer";
import type { FarmerListItem, FarmerListResponse } from "@/types/farmer";

/**
 * Local debouncer (kept inside this file to avoid shared utils)
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export type UseFarmerListProps = {
  /** Free-text search by farmer/farm name (BE should handle). */
  search?: string;
  /** Sort string, e.g. "-createdAt" (default) or "farmName". */
  sort?: string;
  /** 1-based page number. */
  page?: number;
  /** Page size. */
  limit?: number;
  /** Disable the query (e.g. until route params are parsed). */
  enabled?: boolean;
  /** Debounce search input in ms (0 = no debounce). */
  debounceMs?: number;
};

export type UseFarmerListResult = {
  /** Raw API response for advanced needs. */
  response?: FarmerListResponse;
  /** Rows to render. */
  items: FarmerListItem[];
  /** 1-based page index returned by the server. */
  page: number;
  /** Page size returned by the server. */
  limit: number;
  /** Total items across all pages. */
  total: number;
  /** Total number of pages. */
  pages: number;

  /** React Query state */
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Fetches the farmer list for the Farmer Manager → Farmer List page.
 * - Uses server-side filtering by LC via token (handled by backend).
 * - Keeps previous data while paginating for smoother UX.
 * - Optional debounce for the `search` input.
 */
export function useFarmerList({
  search = "",
  sort = "-createdAt",
  page = 1,
  limit = 20,
  enabled = true,
  debounceMs = 200,
}: UseFarmerListProps = {}): UseFarmerListResult {
  const debouncedSearch =
    debounceMs > 0 ? useDebouncedValue(search, debounceMs) : search;

  // Build params once (stable reference for query key & fn)
  const params: ListFarmersParams = useMemo(
    () => ({ search: debouncedSearch || undefined, sort, page, limit }),
    [debouncedSearch, sort, page, limit]
  );

  const query = useQuery({
    queryKey: qkFarmersList(params),
    // React Query v5 passes an AbortSignal on ctx.signal
    queryFn: ({ signal }) => listFarmers(params, { signal }),
    enabled,
    // good UX for paginated lists
    placeholderData: (prev) => prev,
    retry: 1, // be gentle; surface errors fast
    staleTime: 60_000, // 1 min is fine for this admin-ish data
    gcTime: 5 * 60_000,
  });

  const response = query.data;
  const items = response?.items ?? [];
  const currentPage = response?.page ?? page ?? 1;
  const currentLimit = response?.limit ?? limit ?? 20;
  const total = response?.total ?? 0;
  const pages =
    response?.pages ?? (Math.ceil(total / (currentLimit || 1)) || 1);

  return {
    response,
    items,
    page: currentPage,
    limit: currentLimit,
    total,
    pages,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
  };
}
