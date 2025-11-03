// src/controllers/pickerTasks.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  generatePickerTasksForShift,
  listPickerTasksForCurrentShift,
  listPickerTasksForShift,
} from "../services/pickerTasks.service";

type Role = "admin" | "opManager" | "picker" | string;
const hasRole = (u: any, roles: Role[]) => !!u && roles.includes(u.role);

/** POST /api/picker-tasks/generate */
export async function postGeneratePickerTasks(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!hasRole(user, ["admin", "opManager"])) {
      return res.status(403).json({ error: "Forbidden", details: "Only admin or opManager can generate tasks." });
    }

    const { logisticCenterId, shiftName, shiftDate } = req.body || {};
    if (!mongoose.isValidObjectId(logisticCenterId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid logisticCenterId" });
    }

    const result = await generatePickerTasksForShift({
      logisticCenterId,
      createdByUserId: String(user._id),
      shiftName,
      shiftDate,
      stageKey: "packing_ready",
      priority: 0,
      autoSetReady: true,
    });

    return res.json({ data: result });
  } catch (err: any) {
    console.error("[postGeneratePickerTasks] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}

/** GET /api/picker-tasks/current */
export async function getPickerTasksForCurrentShift(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!hasRole(user, ["admin", "opManager", "picker"])) {
      return res.status(403).json({ error: "Forbidden", details: "Insufficient role." });
    }

    const {
      logisticCenterId,
      status,
      mine,
      page,
      limit,
      shiftName,
      shiftDate,
    } = (req.query || {}) as Record<string, string>;

    if (!mongoose.isValidObjectId(logisticCenterId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid logisticCenterId" });
    }

    const data = await listPickerTasksForCurrentShift({
      logisticCenterId,
      status,
      mine: mine === "true",
      requesterUserId: String(user._id),
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      shiftName: shiftName as any,
      shiftDate: shiftDate as any,
    });

    return res.json({ data });
  } catch (err: any) {
    console.error("[getPickerTasksForCurrentShift] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}

/** GET /api/picker-tasks/shift */
export async function getPickerTasksForShiftController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!hasRole(user, ["admin", "opManager", "picker"])) {
      return res.status(403).json({ error: "Forbidden", details: "Insufficient role." });
    }

    const {
      logisticCenterId,
      shiftName,
      shiftDate,
      status,
      mine,
      page,
      limit,
    } = (req.query || {}) as Record<string, string>;

    if (!mongoose.isValidObjectId(logisticCenterId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid logisticCenterId" });
    }

    const data = await listPickerTasksForShift({
      logisticCenterId,
      shiftName: shiftName as any,
      shiftDate: shiftDate as string,
      status,
      mine: mine === "true",
      requesterUserId: String(user._id),
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return res.json({ data });
  } catch (err: any) {
    console.error("[getPickerTasksForShiftController] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}
