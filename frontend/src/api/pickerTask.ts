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
  /** computed on the server via $addFields */
  isAssigned?: boolean;
  progress: PickerTaskProgress;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
};

export type PickerTaskCountsByStatus = Partial<Record<PickerTaskStatus, number>>;
export type PickerTaskCountsByAssignment = {
  assigned: number;
  unassigned: number;
};

export interface PickerTaskListResponse {
  shift: {
    logisticCenterId: string;
    shiftName: ShiftName;
    shiftDate: string;
    tz?: string;
  };
  pagination: { page: number; limit: number; total: number };
  countsByStatus: PickerTaskCountsByStatus;
  countsByAssignment: PickerTaskCountsByAssignment;
  items: PickerTask[];
}

/** Body for POST /pickerTasks/generate */
export interface GeneratePickerTasksBody {
  shiftName?: ShiftName | null; // optional override
  shiftDate?: string | null; // yyyy-LL-dd, optional override
  priority?: number; // default 0
  stageKey?: string; // default "packing_ready"
  autoSetReady?: boolean; // default true
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
 * List picker tasks for a specific shift (explicit name + date).
 * The server reads logisticCenterId from the authenticated user.
 *
 * Supported filters:
 * - status?: PickerTaskStatus | string
 * - page?: number
 * - limit?: number
 * - assignedOnly?: boolean  (mutually exclusive with unassignedOnly; if both true, assignedOnly wins)
 * - unassignedOnly?: boolean
 * - pickerUserId?: string   (overrides assignedOnly/unassignedOnly and returns tasks assigned to that user)
 */
export async function fetchPickerTasksForShift(params: {
  shiftName: ShiftName;
  shiftDate: string; // yyyy-LL-dd
  status?: PickerTaskStatus | string;
  page?: number;
  limit?: number;
  assignedOnly?: boolean;
  unassignedOnly?: boolean;
  pickerUserId?: string;
}): Promise<PickerTaskListResponse> {
  const res = await api.get<{ data: PickerTaskListResponse }>("/pickerTasks/shift", {
    params,
  });
  return ensureData<PickerTaskListResponse>(res, "Failed to load picker tasks for shift");
}
