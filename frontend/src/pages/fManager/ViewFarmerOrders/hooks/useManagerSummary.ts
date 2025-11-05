// src/pages/Dashboard/hooks/useManagerSummary.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFarmerOrdersSummary } from "@/api/farmerOrders";
import type {
  FarmerOrdersSummaryResponse,
  ShiftRollup,
} from "@/types/farmerOrders";

/**
 * UI helper: a shift is "missing" when there are NO farmer orders at all for that (date, shift).
 * Backend definition given by you: count === 0
 */
export function isShiftMissing(row: ShiftRollup | undefined | null): boolean {
  return !!row && row.count === 0;
}

export type UseManagerSummaryResult = {
  /** Raw server payload (or sensible empty defaults while loading). */
  data: FarmerOrdersSummaryResponse | null;

  /** The "current" shift (may exist with count===0). */
  current: ShiftRollup | null;

  /** Upcoming shifts array. */
  next: ShiftRollup[];

  /** Time zone / LC echoed by the backend (optional for UI). */
  tz: string | null;
  lc: string | null;

  /** React Query state */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
};

export function useManagerSummary(): UseManagerSummaryResult {
  const query = useQuery({
    queryKey: ["farmerOrders", "summary"],
    queryFn: getFarmerOrdersSummary,
    staleTime: 30_000, // cache briefly; summary changes within minutes, not seconds
  });

  const data = query.data ?? null;

  const current = data?.current ?? null;
  const next = data?.next ?? [];

  return {
    data,
    current,
    next,
    tz: data?.tz ?? null,
    lc: data?.lc ?? null,

    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: !!query.error,
    error: query.error ?? null,
    refetch: query.refetch as unknown as () => Promise<unknown>,
  };
}
