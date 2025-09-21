// controllers/config.controller.ts
import { Request, Response } from "express";
import ApiError from "../utils/ApiError";
import { getInactivityMinutes, setInactivityMinutes } from "../services/config.service";

export const getInactivity = async (req: Request, res: Response) => {
  const { scope } = req.query; // optional LCid or "global"
  const minutes = await getInactivityMinutes(scope ? String(scope) : undefined);
  res.json({ scope: scope ?? "resolved", inactivityMinutes: minutes });
};

export const setInactivity = async (req: Request, res: Response) => {
  // @ts-ignore
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");

  const { scope, minutes } = req.body; // scope: "global" or LCid string
  if (!scope || minutes == null) throw new ApiError(400, "scope and minutes are required");
  const doc = await setInactivityMinutes(String(scope), Number(minutes), user.email ?? user._id?.toString());
  res.status(200).json(doc);
};
