// src/api/schedule.ts
import { api } from "./config";
import type { ShiftName } from "@/api/shifts";

/* -------------------------------------------------------------------------- */
/*                              Common / Shared Types                         */
/* -------------------------------------------------------------------------- */

export type ScheduleType = "active" | "standby";

/** Bitmap for a single month: one integer per calendar day (0..15). */
export type ScheduleBitmap = number[];

/** "YYYY-MM" (e.g. "2025-11") */
export type MonthString = string;

/** "YYYY-MM-DD" (e.g. "2025-11-09") */
export type DateString = string;

/** Generic API response wrapper `{ data: T }` used by the schedule endpoints. */
export type ApiResponse<T> = { data: T };

/** Per-month compact schedule view (used by /schedule/my and /schedule/user?month). */
export interface UserMonthSchedule {
  userId: string;
  role: string | null;
  logisticCenterId: string | null;
  month: MonthString;
  active: ScheduleBitmap;
  standBy: ScheduleBitmap;
}

/** Result shape returned by create/update monthly schedule. */
export interface MonthlyScheduleResult {
  userId: string;
  role: string;
  logisticCenterId: string | null;
  scheduleType: ScheduleType;
  month: MonthString;
  bitmap: ScheduleBitmap;
}

/** Single month entry inside the raw Schedule document. */
export interface ScheduleMonthEntry {
  month: MonthString;
  bitmap: ScheduleBitmap;
}

