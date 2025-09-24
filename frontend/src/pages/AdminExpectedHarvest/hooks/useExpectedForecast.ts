// src/pages/AdminExpectedHarvest/hooks/useExpectedForecast.ts
import { useMemo } from "react";
import {
  SHIFTS,
  type HarvestShift,
  type FarmerSectionHarvestRecord,
} from "@/api/fakes/farmerSectionHarvest";
import { useFarmerSectionHarvest } from "./useFarmerSectionHarvest";

/** Local-only type to match your UI */
type ShiftFilter = HarvestShift | "all";

export interface UseExpectedForecastParams {
  itemId: string;
  shift?: ShiftFilter;        // "all" (default) or a single shift
  daysAhead?: number;         // default 4
  windowDays?: number;        // default 7
  trendDamping?: number;      // shrink the slope for stability (default 0.6)
  perDayChangeClamp?: number; // max % change per day (e.g., 0.35 = 35%)
}

export interface ForecastRow {
  dayOffset: number;  // 1..daysAhead
  date: string;       // ISO yyyy-mm-dd (cosmetic)
  totalKg: number;    // rounded to 0.1
  byShift?: Partial<Record<HarvestShift, number>>;
}

export interface UseExpectedForecastResult {
  loading: boolean;
  error: Error | null;
  rows: ForecastRow[];     // length = daysAhead
  samplesUsedDays: number; // how many distinct days were used
}

/* -------------------- helpers -------------------- */

function isoTodayPlus(days: number): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Sum kg for a single day across many records (already multiplied by area) */
function addTo(map: Map<string, number>, date: string, kg: number) {
  map.set(date, (map.get(date) ?? 0) + kg);
}

/**
 * Build an aggregated daily time series (most recent first) for:
 *  - a specific shift, or
 *  - all shifts combined (sum of shifts)
 *
 * Returns: array of numbers ordered by date ascending (oldest → newest)
 * and the number of distinct days included.
 */
