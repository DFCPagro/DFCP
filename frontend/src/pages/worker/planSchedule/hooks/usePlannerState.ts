import { useMemo, useState, useCallback } from "react";
import { daysInMonth, type MonthIndex } from "@/utils/bitMapTranslator";
import type { ScheduleBitmap } from "@/api/schedule";
import {
  validatePlan,
  validatePlanDay,
  type SlotMatrix,
  type ValidatePlanResult,
} from "../utils/validatePlan";

/** Local enum to avoid importing API type in signatures */
export type PlanType = "active" | "standby";

/** Options when creating planner state */
export type UsePlannerStateOptions = {
  /** Target year, e.g., 2025 */
  year: number;
  /** JS month index 0..11 */
  month: MonthIndex;
  /**
   * Number of shift slots in a day. Must be >= 3.
   * Typical: 3 (M/A/E) or 4 (M/A/E/N).
   */
  slotCount?: number;
  /**
   * (Optional) If API returns prefilled month (e.g., user re-opens), pass them to pre-populate the matrices.
   * Each day is a small integer mask (0..2^slotCount-1).
   */
  initialActive?: ScheduleBitmap;
  initialStandby?: ScheduleBitmap;
};

/** Exported shape for consumers (page/components) */
export type UsePlannerState = {
  /** Matrices sized [days][slotCount] */
  active: SlotMatrix;
  standby: SlotMatrix;

  /** Derived info */
  days: number;
  slotCount: number;

  /** Helpers to edit state */
  toggle: (type: PlanType, dayIdx: number, slotIdx: number) => void;
  setDay: (type: PlanType, dayIdx: number, row: boolean[]) => void;
  clearDay: (dayIdx: number) => void;
  clearAll: () => void;

  /** Validation (full month and single day) */
  validateAll: () => ValidatePlanResult;
  validateDay: (dayIdx: number) => {
    valid: boolean;
    codes: string[];
    messages: string[];
  };

  /** Build API payloads (bitmasked) */
  buildPayloads: () => { active: ScheduleBitmap; standBy: ScheduleBitmap };

  /** Utility for UI badges/tooling: totals of selected slots by type */
  totalSelected: { active: number; standby: number };
};

/* -------------------------------------------------------------------------- */
/*                               Internal helpers                             */
/* -------------------------------------------------------------------------- */

/** Encode a boolean row (length = slotCount) into an integer mask */
function encodeRowToMask(row: boolean[]): number {
  let mask = 0;
  for (let i = 0; i < row.length; i++) {
    if (row[i]) mask |= 1 << i;
  }
  return mask;
}

/** Decode an integer mask into a boolean row of length = slotCount */
function decodeMaskToRow(mask: number, slotCount: number): boolean[] {
  const out = new Array<boolean>(slotCount);
  for (let i = 0; i < slotCount; i++) {
    out[i] = ((mask >> i) & 1) === 1;
  }
  return out;
}

/** Ensure a [days][slots] matrix exists, padding with false where needed */
function ensureMatrix(
  days: number,
  slots: number,
  source?: SlotMatrix
): SlotMatrix {
  const m: SlotMatrix = new Array(days);
  for (let d = 0; d < days; d++) {
    const src = source?.[d] ?? [];
    const row = new Array<boolean>(slots);
    for (let s = 0; s < slots; s++) row[s] = Boolean(src[s] ?? false);
    m[d] = row;
  }
  return m;
}

/** Build matrix from bitmasked bitmap (if provided), otherwise all false */
function fromBitmapOrEmpty(
  days: number,
  slots: number,
  bitmap?: ScheduleBitmap
): SlotMatrix {
  const m: SlotMatrix = new Array(days);
  for (let d = 0; d < days; d++) {
    const mask = bitmap && bitmap[d] ? bitmap[d] : 0;
    m[d] = decodeMaskToRow(mask, slots);
  }
  return m;
}

/** Count trues in the whole matrix (for UI totals) */
function countSelected(m: SlotMatrix): number {
  let c = 0;
  for (let d = 0; d < m.length; d++) {
    const row = m[d];
    for (let s = 0; s < row.length; s++) if (row[s]) c++;
  }
  return c;
}

/* -------------------------------------------------------------------------- */
/*                                   Hook                                     */
/* -------------------------------------------------------------------------- */

