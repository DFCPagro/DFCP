// src/pages/CreateStock/hooks/useFarmerInventory.ts
// Fetches the farmer inventory rows (no AMS context needed).
// v2: uses real API; ignores pagination by product decision.
// Also exposes a callable function to fetch demand statistics on demand.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FarmerInventoryItem,
  DemandStatisticsResponse,
} from "@/types/farmerInventory";
import { getFarmerInventory, getDemandStatistics } from "@/api/farmerInventory";

export type AsyncStatus = "idle" | "loading" | "success" | "error";

/* -----------------------------------------------------------------------------
 * Hook
 * ---------------------------------------------------------------------------*/

export function useFarmerInventory(opts?: { auto?: boolean }) {
  const auto = opts?.auto ?? true;

  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [items, setItems] = useState<FarmerInventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const fetchAll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus("loading");
    setError(null);

    try {
      // console.log("Fetching farmer inventory...");
      const resp = await getFarmerInventory();
      console.log("Fetched farmer inventory:", resp);
      const rows = resp.data ?? [];

      if (!mountedRef.current) return;
      setItems(rows); // ignore pagination by product decision
      setStatus("success");
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message ?? "Failed to load inventory");
      setStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  // Lifecycle: mount/unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (!auto) return;
    void fetchAll();
  }, [auto, fetchAll]);

  // Expose a callable function the page can use to fetch demand statistics.
  // Returns the parsed API response as-is; no local state.
  const fetchDemandStatistics = useCallback(
    async (params?: {
      page?: number;
      limit?: number;
      slotKey?: string;
    }): Promise<DemandStatisticsResponse> => {
      return await getDemandStatistics(params);
    },
    []
  );

  const meta = useMemo(
    () => ({
      total: items.length,
      // Placeholder for future sort/filter metadata.
    }),
    [items.length]
  );

  return {
    status, // "idle" | "loading" | "success" | "error"
    items, // Flattened list (ignores pagination)
    error, // string | null
    refetch, // () => Promise<void>
    meta, // { total }
    isEmpty: status === "success" && items.length === 0,
    hasData: status === "success" && items.length > 0,

    // New: on-demand statistics fetcher (page calls this when needed)
    fetchDemandStatistics, // (params?) => Promise<DemandStatisticsResponse>
  } as const;
}