/** Raw MongoDB Schedule document (when calling /schedule/user/:userId without month). */
export interface ScheduleDocument {
  _id: string;
  userId: string;
  role: string | null;
  logisticCenterId: string | null;
  activeSchedule: ScheduleMonthEntry[];
  standBySchedule: ScheduleMonthEntry[];
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/** Record for a single user when aggregating schedule by role/date. */
export interface ScheduleByRoleDateRecord {
  userId: string;
  role: string;
  logisticCenterId: string;
  date: DateString;
  active: number; // bitmask for that day
  standBy: number; // bitmask for that day
}

/** Response payload for /schedule/by-role. */
export interface ScheduleByRoleDateData {
  role: string;
  date: DateString;
  logisticCenterId: string;
  month: MonthString;
  dayIndex: number; // 0-based index of day in month (0 = 1st)
  records: ScheduleByRoleDateRecord[];
}

/** Single worker entry in /schedule/workers response. */
export interface WorkerForShift {
  userId: string;
  role: string;
  logisticCenterId: string;
}

/** Response payload for /schedule/workers. */
export interface WorkersForShiftData {
  role: string;
  date: DateString;
  shiftName: ShiftName;
  scheduleType: ScheduleType;
  logisticCenterId: string;
  workers: WorkerForShift[];
}

/* -------------------------------------------------------------------------- */
/*                        GET /schedule/my?month=YYYY-MM                     */
/* -------------------------------------------------------------------------- */

export interface GetMyScheduleParams {
  /** Month to fetch, in "YYYY-MM" format. */
  month: MonthString;
}

export type GetMyScheduleResponse = UserMonthSchedule;

/**
 * Get the logged-in user's schedule for a specific month.
 * Wraps GET /schedule/my?month=YYYY-MM
 */
export async function getMySchedule(
  params: GetMyScheduleParams
): Promise<GetMyScheduleResponse> {
  const res = await api.get<ApiResponse<UserMonthSchedule>>("/schedule/my", {
    params,
  });
  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*                   POST /schedule/month (create a month)                    */
/* -------------------------------------------------------------------------- */

export interface CreateMonthlySchedulePayload {
  /** "YYYY-MM" (e.g. "2025-11") */
  month: MonthString;
  /** Which schedule to set: active or standby. */
  scheduleType: ScheduleType;
  /** One integer per calendar day (0..15). */
  bitmap: ScheduleBitmap;

  /**
   * When true, existing month for this scheduleType is overwritten
   * instead of causing 409 Conflict.
   */
  overwriteExisting?: boolean;

  /** Manager-only: target user. Ignored for normal users. */
  userId?: string;
  /** Manager-only: role to associate with this schedule. */
  role?: string;
  /** Manager-only: override logistic center. */
  logisticCenterId?: string | null;
}

export type CreateMonthlyScheduleResponse = MonthlyScheduleResult;

/**
 * Create (or optionally overwrite) a monthly schedule bitmap.
 * Wraps POST /schedule/month
 */
export async function createMonthlySchedule(
  payload: CreateMonthlySchedulePayload
): Promise<CreateMonthlyScheduleResponse> {
  const res = await api.post<ApiResponse<MonthlyScheduleResult>>(
    "/schedule/month",
    payload
  );
  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*                   PATCH /schedule/month (update a month)                   */
/* -------------------------------------------------------------------------- */

export interface UpdateMonthlySchedulePayload {
  /** "YYYY-MM" (e.g. "2025-11") */
  month: MonthString;
  /** Which schedule to update: active or standby. */
  scheduleType: ScheduleType;
  /** Updated bitmap for the entire month. */
  bitmap: ScheduleBitmap;

  /** Manager-only: target user. Optional for managers, ignored for normal users. */
  userId?: string;
  /** Manager-only: override logistic center. */
  logisticCenterId?: string | null;
}

export type UpdateMonthlyScheduleResponse = MonthlyScheduleResult;

/**
 * Update an existing monthly schedule bitmap.
 * Enforces the two-week rule for non-managers.
 * Wraps PATCH /schedule/month
 */
export async function updateMonthlySchedule(
  payload: UpdateMonthlySchedulePayload
): Promise<UpdateMonthlyScheduleResponse> {
  const res = await api.patch<ApiResponse<MonthlyScheduleResult>>(
    "/schedule/month",
    payload
  );
  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*           GET /schedule/user/:userId?month=YYYY-MM (per-month view)        */
/* -------------------------------------------------------------------------- */

export interface GetUserMonthScheduleParams {
  userId: string;
  /** Month to fetch, in "YYYY-MM" format. */
  month: MonthString;
}

export type GetUserMonthScheduleResponse = UserMonthSchedule;

/**
 * Manager-focused helper to get a specific user's schedule for a month.
 * Wraps GET /schedule/user/:userId?month=YYYY-MM
 */
export async function getUserMonthSchedule(
  params: GetUserMonthScheduleParams
): Promise<GetUserMonthScheduleResponse> {
  const { userId, month } = params;
  const res = await api.get<ApiResponse<UserMonthSchedule>>(
    `/schedule/user/${userId}`,
    { params: { month } }
  );
  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*              GET /schedule/user/:userId (full schedule doc)                */
/* -------------------------------------------------------------------------- */

export interface GetUserFullScheduleParams {
  userId: string;
}

export type GetUserFullScheduleResponse = ScheduleDocument;

/**
 * Get the full Schedule document for a user (all months).
 * Wraps GET /schedule/user/:userId (without month query).
 */
export async function getUserFullSchedule(
  params: GetUserFullScheduleParams
): Promise<GetUserFullScheduleResponse> {
  const { userId } = params;
  const res = await api.get<ApiResponse<ScheduleDocument>>(
    `/schedule/user/${userId}`
  );
  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*       GET /schedule/by-role?role=&date=&logisticCenterId=...               */
/* -------------------------------------------------------------------------- */

export interface GetScheduleByRoleParams {
  /** Worker role key (e.g. "farmer", "picker", etc.). */
  role: string;
  /** Local LC date in "YYYY-MM-DD" format. */
  date: DateString;
  /** Optional LC override; if omitted, inferred from the authenticated user. */
  logisticCenterId?: string;
}

export type GetScheduleByRoleResponse = ScheduleByRoleDateData;

/**
 * Aggregate schedule bitmasks for all workers of a role on a given date.
 * Wraps GET /schedule/by-role
 */
export async function getScheduleByRole(
  params: GetScheduleByRoleParams
): Promise<GetScheduleByRoleResponse> {
  const res = await api.get<ApiResponse<ScheduleByRoleDateData>>(
    "/schedule/by-role",
    { params }
  );
  return res.data.data;
}

/* -------------------------------------------------------------------------- */
/*  GET /schedule/workers?role=&shift=&date=&scheduleType=&logisticCenterId=  */
/* -------------------------------------------------------------------------- */

export interface GetWorkersForShiftParams {
  /** Worker role key (e.g. "farmer"). */
  role: string;
  /** Shift name to query (morning | afternoon | evening | night). */
  shift: ShiftName;
  /** Local LC date in "YYYY-MM-DD" format. */
  date: DateString;
  /** Which schedule to consult: active or standby. */
  scheduleType: ScheduleType;
  /** Optional LC override; if omitted, inferred from the authenticated user. */
  logisticCenterId?: string;
}

export type GetWorkersForShiftResponse = WorkersForShiftData;

/**
 * Get workers assigned to a specific shift on a given date.
 * Wraps GET /schedule/workers
 */
export async function getWorkersForShift(
  params: GetWorkersForShiftParams
): Promise<GetWorkersForShiftResponse> {
  const res = await api.get<ApiResponse<WorkersForShiftData>>(
    "/schedule/workers",
    { params }
  );
  return res.data.data;
}
