import { create } from "zustand"
import { persist } from "zustand/middleware"

/* ===== Static data ===== */
export type Shift = {
  name: "Morning" | "Afternoon" | "Evening" | "Night"
  start: string
  end: string
}
export const SHIFTS: Shift[] = [
  { name: "Morning", start: "07:00", end: "09:00" },
  { name: "Afternoon", start: "12:00", end: "13:00" },
  { name: "Evening", start: "18:00", end: "19:00" },
  { name: "Night", start: "21:00", end: "23:00" },
]

// Tri-state encoding per shift (2 bits)
export const SHIFT_STATE = { OFF: 0, STANDBY: 1, ON: 2 } as const
export type ShiftState = (typeof SHIFT_STATE)[keyof typeof SHIFT_STATE]

/** offset per shift index: we keep your original ordering (Morning..Night mapped to 3..0) */
const offsetFor = (shiftIdx: number) => (3 - shiftIdx) * 2

export const getShiftState = (mask: number, shiftIdx: number): ShiftState =>
  ((mask >> offsetFor(shiftIdx)) & 0b11) as ShiftState

export const setShiftState = (mask: number, shiftIdx: number, state: ShiftState) => {
  const off = offsetFor(shiftIdx)
  const cleared = mask & ~(0b11 << off)
  return cleared | ((state & 0b11) << off)
}

export const countPicked = (mask: number) => {
  let c = 0
  for (let i = 0; i < SHIFTS.length; i++) if (getShiftState(mask, i) !== SHIFT_STATE.OFF) c++
  return c
}
export const countOn = (mask: number) => {
  let c = 0
  for (let i = 0; i < SHIFTS.length; i++) if (getShiftState(mask, i) === SHIFT_STATE.ON) c++
  return c
}
export const countStandby = (mask: number) => {
  let c = 0
  for (let i = 0; i < SHIFTS.length; i++) if (getShiftState(mask, i) === SHIFT_STATE.STANDBY) c++
  return c
}

export const simpleChipsLabel = (mask: number) => {
  const on = countOn(mask)
  const s = countStandby(mask)
  if (on + s === 0) return "Off"
  if (s === 0) return `${on} on`
  if (on === 0) return `${s} standby`
  return `${on} on + ${s} S`
}

/* ===== Month model ===== */
export type MonthSchedule = {
  year: number
  month: number // 1..12
  days: number[] // tri-state encoded per day (2 bits per shift)
  createdAt: number
}

const daysInMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate()
export const monthName = (m1: number) =>
  new Date(2000, m1 - 1, 1).toLocaleString(undefined, { month: "long" })

const keyForMonth = (y: number, m1: number) => `demo_month_schedule_${y}_${String(m1).padStart(2, "0")}`

/** Compose a mask from 4 states (Morning..Night) */
const composeMask = (states: [ShiftState, ShiftState, ShiftState, ShiftState]) => {
  let mask = 0
  for (let i = 0; i < 4; i++) mask = setShiftState(mask, i, states[i])
  return mask
}

const defaultPatternByDow = () => {
  // Sun..Sat masks (0..6)
  const p = new Array<number>(7).fill(0)
  // Mon–Thu: Morning + Afternoon = ON
  const monThuMask = composeMask([SHIFT_STATE.ON, SHIFT_STATE.ON, SHIFT_STATE.OFF, SHIFT_STATE.OFF])
  p[1] = monThuMask // Mon
  p[2] = monThuMask // Tue
  p[3] = monThuMask // Wed
  p[4] = monThuMask // Thu
  // Fri Morning ON
  p[5] = composeMask([SHIFT_STATE.ON, SHIFT_STATE.OFF, SHIFT_STATE.OFF, SHIFT_STATE.OFF])
  // Sat Night STANDBY (example default)
  p[6] = composeMask([SHIFT_STATE.OFF, SHIFT_STATE.OFF, SHIFT_STATE.OFF, SHIFT_STATE.STANDBY])
  // Sun off
  p[0] = composeMask([SHIFT_STATE.OFF, SHIFT_STATE.OFF, SHIFT_STATE.OFF, SHIFT_STATE.OFF])
  return p
}

const buildMonthFromPattern = (y: number, m1: number, patternSunToSat: number[]) => {
  const len = daysInMonth(y, m1)
  const arr = new Array<number>(len)
  for (let d = 1; d <= len; d++) {
    const dow = new Date(y, m1 - 1, d).getDay()
    arr[d - 1] = patternSunToSat[dow] || 0
  }
  return arr
}

export type ScheduleState = {
  months: Record<string, MonthSchedule>
  weeklyPattern: number[] // 7 masks with tri-state
  ensureMonth: (y: number, m1: number) => MonthSchedule
  getMonth: (y: number, m1: number) => MonthSchedule | undefined
  saveMonth: (ms: MonthSchedule) => void
  setWeeklyPattern: (arr: number[]) => void
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      months: {},
      weeklyPattern: defaultPatternByDow(),

      ensureMonth: (y, m1) => {
        const key = keyForMonth(y, m1)
        const state = get()
        if (state.months[key]) return state.months[key]
        const pattern = state.weeklyPattern?.length === 7 ? state.weeklyPattern : defaultPatternByDow()
        const ms: MonthSchedule = {
          year: y,
          month: m1,
          days: buildMonthFromPattern(y, m1, pattern),
          createdAt: Date.now(),
        }
        set((s) => ({ months: { ...s.months, [key]: ms } }))
        return ms
      },

      getMonth: (y, m1) => get().months[keyForMonth(y, m1)],

      saveMonth: (ms) =>
        set((s) => {
          const len = daysInMonth(ms.year, ms.month)
          const days = ms.days.length === len ? ms.days : [...ms.days.slice(0, len), ...Array(Math.max(0, len - ms.days.length)).fill(0)]
          const k = keyForMonth(ms.year, ms.month)
          return { months: { ...s.months, [k]: { ...ms, days, createdAt: ms.createdAt ?? Date.now() } } }
        }),

      setWeeklyPattern: (arr) => set({ weeklyPattern: arr }),
    }),
    { name: "driver-schedule-demo" }
  )
)

/* ===== Other helpers you already use ===== */

// Back-compat helper for older components that import shiftNamesFromMask.
// By default it returns ON + STANDBY (mark standby with " (S)").
export const shiftNamesFromMask = (
  mask: number,
  opts?: { includeStandby?: boolean; markStandby?: boolean }
): string[] => {
  const includeStandby = opts?.includeStandby ?? true
  const markStandby = opts?.markStandby ?? true
  const out: string[] = []

  for (let i = 0; i < SHIFTS.length; i++) {
    const st = getShiftState(mask, i)
    if (st === SHIFT_STATE.ON) {
      out.push(SHIFTS[i].name)
    } else if (includeStandby && st === SHIFT_STATE.STANDBY) {
      out.push(markStandby ? `${SHIFTS[i].name} (S)` : SHIFTS[i].name)
    }
  }
  return out
}


export const nextMonthOf = (date: Date) => {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  return m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
}

export const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
export const daysLong = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
