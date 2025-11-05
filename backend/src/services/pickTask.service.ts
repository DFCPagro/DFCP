// src/services/pickerTask.service.ts


//mohamad


import mongoose, { Types } from "mongoose";
import PickerTask, {
  PickerTaskStatus,
  ShiftName,
} from "../models/PickerTasks.model";

/* ------------------------------------------------------------------ */
/* -------------------------- Type helpers -------------------------- */
/* ------------------------------------------------------------------ */

export type CreatePickerTaskInput = {
  logisticCenterId: string;
  orderId: string;
  shiftName: ShiftName;
  shiftDate: string; // yyyy-LL-dd
  boxNo: number;
  boxType: string;
  contents: Array<{
    itemId: string;
    name: string;
    estWeightKgPiece?: number | null;
    estUnitsPiece?: number | null;
    liters?: number | null;
  }>;
  totals?: { kg?: number; units?: number; liters?: number };
  createdByUserId: string;
  notes?: string;
  priority?: number;
};

export type UpdateProgressInput = {
  placedKg?: number;
  placedUnits?: number;
  currentStepIndex?: number;
  finish?: boolean;
  userId: string;
};

type Id = string;

/**
 * Minimal lean doc shape this service consumes.
 * We keep it SMALL to avoid fighting inferred schema types.
 */
export interface PickerTaskLean {
  _id: Types.ObjectId;
  status: PickerTaskStatus;
  priority: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  assignedPickerUserId?: Types.ObjectId | null;
  // include keys we filter by in some queries (optional on lean type)
  logisticCenterId?: Types.ObjectId;
  shiftDate?: string;
  shiftName?: ShiftName;
}

/* ------------------------------------------------------------------ */
/* ----------------------- Internal guardrails ---------------------- */
/* ------------------------------------------------------------------ */

const ensureNonEmptyContents = (contents: unknown[]) => {
  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error("contents must be a non-empty array");
  }
};

const toObjectId = (id: string) => new Types.ObjectId(id);

const assertTransition = (from: PickerTaskStatus, to: PickerTaskStatus) => {
  const allowed: Record<PickerTaskStatus, PickerTaskStatus[]> = {
    open: ["ready", "cancelled"],
    ready: ["claimed", "cancelled", "problem"],
    claimed: ["in_progress", "problem", "cancelled"],
    in_progress: ["done", "problem", "cancelled"],
    done: [],
    problem: ["ready", "cancelled"],
    cancelled: [],
  };
  if (!allowed[from]?.includes(to)) {
    throw new Error(`Illegal status transition: ${from} → ${to}`);
  }
};

/* ------------------------------------------------------------------ */
/* --------------------------- CRUD & flows ------------------------- */
/* ------------------------------------------------------------------ */

export async function createPickerTask(input: CreatePickerTaskInput) {
  ensureNonEmptyContents(input.contents);

  const totals = {
    totalEstKg: input.totals?.kg ?? 0,
    totalEstUnits: input.totals?.units ?? 0,
    totalLiters: input.totals?.liters ?? 0,
  };

  const task = await PickerTask.create({
    logisticCenterId: toObjectId(input.logisticCenterId),
    orderId: toObjectId(input.orderId),
    shiftName: input.shiftName,
    shiftDate: input.shiftDate,
    boxNo: input.boxNo,
    boxType: input.boxType,
    contents: input.contents.map((c: CreatePickerTaskInput["contents"][number]) => ({
      itemId: toObjectId(c.itemId),
      name: c.name,
      estWeightKgPiece: c.estWeightKgPiece ?? null,
      estUnitsPiece: c.estUnitsPiece ?? null,
      liters: c.liters ?? null,
    })),
    ...totals,
    status: "open" as PickerTaskStatus,
    priority: input.priority ?? 0,
    // TS thinks ObjectId; DB allows null. We'll use .set when changing later.
    assignedPickerUserId: null,
    progress: {
      currentStepIndex: 0,
      placedKg: 0,
      placedUnits: 0,
      startedAt: null,
      finishedAt: null,
    },
    createdByUserId: toObjectId(input.createdByUserId),
    notes: input.notes ?? "",
    historyAuditTrail: [],
  });

  task.addAudit(task.createdByUserId, "create", "Task created");
  await task.save();

  return task.toJSON();
}

export async function getTaskById(taskId: Id) {
  const t = await PickerTask.findById(taskId).lean<PickerTaskLean>();
  if (!t) throw new Error("Task not found");
  return t;
}

