// src/services/schedule.service.ts
import { Types } from "mongoose";
import { DateTime } from "luxon";

import Schedule, { type ScheduleDoc } from "../models/schedule.model";
import ApiError from "@/utils/ApiError";
import {
  getCurrentShift,
  getShiftConfigByKey,
  type ShiftName,
} from "./shiftConfig.service";

export type IdLike = string | Types.ObjectId;

const toOID = (v: IdLike): Types.ObjectId =>
  v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));

export type ScheduleType = "active" | "standby";

const SCHEDULE_FIELD_MAP: Record<
  ScheduleType,
  "activeSchedule" | "standBySchedule"
> = {
  active: "activeSchedule",
  standby: "standBySchedule",
};

const DEFAULT_TZ = "Asia/Jerusalem";

// Basic bitmask mapping for shifts: 4 shifts per day (can be adjusted if needed)
const SHIFT_BITMASK: Record<string, number> = {
  morning: 1 << 0,
  afternoon: 1 << 1,
  evening: 1 << 2,
  night: 1 << 3,
};

type MonthScheduleEntry = {
  month: string; // "YYYY-MM"
  bitmap: number[];
};

/* -------------------------------------------------------------------------- */
/*                                Helper utils                                */
/* -------------------------------------------------------------------------- */

function normalizeMonth(raw: string): string {
  const month = String(raw).trim();
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) {
    throw new ApiError(400, `Invalid month format '${raw}', expected YYYY-MM`);
  }
  const year = Number(m[1]);
  const monthNum = Number(m[2]);
  if (monthNum < 1 || monthNum > 12) {
    throw new ApiError(
      400,
      `Invalid month value '${raw}', month must be 01-12`
    );
  }
  if (!Number.isFinite(year) || year < 1970 || year > 9999) {
    throw new ApiError(400, `Invalid year in month '${raw}'`);
  }
  // Normalized as yyyy-MM with zero-padded month
  return `${year.toString().padStart(4, "0")}-${monthNum
    .toString()
    .padStart(2, "0")}`;
}

function validateBitmap(bitmap: unknown): asserts bitmap is number[] {
  if (!Array.isArray(bitmap) || bitmap.length === 0) {
    throw new ApiError(400, "bitmap must be a non-empty array of integers");
  }
  for (const v of bitmap) {
    if (!Number.isInteger(v) || v < 0 || v > 15) {
      throw new ApiError(400, "bitmap must contain only non-negative integers");
    }
  }
}

function getMonthEntry(
  doc: ScheduleDoc,
  scheduleType: ScheduleType,
  month: string
): MonthScheduleEntry | undefined {
  const field = SCHEDULE_FIELD_MAP[scheduleType];
  const arr = (doc as any)[field] as MonthScheduleEntry[] | undefined;
  if (!Array.isArray(arr)) return undefined;
  return arr.find((e) => e.month === month);
}

function getOrCreateMonthEntry(
  doc: ScheduleDoc,
  scheduleType: ScheduleType,
  month: string
): { entry: MonthScheduleEntry; container: MonthScheduleEntry[] } {
  const field = SCHEDULE_FIELD_MAP[scheduleType];
  const arr = ((doc as any)[field] ?? []) as MonthScheduleEntry[];
  if (!Array.isArray((doc as any)[field])) {
    (doc as any)[field] = arr;
  }

  let entry = arr.find((e) => e.month === month);
  if (!entry) {
    entry = { month, bitmap: [] };
    arr.push(entry);
  }

  return { entry, container: arr };
}

/**
 * Enforces the "2 weeks rule":
 * - For every *changed* day between oldBitmap and newBitmap,
 *   if that calendar day is inside the next 14 days (in tz),
 *   we reject the update unless allowInsideTwoWeeks=true.
 */
function enforceTwoWeekRuleForMonthUpdate(opts: {
  oldBitmap: number[];
  newBitmap: number[];
  month: string; // "YYYY-MM"
  tz?: string;
  allowInsideTwoWeeks?: boolean;
}) {
  const {
    oldBitmap,
    newBitmap,
    month,
    tz = DEFAULT_TZ,
    allowInsideTwoWeeks = false,
  } = opts;

  const now = DateTime.now().setZone(tz);
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);

  const maxLen = Math.max(oldBitmap.length, newBitmap.length);

  for (let i = 0; i < maxLen; i++) {
    const prev = oldBitmap[i] ?? 0;
    const next = newBitmap[i] ?? 0;
    if (prev === next) continue;

    const day = i + 1;
    const dayDt = DateTime.fromObject(
      { year, month: monthNum, day },
      { zone: tz }
    );

    if (!dayDt.isValid) {
      throw new ApiError(
        400,
        `Invalid day index ${day} for month '${month}' when enforcing two-week rule`
      );
    }

    const diffDays = dayDt.diff(now, "days").days;
    if (!allowInsideTwoWeeks && diffDays >= 0 && diffDays < 14) {
      throw new ApiError(
        403,
        "Changes inside the next 14 days require manager approval"
      );
    }
  }
}

