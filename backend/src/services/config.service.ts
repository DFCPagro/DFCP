// src/services/config.service.ts
import { Types } from "mongoose";
import AppConfig from "@/models/appConfig.model";

export async function getInactivityMinutes(LCid?: string | Types.ObjectId | null): Promise<number> {
  if (LCid) {
    const key = typeof LCid === "string" ? LCid : LCid.toHexString();
    const per = await AppConfig.findOne({ scope: key }).lean();
    if (per?.inactivityMinutes) return per.inactivityMinutes;
  }
  const global = await AppConfig.findOne({ scope: "global" }).lean();
  return global?.inactivityMinutes ?? 20;
}

export async function setInactivityMinutes(
  scope: string,
  minutes: number,
  updatedBy?: string
) {
  const bounded = Math.max(1, Math.min(240, Math.floor(minutes)));
  return AppConfig.findOneAndUpdate(
    { scope },
    { $set: { inactivityMinutes: bounded, updatedBy: updatedBy ?? null } },
    { new: true, upsert: true }
  ).lean();
}