export async function listTasksForShift(params: {
  logisticCenterId: Id;
  shiftDate: string;
  shiftName: ShiftName;
  statuses?: PickerTaskStatus[];
  limit?: number;
}) {
  const { logisticCenterId, shiftDate, shiftName, statuses, limit } = params;
  const q: Record<string, unknown> = {
    logisticCenterId: toObjectId(logisticCenterId),
    shiftDate,
    shiftName,
  };
  if (statuses?.length) q.status = { $in: statuses };

  return PickerTask.find(q)
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit ?? 200)
    .lean<PickerTaskLean[]>();
}

export async function setPriority(taskId: Id, priority: number, userId: Id) {
  const task = await PickerTask.findByIdAndUpdate(
    taskId,
    { $set: { priority } },
    { new: true }
  );
  if (!task) throw new Error("Task not found");
  task.addAudit(toObjectId(userId), "set_priority", `priority=${priority}`);
  await task.save();
  return task.toJSON();
}

export async function reassign(taskId: Id, pickerUserId: Id | null, actorUserId: Id) {
  const task = await PickerTask.findById(taskId);
  if (!task) throw new Error("Task not found");

  // Use path-based set to satisfy TS (property is typed ObjectId; DB allows null)
  task.set("assignedPickerUserId", pickerUserId ? toObjectId(pickerUserId) : null);
  task.addAudit(
    toObjectId(actorUserId),
    "reassign",
    pickerUserId ? `assigned to ${pickerUserId}` : "unassigned"
  );
  await task.save();
  return task.toJSON();
}

/* ------------------------ Status transitions ------------------------ */

export async function moveToReady(taskId: Id, userId: Id) {
  const task = await PickerTask.findById(taskId);
  if (!task) throw new Error("Task not found");
  assertTransition(task.status, "ready");
  task.status = "ready";
  task.addAudit(toObjectId(userId), "move_ready", "Task approved for pickers");
  await task.save();
  return task.toJSON();
}

export async function claimTask(taskId: Id, pickerUserId: Id) {
  const task = await PickerTask.findOneAndUpdate(
    {
      _id: toObjectId(taskId),
      status: "ready",
      assignedPickerUserId: null,
    },
    {
      $set: {
        status: "claimed",
        assignedPickerUserId: toObjectId(pickerUserId),
        "progress.startedAt": new Date(),
      },
    },
    { new: true }
  );

  if (!task) throw new Error("Task not found or not claimable");

  task.addAudit(toObjectId(pickerUserId), "claim", "Task claimed");
  await task.save();
  return task.toJSON();
}