function buildDailySeries(
  records: FarmerSectionHarvestRecord[],
  shift: ShiftFilter,
  windowDays: number
): { seriesAsc: number[]; usedDays: number } {
  // date → total kg
  const daily = new Map<string, number>();

  for (const rec of records) {
    if (!rec.history?.length || !rec.areaM2) continue;

    if (shift === "all") {
      for (const h of rec.history) {
        addTo(daily, h.date, h.harvestedKgPerM2 * rec.areaM2);
      }
    } else {
      for (const h of rec.history) {
        if (h.shift !== shift) continue;
        addTo(daily, h.date, h.harvestedKgPerM2 * rec.areaM2);
      }
    }
  }

  // Sort dates desc (newest first), take window, then reverse to asc for regression
  const desc = [...daily.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .slice(0, windowDays);

  const asc = desc.reverse();
  const seriesAsc = asc.map(([, kg]) => kg);
  return { seriesAsc, usedDays: seriesAsc.length };
}

/**
 * Ordinary least-squares slope on equally spaced x = 0..n-1
 * Returns slope per day. If <3 points, slope = 0.
 */
function olsSlope(yAsc: number[]): number {
  const n = yAsc.length;
  if (n < 3) return 0;
  const meanX = (n - 1) / 2;
  const meanY = yAsc.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (yAsc[i] - meanY);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Forecast next H days using linear trend from last `windowDays`.
 * - trendDamping shrinks the slope for stability (default 0.6)
 * - perDayChangeClamp limits |Δ| per day to a fraction of last value (default 0.35)
 * - clamps to >= 0
 */
function projectNextDays(
  yAsc: number[],
  horizon: number,
  trendDamping = 0.6,
  perDayChangeClamp = 0.35
): number[] {
  if (!yAsc.length) return Array(horizon).fill(0);

  const last = yAsc[yAsc.length - 1];
  const slope = olsSlope(yAsc) * trendDamping;

  const out: number[] = [];
  let prev = last;

  for (let h = 1; h <= horizon; h++) {
    const raw = last + slope * h;
    // clamp the step change relative to previous value
    const maxStep = Math.abs(prev) * perDayChangeClamp;
    let next = raw;

    if (perDayChangeClamp > 0) {
      const delta = raw - prev;
      if (delta > maxStep) next = prev + maxStep;
      else if (delta < -maxStep) next = prev - maxStep;
    }

    // non-negative & round to 0.1
    next = Math.max(0, Math.round(next * 10) / 10);
    out.push(next);
    prev = next;
  }

  return out;
}

/** Per-shift breakdown for shift==="all" */
function buildByShiftBreakdown(
  records: FarmerSectionHarvestRecord[],
  windowDays: number,
  daysAhead: number,
  trendDamping: number,
  perDayClamp: number
): Array<Partial<Record<HarvestShift, number>>> {
  // precompute each shift's series & forecast
  const perShiftForecast: Record<HarvestShift, number[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };

  for (const s of SHIFTS) {
    const { seriesAsc } = buildDailySeries(records, s, windowDays);
    perShiftForecast[s] = projectNextDays(
      seriesAsc,
      daysAhead,
      trendDamping,
      perDayClamp
    );
  }

  // reshape into [day] -> {shift: value}
  const rows: Array<Partial<Record<HarvestShift, number>>> = [];
  for (let i = 0; i < daysAhead; i++) {
    const obj: Partial<Record<HarvestShift, number>> = {};
    for (const s of SHIFTS) {
      const v = perShiftForecast[s][i] ?? 0;
      // round to 0.1 for display consistency
      obj[s] = Math.round(v * 10) / 10;
    }
    rows.push(obj);
  }
  return rows;
}

/* -------------------- main hook -------------------- */

export function useExpectedForecast(
  params: UseExpectedForecastParams
): UseExpectedForecastResult {
  const {
    itemId,
    shift = "all",
    daysAhead = 4,
    windowDays = 7,
    trendDamping = 0.6,
    perDayChangeClamp = 0.35,
  } = params;

  const { data, isLoading, error } = useFarmerSectionHarvest();

  const result = useMemo<UseExpectedForecastResult>(() => {
    if (isLoading || error || !data) {
      return {
        loading: isLoading,
        error: error ?? null,
        rows: [],
        samplesUsedDays: 0,
      };
    }

    // Filter by item
    const records = data.filter((r) => r.itemId === itemId);
    if (!records.length) {
      const rows = Array.from({ length: daysAhead }).map((_, i) => ({
        dayOffset: i + 1,
        date: isoTodayPlus(i + 1),
        totalKg: 0,
      }));
      return { loading: false, error: null, rows, samplesUsedDays: 0 };
    }

    // Build aggregate daily series for selected shift or all shifts
    const { seriesAsc, usedDays } = buildDailySeries(records, shift, windowDays);

    // Forecast for next N days
    const totals = projectNextDays(
      seriesAsc,
      daysAhead,
      trendDamping,
      perDayChangeClamp
    );

    // Optional per-shift breakdown when shift === "all"
    const breakdown =
      shift === "all"
        ? buildByShiftBreakdown(
            records,
            windowDays,
            daysAhead,
            trendDamping,
            perDayChangeClamp
          )
        : undefined;

    // Assemble rows
    const rows: ForecastRow[] = totals.map((v, idx) => {
      const byShift = breakdown?.[idx];
      // if we have a breakdown, sum it for the total to keep consistent
      const totalKg =
        byShift
          ? Math.round(
              (SHIFTS.reduce((s, sft) => s + (byShift[sft] ?? 0), 0)) * 10
            ) / 10
          : v;

      return {
        dayOffset: idx + 1,
        date: isoTodayPlus(idx + 1),
        totalKg,
        byShift,
      };
    });

    return {
      loading: false,
      error: null,
      rows,
      samplesUsedDays: usedDays,
    };
  }, [
    data,
    isLoading,
    error,
    itemId,
    shift,
    daysAhead,
    windowDays,
    trendDamping,
    perDayChangeClamp,
  ]);

  return result;
}
