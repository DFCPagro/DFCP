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
  shiftName?: ShiftName | null;
  shiftDate?: string | null; // yyyy-LL-dd
  priority?: number; // default 0
  stageKey?: string; // default "packing_ready"
  autoSetReady?: boolean; // default true
}

/** Exact backend shape returned by POST /generate (matches service) */
export type GeneratePickerTasksResult = {
  createdCount: number;
  alreadyExisted: number;
  shiftName: ShiftName;
  shiftDate: string;
  tz: string;
  ordersProcessed: number;
  examples: PickerTask[]; // recent few for preview
};

/* =========================
 * Helpers
 * ========================= */

function ensureData<T>(axiosRes: any, errMsg: string): T {
  // Axios response: { data: <payload> }
  // Controller may return either:
  //  - { data: <T> }
  //  - { ensure: <summary>, data: <T> }
  const root = axiosRes?.data;
  if (!root) throw new Error(errMsg);

  // If the controller wrapped it as { data: <T> }
  if (root.data) return root.data as T;

  // If the controller returned { ensure, data }
  if (root.ensure && root.data) return root.data as T;

  // Otherwise treat whole root as T (fallback)
  return root as T;
}

/* =========================
 * API Calls
 * ========================= */

/** POST /api/pickerTasks/generate */
export async function generatePickerTasks(
  body: GeneratePickerTasksBody = {}
): Promise<GeneratePickerTasksResult> {
  const res = await api.post("/pickerTasks/generate", body);
  // Here controller replies with { data: GeneratePickerTasksResult }
  return ensureData<GeneratePickerTasksResult>(res, "Failed to generate picker tasks");
}

/**
 * GET /api/pickerTasks/shift
 * Supported filters:
 * - status?: PickerTaskStatus | string
 * - page?: number
 * - limit?: number
 * - assignedOnly?: boolean
 * - unassignedOnly?: boolean
 * - pickerUserId?: string
 * - ensure?: boolean (default true on the server; pass false to skip ensuring)
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
  ensure?: boolean;
}): Promise<PickerTaskListResponse> {
  const res = await api.get("/pickerTasks/shift", { params });
  // Controller returns either { ensure, data } or { data }
  return ensureData<PickerTaskListResponse>(res, "Failed to load picker tasks for shift");
}