export async function claimNextReady(params: {
  logisticCenterId: Id;
  shiftDate: string;
  shiftName: ShiftName;
  pickerUserId: Id;
}) {
  const { logisticCenterId, shiftDate, shiftName, pickerUserId } = params;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const task = await PickerTask.findOneAndUpdate(
      {
        logisticCenterId: toObjectId(logisticCenterId),
        shiftDate,
        shiftName,
        status: "ready",
        assignedPickerUserId: null,
      },
      {
        $set: {
          status: "claimed",
          assignedPickerUserId: toObjectId(pickerUserId),
          "progress.startedAt": new Date(),
        },
      },
      { new: true, sort: { priority: -1, createdAt: -1 }, session }
    );

    if (!task) throw new Error("No ready task available to claim");

    task.addAudit(toObjectId(pickerUserId), "claim", "Claimed next ready task");
    await task.save({ session });

    await session.commitTransaction();
    return task.toJSON();
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

export async function startPicking(taskId: Id, userId: Id) {
  const task = await PickerTask.findById(taskId);
  if (!task) throw new Error("Task not found");
  if (String(task.assignedPickerUserId ?? "") !== String(userId)) {
    throw new Error("Only the assigned picker can start this task");
  }
  assertTransition(task.status, "in_progress");
  task.status = "in_progress";

  // Ensure progress exists before setting nested fields
  if (!task.get("progress")) {
    task.set("progress", {
      currentStepIndex: 0,
      placedKg: 0,
      placedUnits: 0,
      startedAt: new Date(),
      finishedAt: null,
    });
  } else if (!task.get("progress.startedAt")) {
    task.set("progress.startedAt", new Date());
  }

  task.addAudit(toObjectId(userId), "start_picking");
  await task.save();
  return task.toJSON();
}

export async function updateProgress(taskId: Id, input: UpdateProgressInput) {
  const task = await PickerTask.findById(taskId);
  if (!task) throw new Error("Task not found");
  if (!["claimed", "in_progress"].includes(task.status)) {
    throw new Error("Cannot update progress unless task is claimed/in_progress");
  }

  // Ensure progress object exists
  if (!task.get("progress")) {
    task.set("progress", {
      currentStepIndex: 0,
      placedKg: 0,
      placedUnits: 0,
      startedAt: null,
      finishedAt: null,
    });
  }

  if (input.currentStepIndex != null) task.set("progress.currentStepIndex", input.currentStepIndex);
  if (input.placedKg != null) task.set("progress.placedKg", input.placedKg);
  if (input.placedUnits != null) task.set("progress.placedUnits", input.placedUnits);

  if (task.status === "claimed") {
    assertTransition("claimed", "in_progress");
    task.status = "in_progress";
    if (!task.get("progress.startedAt")) task.set("progress.startedAt", new Date());
  }

  if (input.finish) {
    assertTransition(task.status, "done");
    task.status = "done";
    task.set("progress.finishedAt", new Date());
  }

  task.addAudit(toObjectId(input.userId), "progress_update", "", {
    placedKg: task.get("progress.placedKg"),
    placedUnits: task.get("progress.placedUnits"),
    currentStepIndex: task.get("progress.currentStepIndex"),
    status: task.status,
  });

  await task.save();
  return task.toJSON();
}

export async function finishTask(taskId: Id, userId: Id, note?: string) {
  const task = await PickerTask.findById(taskId);
  if (!task) throw new Error("Task not found");
  assertTransition(task.status, "done");
  task.status = "done";
  task.set("progress.finishedAt", new Date()); // safe even if progress was missing
  task.addAudit(toObjectId(userId), "finish", note ?? "Finished picking");
  await task.save();
  return task.toJSON();
}

export async function flagProblem(taskId: Id, userId: Id, note?: string, meta?: unknown) {
  const task = await PickerTask.findById(taskId);
  if (!task) throw new Error("Task not found");
  if (!["open", "ready", "claimed", "in_progress", "problem"].includes(task.status)) {
    throw new Error(`Cannot flag problem from status ${task.status}`);
  }
  if (task.status !== "problem") {
    task.status = "problem";
  }
  task.addAudit(toObjectId(userId), "flag_problem", note ?? "", meta);
  await task.save();
  return task.toJSON();
}

export async function returnProblemToReady(taskId: Id, userId: Id, note?: string) {
  const task = await PickerTask.findById(taskId);
  if (!task) throw new Error("Task not found");
  assertTransition(task.status, "ready");
  task.status = "ready";
  // Unassign via path-based set to allow null
  task.set("assignedPickerUserId", null);
  task.addAudit(toObjectId(userId), "problem_resolved", note ?? "Returned to ready");
  await task.save();
  return task.toJSON();
}

export async function cancelTask(taskId: Id, userId: Id, note?: string) {
  const task = await PickerTask.findById(taskId);
  if (!task) throw new Error("Task not found");
  if (["done", "cancelled"].includes(task.status)) {
    throw new Error(`Task already terminal: ${task.status}`);
  }
  assertTransition(task.status, "cancelled");
  task.status = "cancelled";
  task.addAudit(toObjectId(userId), "cancel", note ?? "");
  await task.save();
  return task.toJSON();
}

/* ------------------------------------------------------------------ */
/* ----------------------------- Bulk ops --------------------------- */
/* ------------------------------------------------------------------ */

export async function bulkCreatePickerTasks(
  items: CreatePickerTaskInput[],
  actorUserId?: Id
) {
  if (!items.length) return [];

  const docs = items.map((input: CreatePickerTaskInput) => {
    ensureNonEmptyContents(input.contents);
    return {
      logisticCenterId: toObjectId(input.logisticCenterId),
      orderId: toObjectId(input.orderId),
      shiftName: input.shiftName,
      shiftDate: input.shiftDate,
      boxNo: input.boxNo,
      boxType: input.boxType,
      contents: input.contents.map(
        (c: CreatePickerTaskInput["contents"][number]) => ({
          itemId: toObjectId(c.itemId),
          name: c.name,
          estWeightKgPiece: c.estWeightKgPiece ?? null,
          estUnitsPiece: c.estUnitsPiece ?? null,
          liters: c.liters ?? null,
        })
      ),
      totalEstKg: input.totals?.kg ?? 0,
      totalEstUnits: input.totals?.units ?? 0,
      totalLiters: input.totals?.liters ?? 0,
      status: "open" as PickerTaskStatus,
      priority: input.priority ?? 0,
      assignedPickerUserId: null,
      progress: {
        currentStepIndex: 0,
        placedKg: 0,
        placedUnits: 0,
        startedAt: null,
        finishedAt: null,
      },
      createdByUserId: toObjectId(actorUserId ?? input.createdByUserId),
      notes: input.notes ?? "",
      historyAuditTrail: [],
    };
  });

  const created = await PickerTask.insertMany(docs);
  await Promise.all(
    created.map(async (t) => {
      t.addAudit(t.createdByUserId, "create", "Task created (bulk)");
      await t.save();
    })
  );
  return created.map((t) => t.toJSON());
}

export async function bulkCancelByOrder(orderId: Id, actorUserId: Id, note?: string) {
  const tasks = await PickerTask.find({
    orderId: toObjectId(orderId),
    status: { $nin: ["done", "cancelled"] },
  });

  if (!tasks.length) return 0;

  for (const t of tasks) {
    assertTransition(t.status, "cancelled");
    t.status = "cancelled";
    t.addAudit(
      toObjectId(actorUserId),
      "cancel",
      note ?? `Bulk cancel by order ${orderId}`
    );
  }
  await Promise.all(tasks.map((t) => t.save()));
  return tasks.length;
}

/* ------------------------------------------------------------------ */
/* ----------------------------- Reporting -------------------------- */
/* ------------------------------------------------------------------ */

export async function countReadyByShift(params: {
  logisticCenterId: Id;
  shiftDate: string;
  shiftName: ShiftName;
}) {
  const { logisticCenterId, shiftDate, shiftName } = params;
  const count = await PickerTask.countDocuments({
    logisticCenterId: toObjectId(logisticCenterId),
    shiftDate,
    shiftName,
    status: "ready",
  });
  return { count };
}

export async function summarizeShiftQueue(params: {
  logisticCenterId: Id;
  shiftDate: string;
  shiftName: ShiftName;
}) {
  const { logisticCenterId, shiftDate, shiftName } = params;

  const tasks = await PickerTask.find({
    logisticCenterId: toObjectId(logisticCenterId),
    shiftDate,
    shiftName,
  })
    .sort({ status: 1, priority: -1, createdAt: -1 })
    .lean<PickerTaskLean[]>();

  const byStatus = tasks.reduce<Record<PickerTaskStatus, number>>(
    (acc: Record<PickerTaskStatus, number>, t: PickerTaskLean) => {
      const s = t.status;
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<PickerTaskStatus, number>
  );

  const topReady = tasks
    .filter((t: PickerTaskLean) => t.status === "ready")
    .sort((a: PickerTaskLean, b: PickerTaskLean) => {
      const byPriority = (b.priority ?? 0) - (a.priority ?? 0);
      if (byPriority !== 0) return byPriority;
      const aCreated = new Date(a.createdAt ?? 0).getTime();
      const bCreated = new Date(b.createdAt ?? 0).getTime();
      return bCreated - aCreated;
    })
    .slice(0, 10);

  return {
    totals: {
      count: tasks.length,
      byStatus,
    },
    topReady,
  };
}



// --- NEW: suggest-next helpers ---

/**
 * Suggest the top-priority READY task across ANY shift for a given LC.
 * Non-mutating (does not claim).
 */
export async function suggestBestReadyAnyShift(logisticCenterId: Id) {
  const task = await PickerTask.find({
    logisticCenterId: toObjectId(logisticCenterId),
    status: "ready" as PickerTaskStatus,
  })
    .sort({ priority: -1, createdAt: -1 })
    .limit(1)
    .lean<PickerTaskLean[]>()
    .exec();

  return task[0] ?? null;
}

/**
 * Suggest the top-priority READY task for a given LC and optional shift scope.
 * - With shiftDate + shiftName: uses indexed list and returns top one.
 * - Without them: falls back to ANY shift (most recent, highest priority).
 * Non-mutating (does not claim).
 */
export async function suggestNextTask(params: {
  logisticCenterId: Id;
  shiftDate?: string;
  shiftName?: ShiftName;
}) {
  const { logisticCenterId, shiftDate, shiftName } = params;

  if (shiftDate && shiftName) {
    const tasks = await listTasksForShift({
      logisticCenterId,
      shiftDate,
      shiftName,
      statuses: ["ready"],
      limit: 1,
    });
    return tasks[0] ?? null;
  }

  return suggestBestReadyAnyShift(logisticCenterId);
}
