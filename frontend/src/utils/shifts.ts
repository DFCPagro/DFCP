// src/utils/shifts.ts

/**
 * Shift utilities (Asia/Jerusalem by convention, using the browser's local time).
 *
 * NOTE:
 * - This implementation uses the user's local timezone for calculations.
 * - Your team is in Israel and the app is used locally, so this is usually fine.
 * - If you need strict "Asia/Jerusalem" no matter where the browser is,
 *   we can switch internals to `date-fns-tz` but keep the same public API.
 */

export type ShiftName = "Night" | "Morning" | "Afternoon" | "Evening";

export const SHIFTS: readonly ShiftName[] = [
  "Night",
  "Morning",
  "Afternoon",
  "Evening",
] as const;

/** Display order: Morning, Afternoon, Evening, Night (for UI lists). */
export const DISPLAY_SHIFT_ORDER: readonly ShiftName[] = [
  "Morning",
  "Afternoon",
  "Evening",
  "Night",
] as const;

/** 24h start times (local time) for each shift. */
const SHIFT_START_HOUR: Record<ShiftName, number> = {
  Night: 0,       // 00:00
  Morning: 6,     // 06:00
  Afternoon: 12,  // 12:00
  Evening: 18,    // 18:00
};

/** Return `YYYY-MM-DD` for a local Date. */
export function toDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const mm = m < 10 ? `0${m}` : `${m}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  return `${y}-${mm}-${dd}`;
}

/** Create a Date at local midnight for the given date (keep local TZ). */
export function startOfDayLocal(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Create a Date from a local `YYYY-MM-DD` (midnight local). */
export function fromDateISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date();
  dt.setFullYear(y, (m || 1) - 1, d || 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/** Add days in local time (no DST jumps across hours because we set to midnight when needed). */
export function addDaysLocal(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

/** Returns the [start, end) window for a given date and shift in local time. */
export function getShiftWindow(dateLocal: Date, shift: ShiftName): { start: Date; end: Date } {
  const dayStart = startOfDayLocal(dateLocal);

  const start = new Date(dayStart);
  start.setHours(SHIFT_START_HOUR[shift], 0, 0, 0);

  let end: Date;
  switch (shift) {
    case "Night": {
      const e = new Date(dayStart);
      e.setHours(SHIFT_START_HOUR["Morning"], 0, 0, 0); // 06:00 same day
      end = e;
      break;
    }
    case "Morning": {
      const e = new Date(dayStart);
      e.setHours(SHIFT_START_HOUR["Afternoon"], 0, 0, 0); // 12:00
      end = e;
      break;
    }
    case "Afternoon": {
      const e = new Date(dayStart);
      e.setHours(SHIFT_START_HOUR["Evening"], 0, 0, 0); // 18:00
      end = e;
      break;
    }
    case "Evening": {
      // 24:00 == next day 00:00
      const e = startOfDayLocal(addDaysLocal(dayStart, 1));
      end = e;
      break;
    }
  }

  return { start, end };
}

/** True if `now` is on/after the shift's start for that date (local). */
export function isShiftStarted(dateLocal: Date, shift: ShiftName, now: Date = new Date()): boolean {
  const { start } = getShiftWindow(dateLocal, shift);
  return now.getTime() >= start.getTime();
}

/** True if now is within the [start, end) window for that date/shift (local). */
export function isShiftCurrent(dateLocal: Date, shift: ShiftName, now: Date = new Date()): boolean {
  const { start, end } = getShiftWindow(dateLocal, shift);
  const t = now.getTime();
  return t >= start.getTime() && t < end.getTime();
}

/** True if the entire window is strictly in the future relative to now. */
export function isShiftFuture(dateLocal: Date, shift: ShiftName, now: Date = new Date()): boolean {
  const { start } = getShiftWindow(dateLocal, shift);
  return now.getTime() < start.getTime();
}

/** True if the entire window is strictly in the past relative to now. */
export function isShiftPast(dateLocal: Date, shift: ShiftName, now: Date = new Date()): boolean {
  const { end } = getShiftWindow(dateLocal, shift);
  return now.getTime() >= end.getTime();
}

/** Compare two shifts by chronological order within a single day. */
export function compareShift(a: ShiftName, b: ShiftName): number {
  const order: Record<ShiftName, number> = {
    Night: 0,
    Morning: 1,
    Afternoon: 2,
    Evening: 3,
  };
  return order[a] - order[b];
}

/** Get the current shift for TODAY if any; otherwise `null`. */
export function getCurrentShift(now: Date = new Date()): { dateISO: string; shift: ShiftName } | null {
  const today = startOfDayLocal(now);
  for (const shift of SHIFTS) {
    if (isShiftCurrent(today, shift, now)) {
      return { dateISO: toDateISO(today), shift };
    }
  }
  return null;
}

/**
 * Return all shift windows from today to `today + horizonDays` (inclusive),
 * but only those whose END is in the future (i.e., current or upcoming).
 *
 * Use this for "Current & Upcoming Shifts" lists.
 */
export function getCurrentAndUpcomingShiftWindows(
  now: Date = new Date(),
  horizonDays: number = 1
): Array<{ dateISO: string; shift: ShiftName; start: Date; end: Date }> {
  const out: Array<{ dateISO: string; shift: ShiftName; start: Date; end: Date }> = [];
  const startDay = startOfDayLocal(now);

  for (let d = 0; d <= horizonDays; d++) {
    const date = addDaysLocal(startDay, d);
    const dateISO = toDateISO(date);
    for (const shift of SHIFTS) {
      const { start, end } = getShiftWindow(date, shift);
      if (end.getTime() > now.getTime()) {
        out.push({ dateISO, shift, start, end });
      }
    }
  }

  // Sort by date ascending, then by shift order within the day.
  out.sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? -1 : 1;
    return compareShift(a.shift, b.shift);
  });

  return out;
}

/**
 * Generate "Create Order" options: for each shift in [today .. today+horizonDays],
 * indicate whether we can still add (i.e., shift NOT started yet).
 */
export function getCreateOrderOptions(
  now: Date = new Date(),
  horizonDays: number = 1
): Array<{ dateISO: string; shift: ShiftName; canAdd: boolean }> {
  const out: Array<{ dateISO: string; shift: ShiftName; canAdd: boolean }> = [];
  const startDay = startOfDayLocal(now);

  for (let d = 0; d <= horizonDays; d++) {
    const date = addDaysLocal(startDay, d);
    const dateISO = toDateISO(date);
    for (const shift of SHIFTS) {
      const canAdd = !isShiftStarted(date, shift, now);
      out.push({ dateISO, shift, canAdd });
    }
  }

  // Sort by date asc, then UI-friendly display order (Morning, Afternoon, Evening, Night).
  const idx: Record<ShiftName, number> = {
    Morning: 0, Afternoon: 1, Evening: 2, Night: 3,
  } as const;
  out.sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? -1 : 1;
    return idx[a.shift] - idx[b.shift];
  });

  return out;
}
