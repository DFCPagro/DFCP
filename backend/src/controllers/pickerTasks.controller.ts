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

    // Only pass TRUE if the caller explicitly sent true (string or boolean)
    const autoSetReadyBool =
      typeof autoSetReady === "string"
        ? autoSetReady.toLowerCase() === "true"
        : autoSetReady === true;

    const result = await generatePickerTasksForShift({
      logisticCenterId: new Types.ObjectId(lcId),
      createdByUserId: new Types.ObjectId(String(user._id)),
      shiftName,
      shiftDate,
      priority,
      stageKey,
      autoSetReady: autoSetReadyBool, // default false unless explicitly true
    });

    return res.json({ data: result });
  } catch (err: any) {
    console.error("[postGeneratePickerTasks] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}

/** GET /api/pickerTasks/shift?shiftName=morning&shiftDate=2025-11-05&status=ready&page=1&limit=50 */
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
      ensure = "true", // allow opt-out with ensure=false
    } = (req.query || {}) as Record<string, string>;

    if (!shiftName) {
      return res.status(400).json({ error: "BadRequest", details: "shiftName is required" });
    }
    if (!shiftDate || !DATE_RE.test(shiftDate)) {
      return res.status(400).json({ error: "BadRequest", details: "shiftDate must be yyyy-LL-dd" });
    }

    // ⬇️ ALWAYS return all tasks (no assigned/unassigned filtering)
    const common = {
      logisticCenterId: new Types.ObjectId(lcId),
      shiftName: shiftName as ShiftName,
      shiftDate: shiftDate as string,
      status,
      page: parseIntOrUndef(page),
      limit: parseIntOrUndef(limit),
    };

    if (parseBool(ensure) !== false) {
      const result = await ensureAndListPickerTasksForShift({
        ...common,
        createdByUserId: new Types.ObjectId(String(user._id)),
      });
      return res.json({ data: result }); // { ensure, data }
    }

    const data = await listPickerTasksForShift(common);
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

    // OPTIONAL: block only when in_progress (policy tweak)
    // const blocking = ["in_progress"] as const;

    const result = await claimFirstReadyTaskForCurrentShift({
      logisticCenterId: new Types.ObjectId(lcId),
      pickerUserId: new Types.ObjectId(String(pickerId)),
      // blockingStatuses: blocking, // ← uncomment if you want that policy
    });

    if (!result.task) {
      return res.status(404).json({
        error: "NotFound",
        details: "No READY tasks available for the current shift",
        data: { shift: result.shift },
      });
    }

    // Choose ONE of the two behaviors:

    // A) 200 always (simplest):
    return res.status(200).json({ data: result });

    // B) If you prefer 409 when already assigned:
    // if (result.alreadyAssigned) {
    //   return res.status(409).json({
    //     error: "AlreadyAssigned",
    //     details: "Picker already has an active task in this shift.",
    //     data: result,
    //   });
    // }
    // return res.status(200).json({ data: result });

  } catch (err: any) {
    console.error("[postClaimFirstReadyTaskForCurrentShift] error:", err);
    return res.status(500).json({ error: "ServerError", details: err?.message ?? String(err) });
  }
}
