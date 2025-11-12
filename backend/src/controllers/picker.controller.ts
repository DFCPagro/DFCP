import { Request, Response } from "express";
import {
  getPickerProfile,
  upsertCore,
  setXP,
  addXP,
  createPicker,
  getPickerByUserId,
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
  const { nickname, logisticCenterId } = req.body as {
    nickname?: string;
    logisticCenterId?: string;
  };

  console.log("logisticCenterId:", logisticCenterId);

  try {
    const picker = await upsertCore(userId, { nickname, logisticCenterId });
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
