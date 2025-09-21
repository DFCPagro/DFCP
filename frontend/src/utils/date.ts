export const getPrevMonth = (y: number, m: number) =>
  m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };

export const getNextMonth = (y: number, m: number) =>
  m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };

export const fmtTodayChip = (d: Date) =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); // "Aug 20"


export function formatDMY(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) return ""; // invalid date → empty string

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0"); // 0-based
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
}

// ---- append to date.ts ----

/** Convert a Date to YYYY-MM-DD (local) */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Quick guard for "YYYY-MM-DD" */
export function isISODateString(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Derive a simple progress % from plantedOn → expectedHarvest (0..100).
 * Returns null if dates are missing/invalid or range <= 0.
 */
export function derivePercent(
  plantedOn: string | null | undefined,
  expectedHarvest: string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!isISODateString(plantedOn!) || !isISODateString(expectedHarvest!)) return null;

  const start = new Date(plantedOn!);
  const end = new Date(expectedHarvest!);
  const cur = now;

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return null;

  const elapsed = Math.min(Math.max(cur.getTime() - start.getTime(), 0), total);
  const pct = Math.round((elapsed / total) * 100);
  return Math.max(0, Math.min(100, pct));
}
