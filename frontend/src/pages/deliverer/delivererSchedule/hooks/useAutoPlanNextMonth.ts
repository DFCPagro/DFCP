// src/pages/deliverer/schedule/hooks/useAutoPlanNextMonth.ts

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/config";
import {
  getMySchedule,
  type GetMyScheduleResponse,
  type MonthString,
  type ScheduleBitmap,
} from "@/api/schedule";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type UseAutoPlanArgs = {
  /** Current (visible) month key in "YYYY-MM" format. Usually today's month. */
  monthKey: MonthString;
};

export type UseAutoPlanResult = {
  /** The computed target month ("next month") key in "YYYY-MM". */
  nextMonthKey: MonthString;

  /** Whether next month can be auto-planned (i.e., not already present/non-empty). */
  canPlanNextMonth: boolean;

  /** Loading states for the existence check. */
  isChecking: boolean;
  checkError: unknown;

  /** Planning mutation state. */
  isPlanning: boolean;
  planError: unknown;

  /** Trigger the auto-plan operation for next month. No-op if not allowed. */
  planNextMonth: () => Promise<void>;
};

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function addOneMonth(monthKey: MonthString): MonthString {
  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr); // 1..12
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + 1);
  const ny = d.getFullYear();
  const nm = d.getMonth() + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function hasAnyBits(bm: ScheduleBitmap | undefined): boolean {
  return !!bm && bm.some((v) => v > 0);
}

/* -------------------------------------------------------------------------- */
/*                            Hook: useAutoPlanNextMonth                      */
/* -------------------------------------------------------------------------- */

/**
 * Auto-plan next month for the logged-in deliverer.
 *
 * Behavior:
 * 1) Computes nextMonthKey from `monthKey`.
 * 2) Checks if next month already exists (non-empty bitmaps) via `getMySchedule`.
 *    - If it exists → `canPlanNextMonth = false`.
 *    - If empty/missing → `canPlanNextMonth = true`.
 * 3) On `planNextMonth()`, calls backend endpoint that auto-creates next month,
 *    then invalidates the next-month query.
 *
 * NOTE: The POST endpoint path below should match your backend:
 *       `POST /schedule/my/auto-plan-next-month` with body `{ month }`.
 *       If your path/name differs, change it in one place here.
 */
export function useAutoPlanNextMonth(args: UseAutoPlanArgs): UseAutoPlanResult {
  const { monthKey } = args;
  const nextMonthKey = useMemo(() => addOneMonth(monthKey), [monthKey]);
  const qc = useQueryClient();

  // 1) Check if next month already has data
  const {
    data: nextMonthData,
    isLoading: isChecking,
    error: checkError,
  } = useQuery<GetMyScheduleResponse>({
    queryKey: ["schedule", "my", nextMonthKey],
    queryFn: () => getMySchedule({ month: nextMonthKey }),
    // If the backend returns 404/empty month, getMySchedule should normalize to empty arrays.
    // Keep defaults for caching/staleness like other schedule queries.
  });

  const canPlanNextMonth = useMemo(() => {
    // If either active or standby has non-zero bits, we treat next month as "already planned".
    const activeHas = hasAnyBits(nextMonthData?.active);
    const standbyHas = hasAnyBits(nextMonthData?.standBy);
    return !(activeHas || standbyHas);
  }, [nextMonthData]);

  // 2) Auto-plan mutation
  const mutation = useMutation({
    mutationFn: async () => {
      if (!canPlanNextMonth) return;

      console.log("Auto-planning next month:", nextMonthKey);
    },
    onSuccess: async () => {
      // Make sure the just-planned month gets re-fetched
      await qc.invalidateQueries({
        queryKey: ["schedule", "my", nextMonthKey],
      });
    },
  });

  const planNextMonth = async () => {
    if (!canPlanNextMonth || mutation.isPending) return;
    await mutation.mutateAsync();
  };

  return {
    nextMonthKey,
    canPlanNextMonth,
    isChecking,
    checkError,
    isPlanning: mutation.isPending,
    planError: mutation.error,
    planNextMonth,
  };
}
