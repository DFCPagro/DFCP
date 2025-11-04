// src/api/pickerTasks.ts
import { api } from "@/api/config";

/* =========================
 * Types
 * ========================= */

export type ShiftName = "morning" | "afternoon" | "evening" | "night";

export type PickerTaskStatus =
  | "open"
  | "ready"
  | "claimed"
  | "in_progress"
  | "problem"
  | "cancelled"
  | "done";

export type PickerTaskContent = {
  itemId: string;
  name: string;
  estWeightKgPiece: number | null;
  estUnitsPiece: number | null;
  liters: number | null;
};

export type PickerTaskProgress = {
  currentStepIndex: number;
  placedKg: number;
  placedUnits: number;
  startedAt: string | null;
  finishedAt: string | null;
};

export type PickerTask = {
  _id: string;
  logisticCenterId: string;
  shiftName: ShiftName;
  shiftDate: string; // yyyy-LL-dd
  orderId: string;
  boxNo: number;
  boxType: string;
  contents: PickerTaskContent[];
  totalEstKg: number;
  totalEstUnits: number;
  totalLiters: number;
  status: PickerTaskStatus;
  priority: number;
  assignedPickerUserId: string | null;
  progress: PickerTaskProgress;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

export type PickerTaskCountsByStatus = Partial<Record<PickerTaskStatus, number>>;

export interface PickerTaskListResponse {
  shift: {
    logisticCenterId: string;
    shiftName: ShiftName;
    shiftDate: string;
    tz?: string;
  };
  pagination: { page: number; limit: number; total: number };
  countsByStatus: PickerTaskCountsByStatus;
  items: PickerTask[];
}

/** Body for POST /picker-tasks/generate */
export interface GeneratePickerTasksBody {
  /** Optional override; server can also infer current shift */
  shiftName?: ShiftName | null;
  /** Optional override in 'yyyy-LL-dd' */
  shiftDate?: string | null;
  /** Optional; defaults in service to 0 */
  priority?: number;
  /** Optional; defaults in service to "packing_ready" */
  stageKey?: string;
  /** Optional; defaults to true */
  autoSetReady?: boolean;
}

export interface GeneratePickerTasksResult {
  createdCount: number;
  alreadyExisted: number;
  shiftName: ShiftName;
  shiftDate: string;
  tz: string;
  ordersProcessed: number;
  examples: PickerTask[];
}

/* =========================
 * Helpers
 * ========================= */

function ensureData<T>(res: { data?: any }, errMsg: string): T {
  // Controllers reply with { data: ... }
  if (!res?.data) throw new Error(errMsg);
  const payload = res.data.data ?? res.data;
  if (payload == null) throw new Error(errMsg);
  return payload as T;
}

/* =========================
 * API Calls
 * ========================= */

/**
 * Generate picker tasks for a shift.
 * Server takes logisticCenterId from the authenticated user.
 */
export async function generatePickerTasks(
  body: GeneratePickerTasksBody = {}
): Promise<GeneratePickerTasksResult> {
  const res = await api.post<{ data: GeneratePickerTasksResult }>(
    "/pickerTasks/generate",
    body
  );
  return ensureData<GeneratePickerTasksResult>(res, "Failed to generate picker tasks");
}

/**
 * List picker tasks for the *current* shift (server resolves current shift
 * unless you pass shiftName/shiftDate overrides).
 *
 * @param params.logisticCenterId - required
 * @param params.status - optional status filter
 * @param params.mine - if true, only tasks assigned to requester
 * @param params.page - pagination page (1-based)
 * @param params.limit - page size
 * @param params.shiftName - optional override
 * @param params.shiftDate - optional override (yyyy-LL-dd)
 */
export async function fetchPickerTasksForCurrentShift(params: {
  
  status?: PickerTaskStatus | string;
  mine?: boolean;
  page?: number;
  limit?: number;
  shiftName?: ShiftName;
  shiftDate?: string; // yyyy-LL-dd
}): Promise<PickerTaskListResponse> {
  const res = await api.get<{ data: PickerTaskListResponse }>("/pickerTasks/current", {
    params,
  });
  return ensureData<PickerTaskListResponse>(res, "Failed to load current shift picker tasks");
}

/**
 * List picker tasks for a specific shift (explicit name + date).
 *
 * @param params.logisticCenterId - required
 * @param params.shiftName - required
 * @param params.shiftDate - required (yyyy-LL-dd)
 * @param params.status - optional status filter
 * @param params.mine - if true, only tasks assigned to requester
 * @param params.page - pagination page (1-based)
 * @param params.limit - page size
 */


/*
export async function fetchPickerTasksForShift(params: {
  
  shiftName: ShiftName;
  shiftDate: string; // yyyy-LL-dd
  status?: PickerTaskStatus | string;
  mine?: boolean;
  page?: number;
  limit?: number;
}): Promise<PickerTaskListResponse> {
  const res = await api.get<{ data: PickerTaskListResponse }>("/pickerTasks/shift", {
    params,
  });
  return ensureData<PickerTaskListResponse>(res, "Failed to load picker tasks for shift");
}
*/
/* =========================
 * Convenience hooks (optional)
 * =========================
 * If you're using React Query, you can wrap the calls above in hooks in a separate file,
 * e.g., src/hooks/usePickerTasks.ts, but keeping the raw API module simple here.
 */
