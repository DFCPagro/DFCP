// src/services/picker.service.ts
import { Types } from "mongoose";
import Picker from "../models/picker.model";
import { User } from "../models/user.model";
import LogisticsCenter from "../models/logisticsCenter.model";
import { recomputeLevel } from "../utils/level";

const asObjectId = (id: string | Types.ObjectId) =>
  typeof id === "string" ? new Types.ObjectId(id) : id;

export async function getPickerByUserId(userId: string | Types.ObjectId) {
  return Picker.findOne({ userId: asObjectId(userId) });
}

async function ensureCenterExists(centerId: string | Types.ObjectId) {
  const exists = await LogisticsCenter.exists({ _id: asObjectId(centerId) });
  if (!exists) throw new Error("logisticCenterId not found");
}

/**
 * Create a Picker for a user.
 * NOTE: Picker no longer stores logisticCenterId — it's read from the User.
 */
export async function createPicker(params: {
  userId: string | Types.ObjectId;
  nickname?: string;
}) {
  const { userId, nickname } = params;

  // minimal guard: ensure user exists and is role "picker"
  const user = await User.findById(asObjectId(userId)).select("_id role").lean();
  if (!user) throw new Error("User not found");
  if (user.role !== "picker") throw new Error('User role must be "picker" to create a Picker.');

  return Picker.create({
    userId: asObjectId(userId),
    nickname: nickname?.trim() ?? "",
  });
}

/**
 * Upsert core picker data.
 * - nickname is stored on Picker
 * - logisticCenterId (if provided) is now applied to the **User** (not Picker)
 */
export async function upsertCore(
  userId: string,
  payload: { nickname?: string; logisticCenterId?: string }
) {
  const uid = asObjectId(userId);

  // If caller wants to change LC, validate and update it on the User document
  if (typeof payload.logisticCenterId === "string" && payload.logisticCenterId) {
    await ensureCenterExists(payload.logisticCenterId);
    await User.updateOne(
      { _id: uid },
      { $set: { logisticCenterId: asObjectId(payload.logisticCenterId) } }
    );
  }

  // Upsert Picker (which no longer stores LC)
  const existing = await getPickerByUserId(uid);

  if (!existing) {
    return createPicker({
      userId: uid,
      nickname: payload.nickname,
    });
  }

  if (typeof payload.nickname === "string") {
    existing.nickname = payload.nickname.trim();
  }

  await existing.save();
  return existing;
}

export async function setXP(userId: string, xp: number) {
  if (xp < 0) xp = 0;
  const picker = await getPickerByUserId(userId);
  if (!picker) throw new Error("Picker not found. Create picker first.");

  picker.gamification.xp = xp;
  picker.gamification.level = recomputeLevel(xp);
  await picker.save();
  return picker;
}

export async function addXP(userId: string, delta: number) {
  const picker = await getPickerByUserId(userId);
  if (!picker) throw new Error("Picker not found. Create picker first.");

  const nextXP = Math.max(0, (picker.gamification.xp ?? 0) + (delta || 0));
  picker.gamification.xp = nextXP;
  picker.gamification.level = recomputeLevel(nextXP);
  await picker.save();
  return picker;
}

/**
 * Full picker profile
 * - Populates the User and the User's LogisticCenter
 * - Mirrors the shape you posted
 */
export async function getPickerProfile(userId: string) {
  const pickerDoc = await Picker.findOne({ userId: asObjectId(userId) })
    .populate({
      path: "user",
      select: "name email phone role logisticCenterId mdCoints coins activeStatus",
      populate: {
        path: "logisticCenterId",
        select: "logisticName location.name",
        model: "LogisticCenter",
      },
    });

  if (!pickerDoc) {
    return {
      userId,
      exists: false,
      currentMonthSchedule: [] as any[],
      nextMonthSchedule: [] as any[],
    };
  }

  const picker = pickerDoc.toObject({ virtuals: true }) as any;
  const user = picker.user as any | undefined;

  // Build logisticCenter object (if populated)
  const lc =
    user?.logisticCenterId && typeof user.logisticCenterId === "object"
      ? {
          id: user.logisticCenterId._id?.toString() ?? null,
          name: user.logisticCenterId.logisticName ?? null,
          locationName: user.logisticCenterId.location?.name ?? null,
        }
      : null;

  return {
    userId: picker.userId.toString(),
    nickname: picker.nickname || "",
    status: picker.status,
    level: picker.gamification?.level ?? 1,
    xp: picker.gamification?.xp ?? 0,
    user: user
      ? {
          name: user.name,
          email: user.email,
          phone: user.phone ?? null,
          role: user.role,
          logisticCenter: lc, // ✅ keep only this
          mdCoints: user.mdCoints ?? 0,
          coins: user.coins ?? 0,
          activeStatus: user.activeStatus ?? true,
        }
      : null,
    currentMonthSchedule: [] as any[],
    nextMonthSchedule: [] as any[],
  };
}
