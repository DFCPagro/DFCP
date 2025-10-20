// FILE: src/controllers/pickTask.controller.ts
//
// Controller for pick task operations.  Delegates to the
// PickTaskService and performs simple parameter extraction and
// response formatting.

import { Request, Response, NextFunction } from "express";
import { PickTaskService } from "../services/pickTask.service";
import ApiError from "../utils/ApiError";

export async function suggestTask(req: Request, res: Response, next: NextFunction) {
  try {
    const logisticCenterId = (req.query.centerId as string) || (req as any).user?.logisticCenterId;
    if (!logisticCenterId) throw new ApiError(400, "centerId query param required");
    const task = await PickTaskService.suggestNextTask(logisticCenterId);
    res.json(task || null);
  } catch (e) {
    next(e);
  }
}

export async function startTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || req.body.userId;
    if (!userId) throw new ApiError(400, "userId required");
    const task = await PickTaskService.startTask(id, userId);
    res.json(task);
  } catch (e) {
    next(e);
  }
}

export async function completeTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const task = await PickTaskService.completeTask(id);
    res.json(task);
  } catch (e) {
    next(e);
  }
}