function valueForDay(
  entry: MonthScheduleEntry | undefined,
  dayIndex: number
): number {
  if (!entry) return 0;
  return entry.bitmap[dayIndex] ?? 0;
}

/* -------------------------------------------------------------------------- */
/*                        Core document ensure / helpers                       */
/* -------------------------------------------------------------------------- */

async function ensureScheduleDoc(params: {
  userId: IdLike;
  role: string;
  logisticCenterId?: IdLike | null;
}): Promise<ScheduleDoc> {
  const { userId, role, logisticCenterId } = params;

  const userOID = toOID(userId);
  const filter: any = { userId: userOID };

  if (logisticCenterId) {
    filter.logisticCenterId = toOID(logisticCenterId);
  }

  let doc = await Schedule.findOne(filter).exec();
  if (doc) return doc;

  const payload: any = {
    userId: userOID,
    role,
    activeSchedule: [],
    standBySchedule: [],
  };

  if (logisticCenterId) {
    payload.logisticCenterId = toOID(logisticCenterId);
  }

  doc = new Schedule(payload);
  await doc.save();
  return doc;
}

/* -------------------------------------------------------------------------- */
/*                                Public services                             */
/* -------------------------------------------------------------------------- */

/**
 * Add (or overwrite) a monthly schedule bitmap for a user.
 * - Creates the Schedule document if missing.
 * - By default, if the month already exists for that scheduleType, it throws 409.
 *   You can pass overwriteExisting=true to allow overwriting.
 */
export async function addMonthlySchedule(params: {
  userId: IdLike;
  role: string;
  logisticCenterId?: IdLike | null;
  month: string; // "YYYY-MM"
  scheduleType: ScheduleType;
  bitmap: number[];
  overwriteExisting?: boolean;
}) {
  const {
    userId,
    role,
    logisticCenterId,
    month,
    scheduleType,
    bitmap,
    overwriteExisting = false,
  } = params;

  const normalizedMonth = normalizeMonth(month);
  validateBitmap(bitmap);

  const doc = await ensureScheduleDoc({ userId, role, logisticCenterId });
  const field = SCHEDULE_FIELD_MAP[scheduleType];
  const arr = ((doc as any)[field] ?? []) as MonthScheduleEntry[];
  if (!Array.isArray((doc as any)[field])) {
    (doc as any)[field] = arr;
  }

  const existingIndex = arr.findIndex((e) => e.month === normalizedMonth);

  if (existingIndex >= 0 && !overwriteExisting) {
    throw new ApiError(
      409,
      `Schedule for month '${normalizedMonth}' already exists for type '${scheduleType}'`
    );
  }

  if (existingIndex >= 0) {
    arr[existingIndex].bitmap = bitmap;
  } else {
    arr.push({ month: normalizedMonth, bitmap });
  }

  await doc.save();

  return {
    userId: doc.userId,
    role: doc.role,
    logisticCenterId: doc.logisticCenterId,
    scheduleType,
    month: normalizedMonth,
    bitmap,
  };
}

/**
 * Update an existing monthly schedule bitmap for a user.
 * - Managers can bypass the 14-day restriction; normal users may only change days 14+ days out.
 * - Caller (controller/route) is expected to decide who can bypass.
 */
export async function updateMonthlySchedule(params: {
  userId: IdLike;
  logisticCenterId?: IdLike | null;
  month: string;
  scheduleType: ScheduleType;
  bitmap: number[];
  tz?: string;
  canBypassTwoWeekRule?: boolean;
}) {
  const {
    userId,
    logisticCenterId,
    month,
    scheduleType,
    bitmap,
    tz,
    canBypassTwoWeekRule = false,
  } = params;

  const normalizedMonth = normalizeMonth(month);
  validateBitmap(bitmap);

  const userOID = toOID(userId);
  const filter: any = { userId: userOID };
  if (logisticCenterId) {
    filter.logisticCenterId = toOID(logisticCenterId);
  }

  const doc = await Schedule.findOne(filter).exec();
  if (!doc) {
    throw new ApiError(404, "Schedule document not found for user");
  }

  const field = SCHEDULE_FIELD_MAP[scheduleType];
  const arr = ((doc as any)[field] ?? []) as MonthScheduleEntry[];

  const existing = arr.find((e) => e.month === normalizedMonth);
  if (!existing) {
    throw new ApiError(
      404,
      `No existing ${scheduleType} schedule for month '${normalizedMonth}'`
    );
  }

  enforceTwoWeekRuleForMonthUpdate({
    oldBitmap: existing.bitmap ?? [],
    newBitmap: bitmap,
    month: normalizedMonth,
    tz,
    allowInsideTwoWeeks: canBypassTwoWeekRule,
  });

  existing.bitmap = bitmap;
  await doc.save();

  return {
    userId: doc.userId,
    role: doc.role,
    logisticCenterId: doc.logisticCenterId,
    scheduleType,
    month: normalizedMonth,
    bitmap,
  };
}

