// src/pages/planSchedule/utils/validatePlan.ts

/**
 * Plan validator for the "Plan Next Month" page (workers-only).
 *
 * Enforces:
 * 1) Max 2 active shifts per day
 * 2) Max 2 standby shifts per day
 * 3) If active = 2 ⇒ standby ≤ 1 and the combined selections must NOT contain any run of 3 consecutive slots
 * 4) If standby = 2 ⇒ active ≤ 1 and the combined selections must NOT contain any run of 3 consecutive slots
 *
 * Notes:
 * - Works with any slot count S >= 3 (e.g., 3 slots => Morning/Afternoon/Evening; or 4 slots => add Night).
 * - "Consecutive" means a linear run of length 3 within the same day (no wrap-around).
 * - The shape is fully UI-friendly: per-day errors + summary so you can highlight invalid days and disable submit.
 */

import { daysInMonth, type MonthIndex } from "@/utils/bitMapTranslator";

// ---------- Types ----------

/** A 2D boolean matrix [dayIndex][slotIndex] for a month. dayIndex = 0..dim-1 */
export type SlotMatrix = boolean[][];

export type DayErrorCode =
  | "MAX_ACTIVE_EXCEEDED"
  | "MAX_STANDBY_EXCEEDED"
  | "ACTIVE_EQ_2_STANDBY_GT_1"
  | "STANDBY_EQ_2_ACTIVE_GT_1"
  | "THREE_CONSECUTIVE_SELECTED";

export interface DayError {
  day: number; // 1..dim
  codes: DayErrorCode[];
  messages: string[]; // human-readable set for UI
}

export interface ValidatePlanOptions {
  year: number;
  month: MonthIndex; // 0..11
  slotCount: number; // e.g., 3 or 4 (>=3 required)
}

export interface ValidatePlanInput {
  active: SlotMatrix;
  standby: SlotMatrix;
}

export interface ValidatePlanResult {
  ok: boolean;
  days: {
    /** true if day is valid */
    valid: boolean;
    /** per-day error codes */
    codes: DayErrorCode[];
  }[];
  /** Flat list of day errors with messages (for a summary panel or toast) */
  errors: DayError[];
  /** Simple counts helpful for UI badges */
  summary: {
    invalidDayCount: number;
    totalDays: number;
  };
}

// ---------- Helpers ----------

function countTrue(row: boolean[]): number {
  let c = 0;
  for (let i = 0; i < row.length; i++) if (row[i]) c++;
  return c;
}

/**
 * Returns true if there exists any window of length 3 inside `combined`
 * that is fully selected (true, true, true). No wrap-around.
 */
function hasThreeConsecutive(combined: boolean[]): boolean {
  if (combined.length < 3) return false;
  for (let i = 0; i <= combined.length - 3; i++) {
    if (combined[i] && combined[i + 1] && combined[i + 2]) return true;
  }
  return false;
}

function ensureMatrixShape(
  matrix: SlotMatrix,
  days: number,
  slots: number
): SlotMatrix {
  const out: SlotMatrix = new Array(days);
  for (let d = 0; d < days; d++) {
    const row = matrix[d] ?? [];
    const fixed = new Array<boolean>(slots);
    for (let s = 0; s < slots; s++) fixed[s] = Boolean(row[s] ?? false);
    out[d] = fixed;
  }
  return out;
}

// ---------- Public API ----------

/**
 * Validate entire month plan across active + standby selections.
 * Returns per-day validity, a flat error list with friendly messages, and a summary.
 */
