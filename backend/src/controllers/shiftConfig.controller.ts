import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import { getShiftWindows, listShiftWindowsByLC, getNextAvailableShifts } from "../services/shiftConfig.service";

export async function getShiftWindowsController(req: Request, res: Response, next: NextFunction) {
  try {
    const lc = String(req.query.lc || req.query.logisticCenterId || "").trim();
    const name = String(req.query.name || "").trim() as any;
    if (!lc || !name) throw new ApiError(400, "Missing lc/name");

    const data = await getShiftWindows({ logisticCenterId: lc, name });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

export async function listShiftWindowsByLCController(req: Request, res: Response, next: NextFunction) {
  try {
    const lc = String(req.query.lc || req.query.logisticCenterId || "").trim();
    if (!lc) throw new ApiError(400, "Missing lc");

    const rows = await listShiftWindowsByLC(lc);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
}



export async function getNextShiftsController(req: Request, res: Response, next: NextFunction) {
  try {
    const lc = String(req.query.lc || req.query.logisticCenterId || "").trim();
    if (!lc) throw new ApiError(400, "Missing required query param: lc");

    const count = req.query.count ? Math.max(1, Math.min(20, Number(req.query.count))) : 5;
    const result = await getNextAvailableShifts({ logisticCenterId: lc, count });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

