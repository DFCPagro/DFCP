// src/pages/FarmerManager/FarmerList/hooks/useItemsMap.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listItems } from "@/api/items";

/**
 * Props for the hook. You can bump `limit` if your catalog grows.
 */
export type UseItemsMapProps = {
  enabled?: boolean;
  page?: number; // default 1
  limit?: number; // default 500 (so we fetch most catalogs in one go)
  // You can add other ListQuery params here as your /items supports them
};

/**
 * Shape of the returned helpers and state.
 */
export type UseItemsMapResult = {
  /** Raw items array as returned by /items (data.items). */
  items: Array<{ _id: string; name: string; icon?: string | null }> | [];

  /** Map of itemId → { name, icon } for O(1) lookups in UI. */
  map: Record<string, { name: string; icon?: string | null }>;

  /** Quick helpers for components. */
  getName: (id?: string | null) => string;
  getIcon: (id?: string | null) => string | undefined | null;
  has: (id?: string | null) => boolean;

  /** React Query state */
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Fetches items and builds a handy id→name/icon map for the Farmer Details dialog.
 * Uses the real `listItems(params)` API you provided.
 */
export function useItemsMap({
  enabled = true,
  page = 1,
  limit = 500,
}: UseItemsMapProps = {}): UseItemsMapResult {
  const query = useQuery({
    queryKey: ["items", "map", { page, limit }],
    queryFn: async ({ signal }) => {
      // Your listItems already types the response; we just pass params.
      // If your API supports a `signal`, you can thread it via axios config in api/items.ts.
      const res = await listItems({ page, limit } as any);
      return res;
    },
    enabled,
    retry: 1,
    staleTime: 5 * 60_000, // items catalog changes rarely
    gcTime: 10 * 60_000,
    placeholderData: (prev) => prev,
  });

  const items =
    (query.data as any)?.items?.map((it: any) => ({
      _id: String(it._id),
      name: String(it.name ?? ""),
      icon: it.icon ?? undefined,
    })) ?? [];

  const map = useMemo(() => {
    const acc: Record<string, { name: string; icon?: string | null }> = {};
    for (const it of items) {
      if (!it?._id) continue;
      acc[it._id] = { name: it.name, icon: it.icon };
    }
    return acc;
  }, [items]);

  /** Helpers for components */
  const getName = (id?: string | null) => {
    if (!id) return "";
    return map[id]?.name ?? id; // fallback to id to avoid blank labels
  };

  const getIcon = (id?: string | null) => {
    if (!id) return undefined;
    return map[id]?.icon;
  };

  const has = (id?: string | null) => Boolean(id && map[id]);

  return {
    items,
    map,
    getName,
    getIcon,
    has,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
  };
}
