// src/pages/AdminExpectedHarvest/hooks/useFarmerBreakdown.ts
import { useMemo } from "react";
import {
  type HarvestShift,
  type FarmerSectionHarvestRecord,
  SHIFTS,
} from "@/api/fakes/farmerSectionHarvest";
import { farmerNameById } from "@/api/fakes/farmers";
import { useFarmerSectionHarvest } from "./useFarmerSectionHarvest";

export type ShiftFilter = HarvestShift | "all";

export interface UseFarmerBreakdownParams {
  itemId: string;
  shift?: ShiftFilter;     // default "all"
  windowDays?: number;     // default 7
}

export interface FarmerRow {
  farmerId: string;
  farmerName: string;
  /** dates in ascending order (oldest → newest), length = usedDays */
  datesAsc: string[];
  /** map date → kg for this farmer on that day */
  byDate: Record<string, number>;
  /** compact series aligned to datesAsc (handy for sparkline) */
  seriesAsc: number[];
  /** sum over the window */
  totalKg: number;
}

export interface UseFarmerBreakdownResult {
  loading: boolean;
  error: Error | null;
  /** same datesAsc shared across all rows (grid columns) */
  datesAsc: string[];
  rows: FarmerRow[];
  usedDays: number;
}

function add(map: Map<string, number>, key: string, val: number) {
  map.set(key, (map.get(key) ?? 0) + val);
}

export function useFarmerBreakdown(
  params: UseFarmerBreakdownParams
): UseFarmerBreakdownResult {
  const { itemId, shift = "all", windowDays = 7 } = params;
  const { data, isLoading, error } = useFarmerSectionHarvest();

  return useMemo<UseFarmerBreakdownResult>(() => {
    if (isLoading || error || !data) {
      return { loading: isLoading, error: error ?? null, datesAsc: [], rows: [], usedDays: 0 };
    }

    const records = data.filter((r) => r.itemId === itemId);
    if (!records.length) {
      return { loading: false, error: null, datesAsc: [], rows: [], usedDays: 0 };
    }

    // 1) Build (farmerId, date) → kg
    const farmerDateKg = new Map<string, Map<string, number>>(); // farmerId -> (date -> kg)
    const dateSet = new Set<string>();

    for (const rec of records) {
      const fId = rec.farmerId ?? "unknown";
      if (!farmerDateKg.has(fId)) farmerDateKg.set(fId, new Map());

      if (shift === "all") {
        for (const h of rec.history) {
          add(farmerDateKg.get(fId)!, h.date, h.harvestedKgPerM2 * rec.areaM2);
          dateSet.add(h.date);
        }
      } else {
        for (const h of rec.history) {
          if (h.shift !== shift) continue;
          add(farmerDateKg.get(fId)!, h.date, h.harvestedKgPerM2 * rec.areaM2);
          dateSet.add(h.date);
        }
      }
    }

    // 2) Determine the last `windowDays` distinct dates (global), newest → oldest → then ASC
    const datesDesc = [...dateSet.values()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, windowDays);
    const datesAsc = datesDesc.reverse();
    const usedDays = datesAsc.length;

    // 3) Build rows aligned on datesAsc
    const rows: FarmerRow[] = [];
    for (const [farmerId, dateMap] of farmerDateKg.entries()) {
      let total = 0;
      const byDate: Record<string, number> = {};
      const seriesAsc: number[] = [];

      for (const d of datesAsc) {
        const v = Number(((dateMap.get(d) ?? 0)).toFixed(1));
        byDate[d] = v;
        seriesAsc.push(v);
        total += v;
      }

      rows.push({
        farmerId,
        farmerName: farmerNameById(farmerId),
        datesAsc,
        byDate,
        seriesAsc,
        totalKg: Number(total.toFixed(1)),
      });
    }

    // Sort rows by total desc (top contributors first)
    rows.sort((a, b) => b.totalKg - a.totalKg);

    return { loading: false, error: null, datesAsc, rows, usedDays };
  }, [data, isLoading, error, itemId, shift, windowDays]);
}
