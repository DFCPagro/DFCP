// Task planning and assignment.  This service looks at all pending
// PickTask documents in a logistic centre, computes a crowd-aware
// aggregate score for each task and selects the lowest-scoring task
// for the requesting picker.  It also handles starting and
// completing tasks, updating crowd counters accordingly.

import { Types } from "mongoose";
import PickTask from "@/models/PickTask.model";
import CrowdState from "@/models/CrowdState.model.ts";
import { PersistedCrowdService } from "./crowdPersistence.service";
import ApiError from "@/utils/ApiError";

export namespace PickTaskService {
  /**
   * Suggest the next pick task for a picker.  Computes aggregate
   * crowd scores for all pending tasks and returns the one with the
   * lowest score.  If no task is available, returns null.
   */
  export async function suggestNextTask(logisticCenterId: string) {
    const tasks = await PickTask.find({
      logisticCenterId,
      state: "pending",
    }).lean();
    if (!tasks.length) return null;
    // compute crowd scores
    const withScores = await Promise.all(
      tasks.map(async (task) => {
        let score = 0;
        const shelfIds = new Set<string>();
        // prefer targetSlots if present, else shelfAssignments
        const slots =
          (task as any).targetSlots && (task as any).targetSlots.length
            ? (task as any).targetSlots
            : (task as any).shelfAssignments;
        for (const slot of slots) {
          const shelfId = String(slot.shelfId);
          if (shelfIds.has(shelfId)) continue;
          shelfIds.add(shelfId);
          const state = await CrowdState.findOne({ shelfId });
          const busy = state?.busyScore ?? 0;
          score += busy;
        }
        return { task, score };
      })
    );
    // sort by score ascending
    withScores.sort((a, b) => a.score - b.score);
    const best = withScores[0];
    // update the task with computed score
    await PickTask.updateOne(
      { _id: best.task._id },
      { $set: { aggregateCrowdScore: best.score } }
    );
    return best.task;
  }

  /**
   * Start a pick task.  Changes state to in_progress, records the
   * assigned picker and bumps crowd counters on all shelves involved.
   */
  export async function startTask(taskId: string, userId: string) {
    const task = await PickTask.findById(taskId);
    if (!task) throw new ApiError(404, "PickTask not found");
    if (task.state !== "pending")
      throw new ApiError(400, "Task already started");
    task.state = "in_progress";
    task.set("assignedTo", new Types.ObjectId(userId));
    task.startedAt = new Date();
    await task.save();
    // bump crowd counters for all shelves referenced in targetSlots or assignments
    const slots = task.targetSlots?.length
      ? task.targetSlots
      : (task as any).shelfAssignments;
    const uniqueShelves = new Set<string>();
    for (const slot of slots) {
      const sid = String(slot.shelfId);
      if (!uniqueShelves.has(sid)) {
        uniqueShelves.add(sid);
        await PersistedCrowdService.bump(sid, +1, "pick");
      }
    }
    return task.toObject();
  }

  /**
   * Complete a pick task.  Changes state to completed, sets completedAt,
   * and decrements crowd counters on involved shelves.
   */
  export async function completeTask(taskId: string) {
    const task = await PickTask.findById(taskId);
    if (!task) throw new ApiError(404, "PickTask not found");
    if (task.state !== "in_progress")
      throw new ApiError(400, "Task not in progress");
    task.state = "completed";
    task.completedAt = new Date();
    await task.save();
    const slots = task.targetSlots?.length
      ? task.targetSlots
      : (task as any).shelfAssignments;
    const uniqueShelves = new Set<string>();
    for (const slot of slots) {
      const sid = String(slot.shelfId);
      if (!uniqueShelves.has(sid)) {
        uniqueShelves.add(sid);
        await PersistedCrowdService.bump(sid, -1, "pick");
      }
    }
    return task.toObject();
  }
}
