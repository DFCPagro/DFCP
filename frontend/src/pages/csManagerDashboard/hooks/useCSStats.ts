// src/pages/csManagerDashboard/hooks/useCSStats.ts
import { useMemo, useState, useCallback } from "react";
import type { CSStat } from "../components/StatCardsRow";

// tiny random helpers
const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min: number, max: number, d = 1) =>
  Number((Math.random() * (max - min) + min).toFixed(d));

export type UseCSStatsResult = {
  stats: CSStat[];
  isLoading: boolean;
  refetch: () => void;  // regenerate random values
};

export function useCSStats(): UseCSStatsResult {
  const [nonce, setNonce] = useState(0);

  const stats: CSStat[] = useMemo(() => {
    // generate a fresh random set whenever nonce changes
    const avgOrdersPerShift = randInt(20, 60);
    const problemRatePct = randFloat(1.0, 8.0, 1);
    const openTickets = randInt(0, 12);
    const slaBreaches = Math.random() < 0.25 ? randInt(1, 3) : 0;
    const csat = `${randFloat(3.8, 4.9, 1)}/5`;
    const nps = randInt(-10, 60);

    return [
      { key: "avgPerShift", label: "Avg Orders / Shift", value: avgOrdersPerShift, sub: "mock (random)" },
      { key: "problemRate", label: "% Problem", value: `${problemRatePct}%`, sub: "mock (random)" },
      { key: "openTickets", label: "Open Tickets", value: openTickets, sub: slaBreaches ? `${slaBreaches} SLA at risk` : undefined },
      { key: "csat", label: "CSAT / NPS", value: csat, sub: `NPS ${nps}` },
    ];
  }, [nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  return { stats, isLoading: false, refetch };
}