export function validatePlan(
  input: ValidatePlanInput,
  opts: ValidatePlanOptions
): ValidatePlanResult {
  const dim = daysInMonth(opts.year, opts.month);
  if (opts.slotCount < 3) {
    // Defensive: slotCount must be at least 3 to apply "three consecutive" logic
    throw new Error("validatePlan: slotCount must be >= 3");
  }

  const active = ensureMatrixShape(input.active, dim, opts.slotCount);
  const standby = ensureMatrixShape(input.standby, dim, opts.slotCount);

  const perDay = new Array<{ valid: boolean; codes: DayErrorCode[] }>(dim);
  const errors: DayError[] = [];

  for (let dayIdx = 0; dayIdx < dim; dayIdx++) {
    const aRow = active[dayIdx];
    const sRow = standby[dayIdx];

    const activeCount = countTrue(aRow);
    const standbyCount = countTrue(sRow);

    // Combine (union) to test consecutive runs across types
    const combined = new Array<boolean>(opts.slotCount);
    for (let s = 0; s < opts.slotCount; s++) combined[s] = aRow[s] || sRow[s];

    const dayCodes: DayErrorCode[] = [];

    // Core caps
    if (activeCount > 2) dayCodes.push("MAX_ACTIVE_EXCEEDED");
    if (standbyCount > 2) dayCodes.push("MAX_STANDBY_EXCEEDED");

    // Dependent caps
    if (activeCount === 2 && standbyCount > 1)
      dayCodes.push("ACTIVE_EQ_2_STANDBY_GT_1");
    if (standbyCount === 2 && activeCount > 1)
      dayCodes.push("STANDBY_EQ_2_ACTIVE_GT_1");

    // "Three consecutive" ban (window of length 3 fully selected)
    if (hasThreeConsecutive(combined)) {
      dayCodes.push("THREE_CONSECUTIVE_SELECTED");
    }

    const valid = dayCodes.length === 0;
    perDay[dayIdx] = { valid, codes: dayCodes };

    if (!valid) {
      errors.push({
        day: dayIdx + 1,
        codes: dayCodes,
        messages: toMessages(dayCodes),
      });
    }
  }

  const invalidDayCount = errors.length;

  return {
    ok: invalidDayCount === 0,
    days: perDay,
    errors,
    summary: {
      invalidDayCount,
      totalDays: dim,
    },
  };
}

/**
 * Validate just a single day (useful for inline validation as the user clicks).
 * Returns the same codes/messages as the full validator for that one day.
 */
export function validatePlanDay(
  activeRow: boolean[],
  standbyRow: boolean[],
  slotCount: number
): { valid: boolean; codes: DayErrorCode[]; messages: string[] } {
  if (slotCount < 3) throw new Error("validatePlanDay: slotCount must be >= 3");
  const a = new Array<boolean>(slotCount);
  const s = new Array<boolean>(slotCount);
  for (let i = 0; i < slotCount; i++) {
    a[i] = Boolean(activeRow[i] ?? false);
    s[i] = Boolean(standbyRow[i] ?? false);
  }

  const activeCount = countTrue(a);
  const standbyCount = countTrue(s);

  const combined = new Array<boolean>(slotCount);
  for (let i = 0; i < slotCount; i++) combined[i] = a[i] || s[i];

  const codes: DayErrorCode[] = [];
  if (activeCount > 2) codes.push("MAX_ACTIVE_EXCEEDED");
  if (standbyCount > 2) codes.push("MAX_STANDBY_EXCEEDED");
  if (activeCount === 2 && standbyCount > 1)
    codes.push("ACTIVE_EQ_2_STANDBY_GT_1");
  if (standbyCount === 2 && activeCount > 1)
    codes.push("STANDBY_EQ_2_ACTIVE_GT_1");
  if (hasThreeConsecutive(combined)) codes.push("THREE_CONSECUTIVE_SELECTED");

  return { valid: codes.length === 0, codes, messages: toMessages(codes) };
}

// ---------- Messaging ----------

function toMessages(codes: DayErrorCode[]): string[] {
  const msgs: string[] = [];
  for (const c of codes) {
    switch (c) {
      case "MAX_ACTIVE_EXCEEDED":
        msgs.push("Max 2 active shifts per day.");
        break;
      case "MAX_STANDBY_EXCEEDED":
        msgs.push("Max 2 standby shifts per day.");
        break;
      case "ACTIVE_EQ_2_STANDBY_GT_1":
        msgs.push("Active=2 ⇒ allow up to 1 standby only.");
        break;
      case "STANDBY_EQ_2_ACTIVE_GT_1":
        msgs.push("Standby=2 ⇒ allow up to 1 active only.");
        break;
      case "THREE_CONSECUTIVE_SELECTED":
        msgs.push("Three consecutive shifts in one day are not allowed.");
        break;
    }
  }
  return msgs;
}
