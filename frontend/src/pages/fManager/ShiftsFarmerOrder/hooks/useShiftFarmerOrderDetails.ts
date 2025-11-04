// src/pages/ShiftFarmerOrder/hooks/useShiftFarmerOrderDetails.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult, QueryKey } from "@tanstack/react-query";

/* ------------------------------- Types ---------------------------------- */

export type AuditEvent = {
  action: string;
  note?: string;
  by: string | { id: string; name?: string; role?: string };
  at: string | Date;
  timestamp?: string | Date;
  meta?: Record<string, any>;
};

export type UseShiftFarmerOrderDetailsOptions = {
  /** Seed data from the row (fast-path) while wiring real fetching later. */
  initialAudit?: AuditEvent[];
  /**
   * Optional fetcher to load audit by orderId.
   * Example:
   *   async (id) => (await api.get(`/farmer-orders/${id}/audit`)).data
   */
  fetcher?: (orderId: string) => Promise<AuditEvent[]>;
  /** Customize the query key if needed (default below). */
  queryKey?: (orderId: string) => QueryKey;
};

export type UseShiftFarmerOrderDetailsResult = {
  audit: AuditEvent[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: UseQueryResult<AuditEvent[]>["refetch"];
  /** Expose key for external invalidation if needed later. */
  key: QueryKey | undefined;
};

/* ------------------------------- Hook ----------------------------------- */

/**
 * Reads-only details for a single Farmer Order (Audit for v1).
 * - If no fetcher is provided, returns initialAudit and stays idle (no network).
 * - When fetcher is provided, it will fetch (enabled when orderId is truthy).
 */
export function useShiftFarmerOrderDetails(
  orderId: string | undefined,
  opts: UseShiftFarmerOrderDetailsOptions = {}
): UseShiftFarmerOrderDetailsResult {
  const {
    initialAudit,
    fetcher,
    queryKey = (id: string) => ["farmerOrders", "details", "audit", id],
  } = opts;

  const key = useMemo(
    () => (orderId ? queryKey(orderId) : undefined),
    [orderId, queryKey]
  );
  const enabled = Boolean(orderId && fetcher);

  const q = useQuery<AuditEvent[]>({
    queryKey: key,
    queryFn: async () => {
      if (!orderId) return initialAudit ?? [];
      if (!fetcher) return initialAudit ?? [];
      const data = await fetcher(orderId);
      return Array.isArray(data) ? data : [];
    },
    enabled,
    // Tune later as needed:
    staleTime: 60_000, // 1 min
    gcTime: 5 * 60_000, // 5 min
    initialData: initialAudit,
  });

  const audit = q.data ?? initialAudit;

  return {
    audit,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    isError: q.isError ?? false,
    refetch: q.refetch,
    key,
  };
}
