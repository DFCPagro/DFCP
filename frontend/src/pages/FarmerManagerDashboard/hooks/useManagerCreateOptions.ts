// src/pages/FarmerManagerDashboard/hooks/useManagerCreateOptions.ts
import { useMemo } from "react";
import type { ShiftName } from "@/utils/shifts";
import { getCreateOrderOptions } from "@/utils/shifts";

/** One row for the "Create Orders" card */
export type CreateOptionRow = {
  dateISO: string;            // "YYYY-MM-DD"
  shift: ShiftName;           // "Morning" | "Afternoon" | "Evening" | "Night"
  canAdd: boolean;            // true if the shift hasn't started yet
};

export type UseManagerCreateOptions = {
  /**
   * Horizon in days from today (inclusive). 1 = today & tomorrow. Default: 1
   * Example:
   *   0 -> only today
   *   1 -> today + tomorrow
   *   2 -> today + the next 2 days
   */
  horizonDays?: number;

  /**
   * Include rows where canAdd=false (already-started shifts)?
   * Default: false (hide started shifts to match "close it" behavior)
   */
  includeDisabled?: boolean;

  /** Override "now" (useful for tests). Default: new Date() */
  now?: Date;
};

/**
 * Build the rows for the "Create Orders" list.
 * By default it shows only shifts that haven't started yet (today + tomorrow),
 * matching the requirement that we "close" started/ongoing shifts.
 */
export function useManagerCreateOptions(options: UseManagerCreateOptions = {}) {
  const {
    horizonDays = 1,
    includeDisabled = false,
    now = new Date(),
  } = options;

  const rows: CreateOptionRow[] = useMemo(() => {
    const base = getCreateOrderOptions(now, horizonDays);
    return includeDisabled ? base : base.filter((r) => r.canAdd);
  }, [horizonDays, includeDisabled, now]);

  return { rows };
}
