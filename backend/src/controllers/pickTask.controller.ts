// FILE: src/controllers/pickTask.controller.ts
//
// Controller for pick task operations. Delegates to the
// PickTaskService and performs simple parameter extraction and
// response formatting.



///////////mohamad

import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";

// ⬇️ Keep your older imports on top; import the service under the same alias.
import * as PickTaskService from "../services/pickTask.service";
import { ShiftName, PickerTaskStatus } from "../models/PickerTasks.model";

/**
 * GET /pick-tasks/suggest?centerId=...&shiftDate=YYYY-MM-DD&shiftName=morning|afternoon|evening|night
 *
 * Suggest the top priority READY task.
 * - If shiftDate/shiftName provided → suggest within that shift.
 * - Else → suggest across any shift for that center.
 * Non-mutating: DOES NOT claim the task.
 */
export async function suggestTask(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const logisticCenterId =
      (req.query.centerId as string) || (req as any).user?.logisticCenterId;
    if (!logisticCenterId)
      throw new ApiError(400, "centerId query param required");

    const shiftDate = (req.query.shiftDate as string) || undefined;
    const shiftName = (req.query.shiftName as ShiftName) || undefined;

    const suggestion = await PickTaskService.suggestNextTask({
      logisticCenterId,
      shiftDate,
      shiftName,
    });

    res.json(suggestion || null);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /pick-tasks/:id/start
 *
 * Semantics:
 * - If task is READY and unassigned → claim for this user and start (in_progress).
 * - If task is CLAIMED by this user → start (in_progress).
 * - If task is IN_PROGRESS by this user → idempotent (returns task).
 * - If task is CLAIMED/IN_PROGRESS by another user → 409.
 */
export async function startTask(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || req.body.userId;
    if (!userId) throw new ApiError(400, "userId required");

    const task = await PickTaskService.getTaskById(id);
    if (!task) throw new ApiError(404, "Task not found");

    // READY → claim then start
    if (task.status === "ready" && !task.assignedPickerUserId) {
      const claimed = await PickTaskService.claimTask(id, userId);
      const started = await PickTaskService.startPicking(claimed._id.toString(), userId);
      return res.json(started);
    }

    // CLAIMED by this user → start
    if (task.status === "claimed") {
      if (String(task.assignedPickerUserId ?? "") !== String(userId)) {
        throw new ApiError(409, "Task is claimed by another user");
      }
      const started = await PickTaskService.startPicking(id, userId);
      return res.json(started);
    }

    // IN_PROGRESS by this user → idempotent
    if (task.status === "in_progress") {
      if (String(task.assignedPickerUserId ?? "") !== String(userId)) {
        throw new ApiError(409, "Task is in progress by another user");
      }
      return res.json(task);
    }

    // Other states are not startable
    throw new ApiError(409, `Cannot start task from status ${task.status}`);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /pick-tasks/:id/complete
 *
 * Marks the task as DONE. If already DONE, returns as-is.
 */
export async function completeTask(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = req.params;

    const current = await PickTaskService.getTaskById(id);
    if (!current) throw new ApiError(404, "Task not found");

    if (current.status === "done") {
      return res.json(current);
    }

    // If it is in a state that can finish, call service
    if (["claimed", "in_progress", "problem", "ready"].includes(current.status as PickerTaskStatus)) {
      const task = await PickTaskService.finishTask(
        id,
        (req as any).user?.id || req.body.userId
      );
      return res.json(task);
    }

    throw new ApiError(409, `Cannot complete task from status ${current.status}`);
  } catch (e) {
    next(e);
  }
}
