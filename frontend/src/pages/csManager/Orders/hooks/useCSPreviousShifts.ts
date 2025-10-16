// src/pages/csManagerOrders/hooks/useCSPreviousShifts.ts
import { useMemo, useState, useCallback } from "react";

type ShiftName = "Morning" | "Afternoon" | "Evening" | "Night";

export type PrevShiftRow = {
  dateISO: string;
  shift: ShiftName;
  counts: { total: number; problem: number; complaints: number };
};

// random helpers
const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const SHIFTS: ShiftName[] = ["Morning", "Afternoon", "Evening", "Night"];

function makePrevShifts(offset: number, count: number): PrevShiftRow[] {
  const out: PrevShiftRow[] = [];
  // go back `count` shifts, 4 shifts per day
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.now() - (offset + i) * 6 * 60 * 60 * 1000); // 6h per shift
    const dateISO = date.toISOString().slice(0, 10);
    const shift = SHIFTS[(offset + i) % 4]!;
    const total = ri(8, 48);
    const problem = ri(0, Math.max(1, Math.floor(total * 0.2)));
    const complaints = ri(0, Math.max(1, Math.floor(total * 0.1))); // random for now
    out.push({ dateISO, shift, counts: { total, problem, complaints } });
  }
  // newest first
  out.sort((a, b) => (a.dateISO === b.dateISO ? SHIFTS.indexOf(b.shift) - SHIFTS.indexOf(a.shift) : a.dateISO < b.dateISO ? 1 : -1));
  return out;
}

export function useCSPreviousShifts({ pageSize = 10 }: { pageSize?: number } = {}) {
  const [page, setPage] = useState(1);

  const shifts = useMemo(() => {
    // generate page * pageSize shifts
    return makePrevShifts(1, page * pageSize);
  }, [page, pageSize]);

  const totalsPrev = useMemo(() => {
    return shifts.reduce(
      (acc, s) => {
        acc.total += s.counts.total;
        acc.problem += s.counts.problem;
        acc.complaints += s.counts.complaints;
        return acc;
      },
      { total: 0, problem: 0, complaints: 0 }
    );
  }, [shifts]);

  const loadMore = useCallback(() => setPage(p => p + 1), []);
  const hasMore = true; // infinite fake data for now

  return { shifts, totalsPrev, isLoading: false, hasMore, loadMore };
}
