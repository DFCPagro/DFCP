import { Types } from "mongoose";
import { DateTime } from "luxon";
import Picker from "../models/picker.model";
import { User } from "../models/user.model";
import LogisticsCenter from "../models/logisticsCenter.model";
import { recomputeLevel } from "../utils/level";
import PickerTaskModelTyped from "@/models/PickerTasks.model";
import { getCurrentShift } from "./shiftConfig.service";

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
  const user = await User.findById(asObjectId(userId))
    .select("_id role")
    .lean();
  if (!user) throw new Error("User not found");
  if (user.role !== "picker")
    throw new Error('User role must be "picker" to create a Picker.');

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
  logisticCenterId: string
) {
  const uid = asObjectId(userId);

  // If caller wants to change LC, validate and update it on the User document
  if (
    typeof logisticCenterId === "string" &&
    logisticCenterId
  ) {
    await ensureCenterExists(logisticCenterId);
    await User.updateOne(
      { _id: uid },
      { $set: { logisticCenterId: asObjectId(logisticCenterId) } }
    );
  }

  // Upsert Picker (which no longer stores LC)
  const existing = await getPickerByUserId(uid);

  if (!existing) {
    return createPicker({
      userId: uid,
    });
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
  const pickerDoc = await Picker.findOne({
    userId: asObjectId(userId),
  }).populate({
    path: "user",
    select: "name email phone role logisticCenterId mdCoins coins activeStatus",
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
          mdCoins: user.mdCoins ?? 0,
          activeStatus: user.activeStatus ?? true,
        }
      : null,
    currentMonthSchedule: [] as any[],
    nextMonthSchedule: [] as any[],
  };
}




/**
 * Count completed picker tasks for the given picker in a month.
 * Optionally scoped to a specific logisticCenterId.
 * Defaults to the current month/year if none are provided.
 */
export async function countMonthlyCompletedOrders(params: {
  pickerUserId: string | Types.ObjectId;
  month?: number; // 1-12
  year?: number;
  logisticCenterId?: string | Types.ObjectId;
}): Promise<number> {
  const now = DateTime.now();
  const targetMonth = params.month ?? now.month;
  const targetYear = params.year ?? now.year;

  const targetDate = now.set({ month: targetMonth, year: targetYear });
  if (!targetDate.isValid) {
    throw new Error("Invalid month/year provided");
  }

  const startDate = targetDate.startOf("month").toFormat("yyyy-LL-dd");
  const endDate = targetDate.endOf("month").toFormat("yyyy-LL-dd");

  const filter: any = {
    assignedPickerUserId: asObjectId(params.pickerUserId),
    status: "done",
    shiftDate: { $gte: startDate, $lte: endDate },
  };

  // 🔹 Optionally scope to a specific logistics center
  if (params.logisticCenterId) {
    filter.logisticCenterId = asObjectId(params.logisticCenterId);
  }

  return PickerTaskModelTyped.countDocuments(filter);
}


/**
 * Get total *completed* orders for today's current shift for a specific picker
 * in a specific logistics center.
 * - Uses getCurrentShift() to detect which shift is active now.
 * - Uses today's date in "yyyy-LL-dd" format to match shiftDate.
 * - Counts tasks assigned to this picker for that (shiftDate, shiftName, logisticCenterId).
 */
export async function countCompletedTodayShiftOrdersForPicker(params: {
  pickerUserId: string | Types.ObjectId;
  logisticCenterId: string | Types.ObjectId;
}): Promise<number> {
  const pickerId = asObjectId(params.pickerUserId);
  const centerId = asObjectId(params.logisticCenterId);

  // Determine which shift is active right now
  const currentShiftName = await getCurrentShift();

  // No active shift right now → no orders for "today's shift"
  if (currentShiftName === "none") {
    return 0;
  }

  // Build today's shiftDate string (same format as in PickerTask.shiftDate)
  const now = DateTime.now(); // or .setZone("Asia/Jerusalem") if you want explicit TZ
  const todayStr = now.toFormat("yyyy-LL-dd");

  // Count all tasks for this picker in today's current shift and center
  const count = await PickerTaskModelTyped.countDocuments({
    assignedPickerUserId: pickerId,
    logisticCenterId: centerId,
    shiftDate: todayStr,
    shiftName: currentShiftName,
    status: "done",
  });

  return count;
}


type TopPickersMode = "todayShift" | "month";


export async function getTopPickersByCompletedOrders(params: {
  logisticCenterId?: string | Types.ObjectId;
  mode: TopPickersMode;
  month?: number; // used only in "month" mode
  year?: number;  // used only in "month" mode
  limit?: number; // default 5
}) {
  const { logisticCenterId, mode } = params;
  const limit = params.limit ?? 5;

  const match: any = {
    status: "done",
    assignedPickerUserId: { $ne: null },
  };

  // 🔹 Scope to specific logistics center (if provided)
  if (logisticCenterId) {
    match.logisticCenterId = asObjectId(logisticCenterId);
  }

  if (mode === "todayShift") {
    // Reuse same window logic as countCompletedTodayShiftOrdersForPicker
    const currentShiftName = await getCurrentShift();
    if (currentShiftName === "none") {
      // No active shift → no top pickers
      return [];
    }

    const now = DateTime.now(); // or .setZone("Asia/Jerusalem") if you need
    const todayStr = now.toFormat("yyyy-LL-dd");

    match.shiftName = currentShiftName;
    match.shiftDate = todayStr;
  } else if (mode === "month") {
    // Reuse monthly window logic from countMonthlyCompletedOrders
    const now = DateTime.now();
    const targetMonth = params.month ?? now.month;
    const targetYear = params.year ?? now.year;

    const targetDate = now.set({ month: targetMonth, year: targetYear });
    if (!targetDate.isValid) {
      throw new Error("Invalid month/year provided");
    }

    const startDate = targetDate.startOf("month").toFormat("yyyy-LL-dd");
    const endDate = targetDate.endOf("month").toFormat("yyyy-LL-dd");

    match.shiftDate = { $gte: startDate, $lte: endDate };
  }

  // 🔹 Aggregate completed tasks → group by picker → sort → top N
  const raw = await PickerTaskModelTyped.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$assignedPickerUserId",
        completedOrders: { $sum: 1 },
      },
    },
    { $sort: { completedOrders: -1 } },
    { $limit: limit },
  ]);

  if (!raw.length) return [];

  const pickerUserIds = raw.map((r) => r._id);

  // Fetch picker docs + user info
  const pickerDocs = await Picker.find({ userId: { $in: pickerUserIds } })
    .populate({
      path: "user",
      select: "name email phone role logisticCenterId mdCoins activeStatus",
      // if you want LC details too, you can add a nested populate here
    })
    .lean()
    .exec();

  // Map results into nice shape, preserving order from aggregation
  return raw.map((row) => {
    const picker = pickerDocs.find(
      (p: any) => p.userId.toString() === row._id.toString()
    ) as any | undefined;

    const user = picker?.user;

    return {
      pickerUserId: row._id.toString(),
      completedOrders: row.completedOrders,
      nickname: picker?.nickname ?? "",
      status: picker?.status ?? null,
      level: picker?.gamification?.level ?? 1,
      xp: picker?.gamification?.xp ?? 0,
      user: user
        ? {
            name: user.name,
            email: user.email,
            phone: user.phone ?? null,
            role: user.role,
            logisticCenterId: user.logisticCenterId ?? null,
            mdCoins: user.mdCoins ?? 0,
            activeStatus: user.activeStatus ?? true,
          }
        : null,
    };
  });
}
