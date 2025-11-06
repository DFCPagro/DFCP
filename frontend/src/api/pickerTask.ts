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

/** Matches your PackingPlan piece */
export type PlanPiece = {
  itemId: string;
  itemName?: string;
  pieceType: "bag" | "bundle";
  mode: "kg" | "unit";
  qtyKg?: number;
  units?: number;
  liters: number;
  estWeightKgPiece: number;
};

/** Matches your PackingPlan box */
export type PlanBox = {
  boxNo: number;
  boxType: string; // "Small" | "Medium" | "Large"
  vented?: boolean;

  estFillLiters: number;
  estWeightKg: number;
  fillPct: number;

  contents: PlanPiece[];
};

/** Matches your PackingPlan summary.byItem entry */
export type PlanSummaryItem = {
  itemId: string;
  itemName?: string;
  bags: number;
  bundles: number;
  totalKg?: number;
  totalUnits?: number;
};

/** Matches your PackingPlan summary */
export type PlanSummary = {
  totalBoxes: number;
  byItem: PlanSummaryItem[];
  warnings: string[];
};

/** Full plan stored on the task */
export type PickerTaskPlan = {
  boxes: PlanBox[];
  summary?: PlanSummary;
};

export type PickerTaskProgress = {
  currentBoxIndex?: number; // new (we set it in the service)
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

  // NEW: one task per order with full plan
  plan: PickerTaskPlan;

  // rollups across plan.boxes
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
  stageKey?: string; // not used anymore but kept for compat
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

/** Summary from GET /pickerTasks/shift/summary */
export type ShiftPickerTaskSummary = {
  shift: {
    logisticCenterId: string;
    shiftName: ShiftName;
    shiftDate: string;
  };
  totalTasks: number;
  counts: {
    open: number;
    ready: number;
    in_progress: number;
    problem: number;
  };
  ensure: {
    createdCount: number;
    alreadyExisted: number;
  };
};

/** Result from POST /pickerTasks/shift/claim-first */
export type ClaimFirstReadyTaskResult = {
  shift: {
    logisticCenterId: string;
    shiftName: ShiftName;
    shiftDate: string;
  };
  claimed: boolean;
  task: PickerTask | null;
};

/* =========================
 * Helpers
 * ========================= */

function ensureData<T>(axiosRes: any, errMsg: string): T {
  const root = axiosRes?.data;
  if (!root) throw new Error(errMsg);

  // { data: <T> }
  if ("data" in root) return root.data as T;

  // fallback (controller might return the object directly)
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
 * - ensure?: boolean (default true on server; pass false to skip ensuring)
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
  return ensureData<PickerTaskListResponse>(res, "Failed to load picker tasks for shift");
}

/** GET /api/pickerTasks/shift/summary */
export async function fetchShiftPickerTasksSummary(params: {
  shiftName: ShiftName;
  shiftDate: string; // yyyy-LL-dd
}): Promise<ShiftPickerTaskSummary> {
  const res = await api.get("/pickerTasks/shift/summary", { params });
  return ensureData<ShiftPickerTaskSummary>(res, "Failed to load shift picker task summary");
}

/** POST /api/pickerTasks/shift/claim-first (no body) */
export async function claimFirstReadyTaskForCurrentShift(): Promise<ClaimFirstReadyTaskResult> {
  const res = await api.post("/pickerTasks/shift/claim-first");
  return ensureData<ClaimFirstReadyTaskResult>(res, "Failed to claim a ready task");
}
