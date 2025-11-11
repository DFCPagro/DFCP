// src/pages/ShiftFarmerOrder/hooks/usePrevShiftOrders.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getFarmerOrdersByShift,
  qkFarmerOrdersByShift,
} from "@/api/farmerOrders";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";

/** Shift names in display order */
export type ShiftName = "morning" | "afternoon" | "evening" | "night";
const SHIFT_ORDER: ShiftName[] = ["morning", "afternoon", "evening", "night"];

/** Simple rollup shape the card can use now (extensible later for pending/problem) */
export type ShiftRollup = {
  date: string;
  shiftName: ShiftName;
  count: number;
  okFO: number;
  pendingFO: number;
  problemFO: number;
  problemCount: number;
  okFarmers: number;
  pendingFarmers: number;
  problemFarmers: number;
};

/** Card-friendly return shape: grouped by day, each with 4 shifts */
export type PrevDayShifts = {
  date: string; // YYYY-MM-DD
  shifts: Array<{
    shiftName: ShiftName;
    rollup: ShiftRollup;
    items: ShiftFarmerOrderItem[]; // we keep items for future needs (even if card shows counts only)
  }>;
};

export type UsePrevShiftOrdersParams = {
  /** How many full previous calendar days to include (default 2) */
  daysBack?: number;
  /** Use the fake path in the API (default true for now) */
  fake?: boolean;
  /** Per-shift target size for fake data, clamped internally to [8,12] (default 12) */
  fakeNum?: number;
};

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPreviousDates(daysBack: number): string[] {
  const out: string[] = [];
  const today = new Date();
  // We want the *previous* N full days: e.g., if today is 2025-11-05, return 2025-11-04, 2025-11-03
  for (let i = 1; i <= daysBack; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(toYMD(d));
  }
  return out;
}

/** Build a rollup from items; ready for pending/problem later */
function buildRollup(
  date: string,
  shiftName: ShiftName,
  items: ShiftFarmerOrderItem[]
): ShiftRollup {
  const count = items.length;
  // For fake mode (now): everything is ok. For real mode: compute from items later.
  const okFO = count;
  return {
    date,
    shiftName,
    count,
    okFO,
    pendingFO: 0,
    problemFO: 0,
    problemCount: 0,
    okFarmers: okFO,
    pendingFarmers: 0,
    problemFarmers: 0,
  };
}

export function usePrevShiftOrders({
  daysBack = 2,
  fake = true,
  fakeNum = 12,
}: UsePrevShiftOrdersParams = {}) {
  const dates = useMemo(() => getPreviousDates(daysBack), [daysBack]);

  // Compose a stable, descriptive query key so cache never collides with real-by-shift
  const queryKey = useMemo(
    () =>
      [
        "prevShiftOrders",
        { dates, shifts: SHIFT_ORDER, fake, fakeNum },
      ] as const,
    [dates, fake, fakeNum]
  );

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      // Fan out  (daysBack × 4 shifts)
      const results = await Promise.all(
        dates.flatMap((date) =>
          SHIFT_ORDER.map(async (shiftName) => {
            const res = await getFarmerOrdersByShift({
              date,
              shiftName,
              // keep paging off for simplicity (we want full counts)
              fake,
              fakeNum,
            } as any);
            const items: ShiftFarmerOrderItem[] = (res.items ??
              []) as ShiftFarmerOrderItem[];
            return { date, shiftName, items };
          })
        )
      );

      // Group by day in descending date order; inside each day sort by SHIFT_ORDER
      const groups = new Map<
        string,
        { date: string; byShift: Map<ShiftName, ShiftFarmerOrderItem[]> }
      >();
      for (const r of results) {
        if (!groups.has(r.date)) {
          groups.set(r.date, { date: r.date, byShift: new Map() });
        }
        groups.get(r.date)!.byShift.set(r.shiftName as ShiftName, r.items);
      }

      const days: PrevDayShifts[] = Array.from(groups.values())
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .map((g) => ({
          date: g.date,
          shifts: SHIFT_ORDER.map((s) => {
            const items = g.byShift.get(s) ?? [];
            return {
              shiftName: s,
              items,
              rollup: buildRollup(g.date, s, items),
            };
          }),
        }));

      return days;
    },
    // historical data: can be cached for a bit
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

export type UsePrevShiftOrdersReturn = ReturnType<typeof usePrevShiftOrders>;
