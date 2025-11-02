// src/pages/csManagerOrders/hooks/useCSOrdersSummary.ts
import { useMemo } from "react";
import type { PrevShiftRow } from "./useCSPreviousShifts";

export function useCSOrdersSummary({
  ordersNow,
  prevShifts,
}: {
  ordersNow: Array<{ stageKey: string }>;
  prevShifts: PrevShiftRow[];
}) {
  const totalsNow = useMemo(() => {
    const total = ordersNow.length;
    const problem = ordersNow.filter(o => o.stageKey === "problem").length;
    return { total, problem };
  }, [ordersNow]);

  const totalsPrev = useMemo(() => {
    return prevShifts.reduce(
      (acc, s) => {
        acc.total += s.counts.total;
        acc.problem += s.counts.problem;
        acc.complaints += s.counts.complaints;
        return acc;
      },
      { total: 0, problem: 0, complaints: 0 }
    );
  }, [prevShifts]);

  return { totalsNow, totalsPrev };
}
