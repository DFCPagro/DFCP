// src/pages/AdminExpectedHarvest/hooks/useExpectedForecast.ts
import { useMemo } from "react";
import {
  SHIFTS,
  type HarvestShift,
  type FarmerSectionHarvestRecord,
} from "@/api/fakes/farmerSectionHarvest";
import { useFarmerSectionHarvest } from "./useFarmerSectionHarvest";

export type ShiftFilter = HarvestShift | "all";

export interface UseExpectedForecastParams {
  /** Crop/SKU to display (required for the page UX) */
  itemId: string;
  /** "all" (default) or a single shift */
  shift?: ShiftFilter;
  /** Forecast horizon (default 4 days) */
  daysAhead?: number;
  /** Window length taken from history for the statistic (default 7 days) */
  windowDays?: number;
}

export interface ForecastRow {
  /** 1..daysAhead */
  dayOffset: number;
  /** ISO yyyy-mm-dd of the predicted day (relative; cosmetic only) */
  date: string;
  /** Total expected kg for this day across ALL sections matching the filters */
  totalKg: number;
  /** Optional breakdown per shift (only filled when shift="all") */
  byShift?: Partial<Record<HarvestShift, number>>;
}

export interface UseExpectedForecastResult {
  loading: boolean;
  error: Error | null;
  rows: ForecastRow[]; // length = daysAhead
  samplesUsedDays: number; // how many days from history contributed (per record median uses up to windowDays)
}

/* -------------------- helpers -------------------- */

function isoTodayPlus(days: number): string {
  // Cosmetic only; not critical to alignment since we’re using medians
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Extract up to `nDays` most recent (distinct-date) values for the given shift,
 * returning an array of kg/m² values for that record.
 *
 * Assumptions:
 *  - history contains exactly one entry per (date, shift) for this record
 *  - history may not be sorted, so we sort by date desc first
 */
function lastNDaysValuesPerShift(
  record: FarmerSectionHarvestRecord,
  shift: HarvestShift,
  nDays: number
): number[] {
  // Sort desc by date
  const entries = [...record.history].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  );

  const vals: number[] = [];
  let seenDates = 0;
  let currentDate: string | null = null;

  for (const h of entries) {
    if (h.shift !== shift) continue;

    if (currentDate === null) {
      currentDate = h.date;
      seenDates = 1;
      vals.push(h.harvestedKgPerM2);
    } else if (h.date === currentDate) {
      // already added this shift/date (there should be only one)
      continue;
    } else {
      // new date encountered
      currentDate = h.date;
      seenDates++;
      vals.push(h.harvestedKgPerM2);
      if (seenDates >= nDays) break;
    }
  }

  return vals;
}

/**
 * Compute a per-record median kg/m² for the given shift from the last `windowDays` days.
 * For "all" we sum medians for morning/afternoon/evening/night.
 */
function recordMedianKgPerM2(
  record: FarmerSectionHarvestRecord,
  shift: ShiftFilter,
  windowDays: number
): { perM2: number; perShift?: Partial<Record<HarvestShift, number>> } {
  if (shift !== "all") {
    const vals = lastNDaysValuesPerShift(record, shift, windowDays);
    return { perM2: median(vals) };
  }

  const perShift: Partial<Record<HarvestShift, number>> = {};
  let total = 0;
  for (const s of SHIFTS) {
    const vals = lastNDaysValuesPerShift(record, s, windowDays);
    const m = median(vals);
    perShift[s] = m;
    total += m;
  }
  return { perM2: total, perShift };
}

/* -------------------- main hook -------------------- */

export function useExpectedForecast(
  params: UseExpectedForecastParams
): UseExpectedForecastResult {
  const { itemId, shift = "all", daysAhead = 4, windowDays = 7 } = params;
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

    // 1) Filter by itemId
    const records = data.filter((r) => r.itemId === itemId);

    // If nothing matches, return zeros
    if (!records.length) {
      const rows: ForecastRow[] = Array.from({ length: daysAhead }).map((_, i) => ({
        dayOffset: i + 1,
        date: isoTodayPlus(i + 1),
        totalKg: 0,
      }));
      return { loading: false, error: null, rows, samplesUsedDays: 0 };
    }

    // 2) Compute per-record medians (kg/m²) then convert to kg by multiplying area
    //    Aggregate across sections by summing.
    let totalPerShift: Partial<Record<HarvestShift, number>> | undefined = undefined;
    let aggregateKgPerDay = 0;

    for (const rec of records) {
      const med = recordMedianKgPerM2(rec, shift, windowDays);

      // Convert to kg for this record (per day expectation)
      const perDayKg = med.perM2 * rec.areaM2;
      aggregateKgPerDay += perDayKg;

      // If shift="all", accumulate a breakdown for the UI (optional)
      if (shift === "all" && med.perShift) {
        if (!totalPerShift) totalPerShift = {};
        for (const s of SHIFTS) {
          const m = med.perShift[s] ?? 0;
          totalPerShift[s] = (totalPerShift[s] ?? 0) + m * rec.areaM2;
        }
      }
    }

    // 3) Create rows for next N days.
    //    For this simple demo we keep the same daily expectation for days 1..N.
    const rows: ForecastRow[] = Array.from({ length: daysAhead }).map((_, i) => ({
      dayOffset: i + 1,
      date: isoTodayPlus(i + 1),
      totalKg: Number(aggregateKgPerDay.toFixed(1)),
      byShift:
        shift === "all" && totalPerShift
          ? (Object.fromEntries(
              Object.entries(totalPerShift).map(([k, v]) => [k, Number(v.toFixed(1))])
            ) as Partial<Record<HarvestShift, number>>)
          : undefined,
    }));

    return {
      loading: false,
      error: null,
      rows,
      // This reflects the *intended* window length; all fake records have enough data
      samplesUsedDays: windowDays,
    };
  }, [data, isLoading, error, itemId, shift, daysAhead, windowDays]);

  return result;
}
