// src/utils/bitMapTranslator.ts

/**
 * A tiny, dependency-free helper for converting between a per-day monthly bitmap
 * (number[] where truthy = active) and day-number lists, with safe month-aware utilities.
 *
 * Conventions:
 * - Month is 0-indexed (JS Date style): 0 = January ... 11 = December
 * - Day numbers are 1-indexed: 1..daysInMonth(year, month)
 * - Bitmap length SHOULD equal daysInMonth(year, month). If not, we normalize (pad/truncate with 0).
 */

export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** Return number of days in a given month of a given year. */
export function daysInMonth(year: number, month: MonthIndex): number {
  // JS trick: day = 0 => last day of previous month; month+1, day=0 gives last day of target month
  return new Date(year, month + 1, 0).getDate();
}

/** Returns a normalized copy of the bitmap to match the month's day count (pads/truncates with 0). */
export function normalizeBitmapForMonth(
  bitmap: number[] | readonly number[],
  year: number,
  month: MonthIndex
): number[] {
  const dim = daysInMonth(year, month);
  const out = new Array<number>(dim);
  for (let i = 0; i < dim; i++) {
    out[i] = Number(Boolean(bitmap[i] ?? 0)); // pad with 0 beyond provided length
  }
  return out;
}

/** Defensive check that bitmap length matches month; returns true if already normalized. */
export function isBitmapLengthValid(
  bitmap: number[] | readonly number[],
  year: number,
  month: MonthIndex
): boolean {
  return bitmap.length === daysInMonth(year, month);
}

/** Count active (truthy) entries. Normalizes first. */
export function countActive(
  bitmap: number[] | readonly number[],
  year: number,
  month: MonthIndex
): number {
  const bm = normalizeBitmapForMonth(bitmap, year, month);
  let c = 0;
  for (let i = 0; i < bm.length; i++) if (bm[i]) c++;
  return c;
}

/**
 * Convert bitmap → list of active day numbers (1-indexed).
 * Example: [0,1,0,1] for a 4-day month → [2,4]
 */
export function bitmapToDays(
  bitmap: number[] | readonly number[],
  year: number,
  month: MonthIndex
): number[] {
  const bm = normalizeBitmapForMonth(bitmap, year, month);
  const res: number[] = [];
  for (let i = 0; i < bm.length; i++) {
    if (bm[i]) res.push(i + 1); // 1-indexed day
  }
  return res;
}

/** Convert bitmap → Set of active day numbers (1-indexed). */
export function bitmapToDaySet(
  bitmap: number[] | readonly number[],
  year: number,
  month: MonthIndex
): Set<number> {
  return new Set(bitmapToDays(bitmap, year, month));
}

/**
 * Check if a specific day number (1..dim) is active in the bitmap.
 * Returns false for out-of-range day numbers.
 */
export function isActiveDay(
  bitmap: number[] | readonly number[],
  dayNumber: number,
  year: number,
  month: MonthIndex
): boolean {
  const dim = daysInMonth(year, month);
  if (dayNumber < 1 || dayNumber > dim) return false;
  const bm = normalizeBitmapForMonth(bitmap, year, month);
  return Boolean(bm[dayNumber - 1]);
}

/**
 * Convert a list of day numbers (1-indexed) → normalized bitmap for the given month.
 * Out-of-range day numbers are ignored.
 */
export function daysToBitmap(
  days: number[] | readonly number[],
  year: number,
  month: MonthIndex
): number[] {
  const dim = daysInMonth(year, month);
  const out = new Array<number>(dim).fill(0);
  for (const d of days) {
    if (Number.isInteger(d) && d >= 1 && d <= dim) {
      out[d - 1] = 1;
    }
  }
  return out;
}

/**
 * Merge two bitmaps for the same year/month using logical OR (union).
 * If lengths differ (or months differ), both are normalized to the same month.
 */
export function mergeBitmaps(
  a: number[] | readonly number[],
  b: number[] | readonly number[],
  year: number,
  month: MonthIndex
): number[] {
  const aa = normalizeBitmapForMonth(a, year, month);
  const bb = normalizeBitmapForMonth(b, year, month);
  const out = new Array<number>(aa.length);
  for (let i = 0; i < aa.length; i++) out[i] = aa[i] || bb[i] ? 1 : 0;
  return out;
}

/**
 * Intersect two bitmaps (logical AND).
 */
export function intersectBitmaps(
  a: number[] | readonly number[],
  b: number[] | readonly number[],
  year: number,
  month: MonthIndex
): number[] {
  const aa = normalizeBitmapForMonth(a, year, month);
  const bb = normalizeBitmapForMonth(b, year, month);
  const out = new Array<number>(aa.length);
  for (let i = 0; i < aa.length; i++) out[i] = aa[i] && bb[i] ? 1 : 0;
  return out;
}

/**
 * Subtract bitmap b from a (a AND NOT b).
 */
export function subtractBitmaps(
  a: number[] | readonly number[],
  b: number[] | readonly number[],
  year: number,
  month: MonthIndex
): number[] {
  const aa = normalizeBitmapForMonth(a, year, month);
  const bb = normalizeBitmapForMonth(b, year, month);
  const out = new Array<number>(aa.length);
  for (let i = 0; i < aa.length; i++) out[i] = aa[i] && !bb[i] ? 1 : 0;
  return out;
}

/**
 * Clamp a JS Date to the provided year/month and return the 1-indexed day number,
 * or null if the date is not within the target month.
 */
export function getDayNumberIfInMonth(
  date: Date,
  year: number,
  month: MonthIndex
): number | null {
  if (date.getFullYear() === year && date.getMonth() === month) {
    return date.getDate(); // 1..dim
  }
  return null;
}

/**
 * Safe formatter to human strings for debugging (e.g., "2025-11: 1,5,7").
 */
export function debugBitmapSummary(
  bitmap: number[] | readonly number[],
  year: number,
  month: MonthIndex
): string {
  const days = bitmapToDays(bitmap, year, month);
  const y = String(year);
  const m = String(month + 1).padStart(2, "0");
  return `${y}-${m}: ${days.join(",") || "(none)"}`;
}
