// src/pages/ShiftFarmerOrder/hooks/useShiftFarmerOrders.ts
// Hook: useShiftFarmerOrders
// - Reads ?date & ?shift from URL (react-router-dom)
// - Validates the params (light runtime guard for shift)
// - Calls GET /api/farmer-orders/by-shift via api client
// - Computes ok/pending/problem counts client-side
// - Exposes stable shape for page/components
//
// Dependencies: React Router v6+, TanStack Query v5

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  getFarmerOrdersByShift,
  qkFarmerOrdersByShift,
} from "@/api/farmerOrders";
import type {
  ShiftFarmerOrdersQuery,
  ShiftFarmerOrdersResponse,
  ShiftFarmerOrderItem,
} from "@/types/farmerOrders";

// ---- local helpers ----
const ALLOWED_SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
type AllowedShift = (typeof ALLOWED_SHIFTS)[number];

function isValidShift(s: string | null): s is AllowedShift {
  return !!s && (ALLOWED_SHIFTS as readonly string[]).includes(s);
}

function computeCounts(items: ShiftFarmerOrderItem[]) {
  let ok = 0,
    pending = 0,
    problem = 0;
  for (const it of items) {
    if (it.farmerStatus === "ok") ok++;
    else if (it.farmerStatus === "pending") pending++;
    else if (it.farmerStatus === "problem") problem++;
  }
  return { ok, pending, problem, total: items.length };
}

// ---- hook ----
export function useShiftFarmerOrders() {
  const [sp] = useSearchParams();

  const date = sp.get("date"); // YYYY-MM-DD (required)
  const shift = sp.get("shift"); // morning|afternoon|evening|night (required)

  const paramsValid = Boolean(date && isValidShift(shift));
  const paramError = useMemo(() => {
    if (date && isValidShift(shift)) return undefined;
    if (!date && !shift)
      return "Missing required URL parameters: date and shift.";
    if (!date) return "Missing required URL parameter: date.";
    if (!isValidShift(shift))
      return "Invalid shift. Expected one of: morning, afternoon, evening, night.";
    return undefined;
  }, [date, shift]);

  const queryParams: ShiftFarmerOrdersQuery | null = useMemo(() => {
    if (!paramsValid) return null;
    return {
      date: date!, // guarded by paramsValid
      shiftName: shift as AllowedShift,
      // v1: fetch everything (server may ignore page/limit)
    };
  }, [date, shift, paramsValid]);

  const query = useQuery<ShiftFarmerOrdersResponse>({
    enabled: !!queryParams,
    queryKey: queryParams
      ? qkFarmerOrdersByShift(queryParams)
      : ["farmerOrders", "byShift", "invalid"],
    queryFn: ({ signal }) =>
      getFarmerOrdersByShift(queryParams as ShiftFarmerOrdersQuery, { signal }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const items = query.data?.items ?? [];
  const counts = useMemo(() => computeCounts(items), [items]);

  return {
    // URL-derived params
    date: date ?? "",
    shiftName: (shift as AllowedShift | "") ?? "",
    paramsValid,
    paramError,

    // data
    items,
    meta: query.data?.meta,
    counts, // { ok, pending, problem, total }

    // query state
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export type UseShiftFarmerOrdersReturn = ReturnType<
  typeof useShiftFarmerOrders
>;
