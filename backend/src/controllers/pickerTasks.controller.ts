// src/controllers/pickerTasks.controller.ts
import { Request, Response } from "express";
import mongoose from "mongoose";
import { Types } from "mongoose";
import {
  generatePickerTasksForShift,
  listPickerTasksForShift,
} from "../services/pickerTasks.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // yyyy-LL-dd

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return undefined;
}
function parseIntOrUndef(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}

/** POST /api/picker-tasks/generate */
export async function postGeneratePickerTasks(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const lcId = user?.logisticCenterId;

    if (!mongoose.isValidObjectId(lcId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid logisticCenterId" });
    }

    const { shiftName, shiftDate } = req.body || {};

    const result = await generatePickerTasksForShift({
      logisticCenterId: new Types.ObjectId(lcId),
      createdByUserId: new Types.ObjectId(String(user._id)),
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

/** GET /api/picker-tasks/shift?shiftName=morning&shiftDate=2025-11-05&assignedOnly=true */
export async function getPickerTasksForShiftController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const lcId = user?.logisticCenterId;

    if (!mongoose.isValidObjectId(lcId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid logisticCenterId" });
    }

    const {
      shiftName,
      shiftDate,
      status,
      page,
      limit,
      assignedOnly,
      unassignedOnly,
      pickerUserId,
    } = (req.query || {}) as Record<string, string>;

    if (!shiftName) {
      return res.status(400).json({ error: "BadRequest", details: "shiftName is required" });
    }
    if (!shiftDate || !DATE_RE.test(shiftDate)) {
      return res.status(400).json({ error: "BadRequest", details: "shiftDate must be yyyy-LL-dd" });
    }

    // Mutually exclusive assignment flags
    const assignedOnlyBool = parseBool(assignedOnly) === true;
    const unassignedOnlyBool = !assignedOnlyBool && parseBool(unassignedOnly) === true;

    const data = await listPickerTasksForShift({
      logisticCenterId: new Types.ObjectId(lcId),
      shiftName: shiftName as any,       // your ShiftName union
      shiftDate: shiftDate as string,
      status,
      page: parseIntOrUndef(page),
      limit: parseIntOrUndef(limit),
      assignedOnly: assignedOnlyBool,    // plain boolean
      unassignedOnly: unassignedOnlyBool,// plain boolean
      pickerUserId: pickerUserId || undefined,
    });

    return res.json({ data });
  } catch (err: any) {
    console.error("[getPickerTasksForShiftController] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}
