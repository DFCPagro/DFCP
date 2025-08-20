import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ===== Static data ===== */
export type Shift = {
  name: "Morning" | "Afternoon" | "Evening" | "Night";
  start: string;
  end: string;
};
export const SHIFTS: Shift[] = [
  { name: "Morning", start: "07:00", end: "09:00" },
  { name: "Afternoon", start: "12:00", end: "13:00" },
  { name: "Evening", start: "18:00", end: "19:00" },
  { name: "Night", start: "21:00", end: "23:00" },
];

// Map: Morning(3), Afternoon(2), Evening(1), Night(0)
export const bitForShiftIndex = (idx: number) => 1 << (3 - idx);

export type MonthSchedule = {
  year: number;
  month: number; // 1..12
  days: number[]; // bitmask per day
  createdAt: number;
};

const daysInMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate();
export const monthName = (m1: number) =>
  new Date(2000, m1 - 1, 1).toLocaleString(undefined, { month: "long" });

export const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const suf = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suf}`;
};

const keyForMonth = (y: number, m1: number) =>
  `demo_month_schedule_${y}_${String(m1).padStart(2, "0")}`;

const defaultPatternByDow = () => {
  // Sun..Sat bitmasks (0..6)
  const p = [0, 0, 0, 0, 0, 0, 0];
  // Mon–Thu = Morning + Afternoon
  const morn = bitForShiftIndex(0);
  const aft = bitForShiftIndex(1);
  p[1] = morn | aft; // Mon
  p[2] = p[1]; // Tue
  p[3] = p[1]; // Wed
  p[4] = p[1]; // Thu
  p[5] = bitForShiftIndex(0); // Fri Morning
  p[6] = bitForShiftIndex(3); // Sat Night
  // Sun off (0)
  return p;
};

const buildMonthFromPattern = (
  y: number,
  m1: number,
  patternSunToSat: number[]
) => {
  const len = daysInMonth(y, m1);
  const arr = new Array<number>(len);
  for (let d = 1; d <= len; d++) {
    const dow = new Date(y, m1 - 1, d).getDay(); // 0..6
    arr[d - 1] = patternSunToSat[dow] || 0;
  }
  return arr;
};

export type ScheduleState = {
  // month store (keyed by YYYY_MM) persisted
  months: Record<string, MonthSchedule>;
  // weekly pattern memory (used to prefill the plan modal)
  weeklyPattern: number[]; // length 7, Sun..Sat

  ensureMonth: (y: number, m1: number) => MonthSchedule;
  getMonth: (y: number, m1: number) => MonthSchedule | undefined;
  saveMonth: (ms: MonthSchedule) => void;

  setWeeklyPattern: (arr: number[]) => void;
};

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      months: {},
      weeklyPattern: defaultPatternByDow(),

      ensureMonth: (y, m1) => {
        const key = keyForMonth(y, m1);
        const state = get();
        if (state.months[key]) return state.months[key];

        // seed with default weekday pattern
        const pattern =
          state.weeklyPattern?.length === 7
            ? state.weeklyPattern
            : defaultPatternByDow();
        const ms: MonthSchedule = {
          year: y,
          month: m1,
          days: buildMonthFromPattern(y, m1, pattern),
          createdAt: Date.now(),
        };
        set((s) => ({ months: { ...s.months, [key]: ms } }));
        return ms;
      },

      getMonth: (y, m1) => get().months[keyForMonth(y, m1)],

      saveMonth: (ms) =>
        set((s) => {
          const k = keyForMonth(ms.year, ms.month);
          const days = normalizeDays(ms.year, ms.month, ms.days);
          const next: MonthSchedule = {
            year: ms.year,
            month: ms.month,
            days,
            createdAt: ms.createdAt ?? Date.now(),
          };
          return { months: { ...s.months, [k]: next } };
        }),

      setWeeklyPattern: (arr) => set({ weeklyPattern: arr }),
    }),
    { name: "driver-schedule-demo" }
  )
);

/* ===== Helpers used by UI ===== */
export const shiftNamesFromMask = (mask: number) => {
  const out: string[] = [];
  for (let i = 0; i < SHIFTS.length; i++) {
    const bit = bitForShiftIndex(i);
    if (mask & bit) out.push(SHIFTS[i].name);
  }
  return out;
};

// add this near helpers
const normalizeDays = (y: number, m1: number, days: number[]) => {
  const len = daysInMonth(y, m1);
  if (days.length === len) return days;
  const copy = days.slice(0, len);
  while (copy.length < len) copy.push(0);
  return copy;
};

export const nextMonthOf = (date: Date) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
};

export const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const daysLong = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const fmtDate = (d: Date) =>
  d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

export const simpleChipsLabel = (mask: number) => {
  const count =
    (mask & 8 ? 1 : 0) +
    (mask & 4 ? 1 : 0) +
    (mask & 2 ? 1 : 0) +
    (mask & 1 ? 1 : 0);
  return count ? `${count} shift${count > 1 ? "s" : ""}` : "Off";
};
