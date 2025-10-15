import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ShiftName } from "@/utils/shifts";
import { getCurrentAndUpcomingShiftWindows, compareShift } from "@/utils/shifts";
import { getOrdersSummary } from "@/api/orders";

export type ShiftSummaryRow = {
  dateISO: string;
  shift: ShiftName;
  counts: { total: number; problem: number };
};

export function useCSShiftSummaries({ horizonShifts = 6 }: { horizonShifts?: number } = {}) {
  const windows = useMemo(
    () => getCurrentAndUpcomingShiftWindows(new Date(), Math.ceil(horizonShifts / 3) + 1),
    [horizonShifts]
  );

  const query = useQuery({
    queryKey: ["csShiftSummary", windows.map((w) => `${w.dateISO}-${w.shift}`)],
    queryFn: async () => {
      // if your backend supports windows array:
      const res = await getOrdersSummary({ windows });
      return res as Array<{ dateISO: string; shift: ShiftName; total: number; problem: number }>;
    },
  });

  const rows: ShiftSummaryRow[] = useMemo(() => {
    const map = new Map<string, ShiftSummaryRow>();
    for (const w of windows.slice(0, horizonShifts)) {
      map.set(`${w.dateISO}__${w.shift}`, {
        dateISO: w.dateISO,
        shift: w.shift as ShiftName,
        counts: { total: 0, problem: 0 },
      });
    }
    for (const r of query.data ?? []) {
      const id = `${r.dateISO}__${r.shift}`;
      if (!map.has(id)) continue;
      const row = map.get(id)!;
      row.counts.total = r.total;
      row.counts.problem = r.problem;
    }
    return Array.from(map.values()).sort((a, b) =>
      a.dateISO === b.dateISO ? compareShift(a.shift, b.shift) : a.dateISO < b.dateISO ? -1 : 1
    );
  }, [query.data, windows, horizonShifts]);

  return { rows, isLoading: query.isLoading, error: query.error };
}