/**
 * Get the active & standby schedule bitmaps for a given user and month.
 * - If no doc or no entries exist, returns empty arrays.
 */
export async function getScheduleForUserMonth(params: {
  userId: IdLike;
  logisticCenterId?: IdLike | null;
  month: string;
}) {
  const { userId, logisticCenterId, month } = params;
  const normalizedMonth = normalizeMonth(month);

  const userOID = toOID(userId);
  const filter: any = { userId: userOID };
  if (logisticCenterId) {
    filter.logisticCenterId = toOID(logisticCenterId);
  }

  const doc = await Schedule.findOne(filter).lean<ScheduleDoc>().exec();

  if (!doc) {
    return {
      userId: userOID,
      role: null,
      logisticCenterId: logisticCenterId ? toOID(logisticCenterId) : null,
      month: normalizedMonth,
      active: [] as number[],
      standBy: [] as number[],
    };
  }

  const activeEntry = getMonthEntry(doc as any, "active", normalizedMonth);
  const standByEntry = getMonthEntry(doc as any, "standby", normalizedMonth);

  return {
    userId: (doc as any).userId,
    role: (doc as any).role ?? null,
    logisticCenterId: (doc as any).logisticCenterId ?? null,
    month: normalizedMonth,
    active: activeEntry?.bitmap ?? [],
    standBy: standByEntry?.bitmap ?? [],
  };
}

/**
 * Get the full schedule document by userId.
 * Optionally filter by month (only returning that month's active/standby bitmaps).
 */
export async function getScheduleByUserId(params: {
  userId: IdLike;
  month?: string;
}) {
  const { userId, month } = params;
  const userOID = toOID(userId);

  const doc = await Schedule.findOne({ userId: userOID }).lean().exec();
  if (!doc) {
    throw new ApiError(404, "Schedule document not found");
  }

  if (!month) {
    return doc;
  }

  const normalizedMonth = normalizeMonth(month);
  const activeEntry = getMonthEntry(doc as any, "active", normalizedMonth);
  const standByEntry = getMonthEntry(doc as any, "standby", normalizedMonth);

  return {
    userId: (doc as any).userId,
    role: (doc as any).role ?? null,
    logisticCenterId: (doc as any).logisticCenterId ?? null,
    month: normalizedMonth,
    active: activeEntry?.bitmap ?? [],
    standBy: standByEntry?.bitmap ?? [],
  };
}

/**
 * Get aggregated schedule snapshot for all workers of a given role
 * for a specific date and logistic center.
 *
 * Useful for "getSchedule(role, date, lc)".
 */
export async function getScheduleByRoleAndDate(params: {
  role: string;
  date: string; // "YYYY-MM-DD"
  logisticCenterId: IdLike;
}) {
  const { role, date, logisticCenterId } = params;

  const lcOID = toOID(logisticCenterId);
  const dt = DateTime.fromFormat(date, "yyyy-LL-dd", { zone: DEFAULT_TZ });
  if (!dt.isValid) {
    throw new ApiError(400, `Invalid date '${date}', expected YYYY-MM-DD`);
  }

  const month = `${dt.year.toString().padStart(4, "0")}-${dt.month
    .toString()
    .padStart(2, "0")}`;
  const dayIndex = dt.day - 1;

  const docs = await Schedule.find({ role, logisticCenterId: lcOID })
    .lean()
    .exec();

  const records = docs.map((doc: any) => {
    const activeEntry = getMonthEntry(doc, "active", month);
    const standByEntry = getMonthEntry(doc, "standby", month);

    return {
      userId: doc.userId,
      role: doc.role,
      logisticCenterId: doc.logisticCenterId,
      date,
      active: valueForDay(activeEntry, dayIndex),
      standBy: valueForDay(standByEntry, dayIndex),
    };
  });

  return {
    role,
    date,
    logisticCenterId: lcOID,
    month,
    dayIndex,
    records,
  };
}

