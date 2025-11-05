// src/pages/csManagerDashboard/hooks/useCSShiftSummaries.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ShiftName } from "@/utils/shifts";
import { compareShift } from "@/utils/shifts";
import { getOrdersSummaryFromLC } from "@/api/orders";

export type ShiftSummaryRow = {
  dateISO: string;
  shift: ShiftName;
  counts: { total: number; problem: number };
};

export function useCSShiftSummaries({ horizonShifts = 6 } = {}) {
  const q = useQuery({
    queryKey: ["csShiftSummaryByLC",  horizonShifts],
    queryFn: () => getOrdersSummaryFromLC( horizonShifts),
  });

  const rows: ShiftSummaryRow[] = useMemo(
    () =>
      (q.data ?? []).map((r) => ({
        dateISO: r.dateISO,
        shift: r.shift as ShiftName,
        counts: { total: r.total, problem: r.problem },
      })).sort((a, b) =>
        a.dateISO === b.dateISO ? compareShift(a.shift, b.shift) : a.dateISO < b.dateISO ? -1 : 1
      ),
    [q.data]
  );

  return { rows, isLoading: q.isLoading, error: q.error };
}