export function usePlannerState(opts: UsePlannerStateOptions): UsePlannerState {
  const slotCount = Math.max(3, Math.trunc(opts.slotCount ?? 3)); // enforce >= 3
  const days = useMemo(
    () => daysInMonth(opts.year, opts.month),
    [opts.year, opts.month]
  );

  // Initialize from API-provided bitmaps if present; otherwise all false
  const [active, setActive] = useState<SlotMatrix>(() =>
    fromBitmapOrEmpty(days, slotCount, opts.initialActive)
  );
  const [standby, setStandby] = useState<SlotMatrix>(() =>
    fromBitmapOrEmpty(days, slotCount, opts.initialStandby)
  );

  // If year/month/slotCount changes (shouldn't in this page), we could reset matrices.
  // For safety, memoize `days` only—callers should not change slotCount mid-session.

  const toggle = useCallback(
    (type: PlanType, dayIdx: number, slotIdx: number) => {
      if (dayIdx < 0 || dayIdx >= days) return;
      if (slotIdx < 0 || slotIdx >= slotCount) return;

      if (type === "active") {
        setActive((prev) => {
          const next = ensureMatrix(days, slotCount, prev);
          next[dayIdx][slotIdx] = !next[dayIdx][slotIdx];
          return next;
        });
      } else {
        setStandby((prev) => {
          const next = ensureMatrix(days, slotCount, prev);
          next[dayIdx][slotIdx] = !next[dayIdx][slotIdx];
          return next;
        });
      }
    },
    [days, slotCount]
  );

  const setDay = useCallback(
    (type: PlanType, dayIdx: number, row: boolean[]) => {
      if (dayIdx < 0 || dayIdx >= days) return;

      const fixed = new Array<boolean>(slotCount);
      for (let i = 0; i < slotCount; i++) fixed[i] = Boolean(row[i] ?? false);

      if (type === "active") {
        setActive((prev) => {
          const next = ensureMatrix(days, slotCount, prev);
          next[dayIdx] = fixed;
          return next;
        });
      } else {
        setStandby((prev) => {
          const next = ensureMatrix(days, slotCount, prev);
          next[dayIdx] = fixed;
          return next;
        });
      }
    },
    [days, slotCount]
  );

  const clearDay = useCallback(
    (dayIdx: number) => {
      if (dayIdx < 0 || dayIdx >= days) return;
      setActive((prev) => {
        const next = ensureMatrix(days, slotCount, prev);
        for (let i = 0; i < slotCount; i++) next[dayIdx][i] = false;
        return next;
      });
      setStandby((prev) => {
        const next = ensureMatrix(days, slotCount, prev);
        for (let i = 0; i < slotCount; i++) next[dayIdx][i] = false;
        return next;
      });
    },
    [days, slotCount]
  );

  const clearAll = useCallback(() => {
    setActive(fromBitmapOrEmpty(days, slotCount, undefined));
    setStandby(fromBitmapOrEmpty(days, slotCount, undefined));
  }, [days, slotCount]);

  const validateAll = useCallback<() => ValidatePlanResult>(() => {
    return validatePlan(
      { active, standby },
      { year: opts.year, month: opts.month, slotCount }
    );
  }, [active, standby, opts.year, opts.month, slotCount]);

  const validateDayPublic = useCallback(
    (dayIdx: number) => {
      if (dayIdx < 0 || dayIdx >= days) {
        return { valid: true, codes: [], messages: [] };
      }
      return validatePlanDay(active[dayIdx], standby[dayIdx], slotCount);
    },
    [active, standby, slotCount, days]
  );

  const buildPayloads = useCallback(() => {
    const activeOut: ScheduleBitmap = new Array(days);
    const standbyOut: ScheduleBitmap = new Array(days);
    for (let d = 0; d < days; d++) {
      activeOut[d] = encodeRowToMask(active[d]);
      standbyOut[d] = encodeRowToMask(standby[d]);
    }
    return { active: activeOut, standBy: standbyOut };
  }, [active, standby, days]);

  const totalSelected = useMemo(
    () => ({
      active: countSelected(active),
      standby: countSelected(standby),
    }),
    [active, standby]
  );

  return {
    active,
    standby,
    days,
    slotCount,
    toggle,
    setDay,
    clearDay,
    clearAll,
    validateAll,
    validateDay: validateDayPublic,
    buildPayloads,
    totalSelected,
  };
}