/**
 * Get all workers assigned to a specific shift for a date/role/LC.
 *
 * This implements:
 *   getWorkersForShift(role, shift, date, shiftType, lcID)
 *
 * - shiftType maps to our ScheduleType ("active" | "standby").
 * - shift is compared against the bitmap using SHIFT_BITMASK.
 */
export async function getWorkersForShift(params: {
  role: string;
  shiftName: string; // "morning" | "afternoon" | "evening" | "night"
  date: string; // "YYYY-MM-DD"
  scheduleType: ScheduleType;
  logisticCenterId: IdLike;
}) {
  const { role, shiftName, date, scheduleType, logisticCenterId } = params;

  const mask = SHIFT_BITMASK[shiftName];
  if (!mask) {
    throw new ApiError(
      400,
      `Unknown shiftName '${shiftName}'. Expected one of ${Object.keys(
        SHIFT_BITMASK
      ).join(", ")}`
    );
  }

  const lcOID = toOID(logisticCenterId);
  const dt = DateTime.fromFormat(date, "yyyy-LL-dd", { zone: DEFAULT_TZ });
  if (!dt.isValid) {
    throw new ApiError(400, `Invalid date '${date}', expected YYYY-MM-DD`);
  }

  const month = `${dt.year.toString().padStart(4, "0")}-${dt.month
    .toString()
    .padStart(2, "0")}`;
  const dayIndex = dt.day - 1;

  const docs = await Schedule.find({ role, logisticCenterId: lcOID })
    .lean()
    .exec();

  const field = SCHEDULE_FIELD_MAP[scheduleType];

  const workers = (docs as any[]).filter((doc) => {
    const arr = (doc[field] ?? []) as MonthScheduleEntry[];
    const entry = arr.find((e) => e.month === month);
    if (!entry) return false;

    const value = valueForDay(entry, dayIndex);
    return (value & mask) !== 0;
  });

  return {
    role,
    date,
    shiftName,
    scheduleType,
    logisticCenterId: lcOID,
    workers: workers.map((w) => ({
      userId: w.userId,
      role: w.role,
      logisticCenterId: w.logisticCenterId,
    })),
  };
}

export async function getIsActiveNow(params: {
  userId: IdLike;
  logisticCenterId?: IdLike | null;
  month?: string;
}) {
  const { userId, logisticCenterId, month } = params;
  const shiftName = await getCurrentShift();
  const hasActiveShift = shiftName !== "none";

  // Use LC-specific timezone when available so day boundaries align with the shift window.
  let tz = DEFAULT_TZ;
  if (hasActiveShift && logisticCenterId) {
    try {
      const cfg = await getShiftConfigByKey({
        logisticCenterId: String(logisticCenterId),
        name: shiftName as Exclude<ShiftName, "none">,
      });
      tz = cfg.timezone || DEFAULT_TZ;
    } catch (err) {
      // ignore and fall back to default tz if config lookup fails
    }
  }

  const now = DateTime.now().setZone(tz);
  const normalizedMonth = normalizeMonth(month ?? now.toFormat("yyyy-LL"));
  const dayIndex = now.day - 1;
  const date = now.toFormat("yyyy-LL-dd");

  const userOID = toOID(userId);
  const filter: any = { userId: userOID };
  if (logisticCenterId) {
    filter.logisticCenterId = toOID(logisticCenterId);
  }

  const doc = await Schedule.findOne(filter).lean<ScheduleDoc>().exec();

  const activeEntry = doc
    ? getMonthEntry(doc as any, "active", normalizedMonth)
    : undefined;
  const standByEntry = doc
    ? getMonthEntry(doc as any, "standby", normalizedMonth)
    : undefined;

  const mask = hasActiveShift ? SHIFT_BITMASK[shiftName] ?? 0 : 0;
  const todayValue = valueForDay(activeEntry, dayIndex);
  const isActive = Boolean(mask && (todayValue & mask));

  return {
    userId: doc ? (doc as any).userId : userOID,
    role: doc ? (doc as any).role ?? null : null,
    logisticCenterId: doc
      ? (doc as any).logisticCenterId ?? null
      : logisticCenterId
      ? toOID(logisticCenterId)
      : null,
    month: normalizedMonth,
    date,
    shiftName,
    isActive,
    active: activeEntry?.bitmap ?? [],
    standBy: standByEntry?.bitmap ?? [],
  };
}
