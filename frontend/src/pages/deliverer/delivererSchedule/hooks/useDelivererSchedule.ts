// src/pages/deliverer/schedule/hooks/useDelivererSchedule.ts

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getMySchedule,
  type GetMyScheduleParams,
  type GetMyScheduleResponse,
  type MonthString,
  type ScheduleBitmap,
} from "@/api/schedule";
import { useToday } from "@/hooks/useToday";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type UseDelivererScheduleResult = {
  /** Numeric year for the current month (e.g. 2025). */
  year: number;
  /** Numeric month for the current month (1–12). */
  month: number;
  /** "YYYY-MM" key used for API calls. */
  monthKey: MonthString;

  /** Raw response from GET /schedule/my?month=YYYY-MM (may be undefined while loading). */
  data: GetMyScheduleResponse | undefined;

  /** Active schedule bitmap for the month (one integer per day, 0–15). */
  activeBitmap: ScheduleBitmap;
  /** Standby schedule bitmap for the month (one integer per day, 0–15). */
  standByBitmap: ScheduleBitmap;

  /** React Query status flags. */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;

  /** Convenience: whether we have any non-zero bits in either bitmap. */
  hasAnyShifts: boolean;

  /** Trigger a refetch from the API. */
  refetch: () => void;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/**
 * Format a (year, month) pair to "YYYY-MM".
 * Month is 1-based (1–12).
 */
function toMonthString(year: number, month: number): MonthString {
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}`;
}

/**
 * Quick utility to check if a bitmap has at least one non-zero entry.
 */
function hasAnyBits(bitmap: ScheduleBitmap | undefined): boolean {
  if (!bitmap || bitmap.length === 0) return false;
  return bitmap.some((v) => v > 0);
}

/* -------------------------------------------------------------------------- */
/*                           useDelivererSchedule hook                        */
/* -------------------------------------------------------------------------- */

/**
 * Hook for the deliverer "My Schedule" page.
 *
 * - Anchors to the **current calendar month** (no month flipping here).
 * - Calls GET /schedule/my?month=YYYY-MM via `getMySchedule`.
 * - Exposes active + standby bitmaps and basic query state.
 */
export function useDelivererSchedule(): UseDelivererScheduleResult {
  // Always work off "today" according to the app's time utilities.
  const today = useToday();

  const { year, month, monthKey } = useMemo(() => {
    const y = today.getFullYear();
    const m = today.getMonth() + 1; // JS Date month is 0-based
    const key = toMonthString(y, m);
    return { year: y, month: m, monthKey: key };
  }, [today]);

  const params: GetMyScheduleParams = { month: monthKey };

  const { data, isLoading, isFetching, isError, error, refetch } =
    useQuery<GetMyScheduleResponse>({
      queryKey: ["schedule", "my", monthKey],
      queryFn: () => getMySchedule(params),
      // You can tweak these if needed once we see real UX:
      // staleTime: 5 * 60 * 1000,
      // cacheTime: 15 * 60 * 1000,
    });

  const activeBitmap: ScheduleBitmap = data?.active ?? [];
  const standByBitmap: ScheduleBitmap = data?.standBy ?? [];

  const hasAnyShifts = hasAnyBits(activeBitmap) || hasAnyBits(standByBitmap);

  return {
    year,
    month,
    monthKey,
    data,
    activeBitmap,
    standByBitmap,
    isLoading,
    isFetching,
    isError,
    error,
    hasAnyShifts,
    refetch,
  };
}
