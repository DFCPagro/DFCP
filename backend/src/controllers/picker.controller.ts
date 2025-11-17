import { Request, Response } from "express";
import {
  getPickerProfile,
  upsertCore,
  setXP,
  addXP,
  createPicker,
  getPickerByUserId,
  getTopPickersByCompletedOrders
} from "../services/picker.service";

/**
 * Assumes auth middleware sets req.user.id.
 */

export async function getMe(req: Request, res: Response) {
  // console.log("asdasd")
  const userId = (req as any).user?.id || req.params.userId;
  const profile = await getPickerProfile(userId);
  // console.log("profile:", profile);
  return res.json(profile);
}

/**
 * PATCH core fields (nickname and/or logisticCenterId).
 * If picker doesn't exist, requires logisticCenterId to create.
 */
export async function patchMe(req: Request, res: Response) {
  const userId = (req as any).user?.id || req.params.userId;
  const { logisticCenterId } = req.body as {
    logisticCenterId: string;
  };

  try {
    const picker = await upsertCore(userId, logisticCenterId);
    const profile = await getPickerProfile(userId);
    return res.json(profile);
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
}

/**
 * PATCH /pickers/me/gamification
 * body: { xp?: number, addXp?: number }
 */
export async function patchMeGamification(req: Request, res: Response) {
  const userId = (req as any).user?.id || req.params.userId;
  const { xp, addXp } = req.body as { xp?: number; addXp?: number };

  try {
    if (typeof xp === "number") {
      await setXP(userId, xp);
    } else if (typeof addXp === "number") {
      await addXP(userId, addXp);
    }
    const profile = await getPickerProfile(userId);
    return res.json(profile);
  } catch (e: any) {
    return res.status(400).json({ message: e.message });
  }
}


/**
 * GET /pickers/top
 * Query params:
 *   - mode: "todayShift" | "month" (default "todayShift")
 *   - logisticCenterId?: string
 *   - month?: number (1-12, only for mode="month")
 *   - year?: number (only for mode="month")
 *   - limit?: number (default 5)
 */
export async function getTopPickersByCompletedOrdersHandler(
  req: Request,
  res: Response
) {
  try {
    const {
      mode: rawMode,
      logisticCenterId,
      month,
      year,
      limit,
    } = req.query as {
      mode?: string;
      logisticCenterId?: string;
      month?: string;
      year?: string;
      limit?: string;
    };

    const mode = rawMode === "month" ? "month" : "todayShift";

    const result = await getTopPickersByCompletedOrders({
      mode,
      logisticCenterId,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    return res.json(result);
  } catch (e: any) {
    console.error("getTopPickersByCompletedOrders error:", e);
    return res.status(400).json({ message: e.message ?? "Failed to fetch top pickers" });
  }
}