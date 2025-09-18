// src/utils/scheduleBitmap.ts
/**
 * Weekly schedule bitmap utilities
 *
 * Encoding convention (STABLE):
 * - Morning = 1, Afternoon = 2, Evening = 4, Night = 8
 * - For each day (Sun..Sat), the per-day mask is the bitwise OR of selected shifts.
 * - A full weekly mask is an array of 7 numbers (each 0..15).
 *
 * Example:
 *   [1, 3, 0, 12, 0, 0, 8]  // 7 days
 *   Day 0 (Sun): 1 (Morning)
 *   Day 1 (Mon): 3 (Morning + Afternoon)
 *   Day 3 (Wed): 12 (Evening + Night)
 */

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Display order you’re using in the UI
export const SHIFTS = ["Morning", "Afternoon", "Evening", "Night"] as const;

export type ShiftName = (typeof SHIFTS)[number];
export type Row = boolean[]; // per-shift row: boolean[7]

/** Stable bit mapping — do not change without a migration. */
export const SHIFT_BITS: Record<ShiftName, number> = {
  Morning: 1,
  Afternoon: 2,
  Evening: 4,
  Night: 8,
} as const;

/** Number of week days used by the bitmap (fixed to 7). */
export const WEEK_DAYS = DAYS.length; // 7

/** Maximum per-day bitmask value based on current shifts. */
export const MAX_DAY_MASK = Object.values(SHIFT_BITS).reduce((a, b) => a | b, 0); // 1|2|4|8 = 15

/**
 * Create an empty grid (SHIFTS x DAYS), all cells false.
 * Useful for initializing UI state.
 */
export function emptyWeeklyRows(): Row[] {
  return Array.from({ length: SHIFTS.length }, () =>
    Array(WEEK_DAYS).fill(false)
  );
}

/**
 * Normalize a weekly mask to exactly 7 entries, coercing non-numbers to 0
 * and clamping each day to [0..MAX_DAY_MASK].
 */
export function normalizeWeeklyMask(mask: unknown[]): number[] {
  const truncated = (mask ?? []).slice(0, WEEK_DAYS);
  const padded = truncated.concat(Array(Math.max(0, WEEK_DAYS - truncated.length)).fill(0));

  return padded.map((v) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
    // clamp to [0..MAX_DAY_MASK]
    return Math.min(Math.max(n | 0, 0), MAX_DAY_MASK);
  });
}

/**
 * Encode: rows (shifts x days) -> weekly per-day mask (length 7)
 * rows[s][d] === true means shift s is active on day d.
 */
export function encodeWeekly(rows: Row[]): number[] {
  const weekly = Array(WEEK_DAYS).fill(0);

  for (let day = 0; day < WEEK_DAYS; day++) {
    let dayMask = 0;
    for (let s = 0; s < SHIFTS.length; s++) {
      const shiftActive = !!rows?.[s]?.[day];
      if (shiftActive) {
        const bit = SHIFT_BITS[SHIFTS[s]];
        dayMask |= bit;
      }
    }
    weekly[day] = dayMask; // 0..15
  }
  return weekly;
}

/**
 * Decode: weekly per-day mask (length 7) -> rows (shifts x days)
 */
export function decodeWeekly(weeklyMask: number[]): Row[] {
  const normalized = normalizeWeeklyMask(weeklyMask);
  const rows = emptyWeeklyRows();

  for (let s = 0; s < SHIFTS.length; s++) {
    const bit = SHIFT_BITS[SHIFTS[s]];
    for (let day = 0; day < WEEK_DAYS; day++) {
      rows[s][day] = (normalized[day] & bit) !== 0;
    }
  }
  return rows;
}

/**
 * Toggle a specific cell in-place fashion (returns a NEW rows array).
 * Handy for UI button handlers.
 */
export function toggleWeeklyCell(rows: Row[], shiftIndex: number, dayIndex: number): Row[] {
  const next = rows.map((r) => r.slice());
  if (
    shiftIndex >= 0 && shiftIndex < SHIFTS.length &&
    dayIndex >= 0 && dayIndex < WEEK_DAYS
  ) {
    next[shiftIndex][dayIndex] = !next[shiftIndex][dayIndex];
  }
  return next;
}

/**
 * Clear all selections to an entirely empty weekly mask.
 */
export function clearWeeklyMask(): number[] {
  return Array(WEEK_DAYS).fill(0);
}

/**
 * Quick validator: returns true if mask is exactly 7 numbers within [0..MAX_DAY_MASK].
 */
export function isValidWeeklyMask(mask: unknown): mask is number[] {
  return (
    Array.isArray(mask) &&
    mask.length === WEEK_DAYS &&
    mask.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_DAY_MASK)
  );
}
