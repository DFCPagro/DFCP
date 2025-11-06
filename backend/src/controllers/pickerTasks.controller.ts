import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import {
  generatePickerTasksForShift,
  listPickerTasksForShift,
  ensureAndListPickerTasksForShift,
  getShiftPickerTasksSummary,
  claimFirstReadyTaskForCurrentShift,
} from "../services/pickerTasks.service";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // yyyy-LL-dd
const SHIFT_NAMES = ["morning", "afternoon", "evening", "night"] as const;
type ShiftName = (typeof SHIFT_NAMES)[number];

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

/** POST /api/pickerTasks/generate */
export async function postGeneratePickerTasks(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const lcId = user?.logisticCenterId;

    if (!mongoose.isValidObjectId(lcId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid logisticCenterId" });
    }

    const { shiftName, shiftDate, priority, stageKey, autoSetReady } = req.body || {};

    const result = await generatePickerTasksForShift({
      logisticCenterId: new Types.ObjectId(lcId),
      createdByUserId: new Types.ObjectId(String(user._id)),
      shiftName,
      shiftDate,
      priority,
      stageKey,
      autoSetReady,
    });

    return res.json({ data: result });
  } catch (err: any) {
    console.error("[postGeneratePickerTasks] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}

/** GET /api/pickerTasks/shift?shiftName=morning&shiftDate=2025-11-05&assignedOnly=true */
export async function getPickerTasksForShiftController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const lcId = user?.logisticCenterId;
    console.log("i come here");
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
      ensure = "true", // allow opt-out with ensure=false
    } = (req.query || {}) as Record<string, string>;

    if (!shiftName) {
      return res.status(400).json({ error: "BadRequest", details: "shiftName is required" });
    }
    if (!shiftDate || !DATE_RE.test(shiftDate)) {
      return res.status(400).json({ error: "BadRequest", details: "shiftDate must be yyyy-LL-dd" });
    }

    const assignedOnlyBool = parseBool(assignedOnly) === true;
    const unassignedOnlyBool = !assignedOnlyBool && parseBool(unassignedOnly) === true;

    if (parseBool(ensure) !== false) {
      const result = await ensureAndListPickerTasksForShift({
        logisticCenterId: new Types.ObjectId(lcId),
        createdByUserId: new Types.ObjectId(String(user._id)),
        shiftName: shiftName as any,
        shiftDate: shiftDate as string,
        status,
        page: parseIntOrUndef(page),
        limit: parseIntOrUndef(limit),
        assignedOnly: assignedOnlyBool,
        unassignedOnly: unassignedOnlyBool,
        pickerUserId: pickerUserId || undefined,
      });
      console.log("res: ", result);
      return res.json(result); // { ensure, data }
    }

    const data = await listPickerTasksForShift({
      logisticCenterId: new Types.ObjectId(lcId),
      shiftName: shiftName as any,
      shiftDate: shiftDate as string,
      status,
      page: parseIntOrUndef(page),
      limit: parseIntOrUndef(limit),
      assignedOnly: assignedOnlyBool,
      unassignedOnly: unassignedOnlyBool,
      pickerUserId: pickerUserId || undefined,
    });

    return res.json({ data });
  } catch (err: any) {
    console.error("[getPickerTasksForShiftController] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}

/** GET /api/pickerTasks/shift/summary?shiftName=afternoon&shiftDate=2025-11-06 */
export async function getShiftPickerTasksSummaryController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const lcId = user?.logisticCenterId;

    if (!mongoose.isValidObjectId(lcId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid logisticCenterId" });
    }

    const { shiftName, shiftDate } = (req.query || {}) as Record<string, string>;

    if (!shiftName || !SHIFT_NAMES.includes(shiftName as ShiftName)) {
      return res
        .status(400)
        .json({ error: "BadRequest", details: `shiftName must be one of: ${SHIFT_NAMES.join(", ")}` });
    }
    if (!shiftDate || !DATE_RE.test(shiftDate)) {
      return res.status(400).json({ error: "BadRequest", details: "shiftDate must be yyyy-LL-dd" });
    }

    const summary = await getShiftPickerTasksSummary({
      logisticCenterId: new Types.ObjectId(lcId),
      // createdByUserId comes from middleware user as in your POST generate
      createdByUserId: new Types.ObjectId(String(user._id)),
      shiftName: shiftName as ShiftName,
      shiftDate,
    });

    return res.status(200).json({ data: summary });
  } catch (err: any) {
    console.error("[getShiftPickerTasksSummaryController] error:", err);
    return res.status(500).json({
      error: "ServerError",
      details: err?.message ?? String(err),
    });
  }
}


/** POST /api/pickerTasks/shift/claim-first */
export async function postClaimFirstReadyTaskForCurrentShift(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const lcId = user?.logisticCenterId;
    const pickerId = user?._id;

    if (!mongoose.isValidObjectId(lcId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid logisticCenterId" });
    }
    if (!mongoose.isValidObjectId(pickerId)) {
      return res.status(400).json({ error: "BadRequest", details: "Invalid user id" });
    }

    const result = await claimFirstReadyTaskForCurrentShift({
      logisticCenterId: new Types.ObjectId(lcId),
      pickerUserId: new Types.ObjectId(String(pickerId)),
    });

    if (!result.task) {
      // no ready tasks currently available
      return res.status(404).json({
        error: "NotFound",
        details: "No READY tasks available for the current shift",
        data: { shift: result.shift },
      });
    }

    return res.json({ data: result });
  } catch (err: any) {
    console.error("[postClaimFirstReadyTaskForCurrentShift] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}
