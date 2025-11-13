import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import {
  getShiftWindows,
  listShiftWindowsByLC,
  getNextAvailableShifts,
  getCurrentShift,
} from "../services/shiftConfig.service";
import { get } from "node:http";

export async function getShiftWindowsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const lc = String(req.user.logisticCenterId || "").trim();
    const name = String(req.query.name || "").trim() as any;
    console;
    if (!lc || !name) throw new ApiError(400, "Missing lc/name");

    const data = await getShiftWindows({ logisticCenterId: lc, name });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function listShiftWindowsByLCController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const lc = String(req.user.logisticCenterId || "").trim();
    if (!lc) throw new ApiError(400, "Missing lc");
    const rows = await listShiftWindowsByLC(lc);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
}

export async function getNextShiftsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const lc = String(req.query.lc || req.query.logisticCenterId || "").trim();
    if (!lc) throw new ApiError(400, "Missing required query param: lc");

    const count = req.query.count
      ? Math.max(1, Math.min(20, Number(req.query.count)))
      : 5;
    const result = await getNextAvailableShifts({
      logisticCenterId: lc,
      count,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCurrentShiftController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    console.log("getCurrentShiftController called");
    const shift = await getCurrentShift();

    if (shift === "none") {
      return res.status(404).json({ error: "No active shift right now" });
    }
    return res.status(200).json({ data: { shift } });
  } catch (err) {
    next(err);
  }
}
