import ShiftConfig, { ShiftConfig as ShiftConfigType } from "../models/shiftConfig.model";
import ApiError from "../utils/ApiError";
import { DateTime } from "luxon";
import { normalizeWindow } from "../utils/time";

const SHIFT_ORDER: Array<ShiftConfigType["name"]> = ["morning", "afternoon", "evening", "night"];

function isNowInShift(nowMinutes: number, start: number, end: number): boolean {
  if (start <= end) {
    return nowMinutes >= start && nowMinutes < end;
  } else {
    // wrap-around, e.g. 1140 → 60 (19:00 → 01:00)
    return nowMinutes >= start || nowMinutes < end;
  }
}

export async function getShiftConfigByKey(params: {
  logisticCenterId: string;
  name: "morning" | "afternoon" | "evening" | "night";
}): Promise<ShiftConfigType> {
  const doc = await ShiftConfig.findOne(params).lean<ShiftConfigType>().exec();
  if (!doc) throw new ApiError(404, `ShiftConfig not found for ${params.logisticCenterId}/${params.name}`);
  return doc;
}

export async function getShiftWindows(params: {
  logisticCenterId: string;
  name: "morning" | "afternoon" | "evening" | "night";
}) {
  const cfg = await getShiftConfigByKey(params);

  return {
    name: cfg.name,
    timezone: cfg.timezone,
    general: normalizeWindow(cfg.generalStartMin, cfg.generalEndMin),
    industrialDeliverer: normalizeWindow(cfg.industrialDelivererStartMin, cfg.industrialDelivererEndMin),
    deliverer: normalizeWindow(cfg.delivererStartMin, cfg.delivererEndMin),
    deliverySlot: {
      ...normalizeWindow(cfg.deliveryTimeSlotStartMin, cfg.deliveryTimeSlotEndMin),
      slotSizeMin: cfg.slotSizeMin ?? 30,
    },
  };
}

export async function listShiftWindowsByLC(logisticCenterId: string) {
  const rows = await ShiftConfig.find().lean<ShiftConfigType[]>().exec();
  return rows.map((cfg) => ({
    name: cfg.name,
    timezone: cfg.timezone,
    general: normalizeWindow(cfg.generalStartMin, cfg.generalEndMin),
    industrialDeliverer: normalizeWindow(cfg.industrialDelivererStartMin, cfg.industrialDelivererEndMin),
    deliverer: normalizeWindow(cfg.delivererStartMin, cfg.delivererEndMin),
    deliverySlot: {
      ...normalizeWindow(cfg.deliveryTimeSlotStartMin, cfg.deliveryTimeSlotEndMin),
      slotSizeMin: cfg.slotSizeMin ?? 30,
    },
  }));
}


/**
 * Returns the next `count` available shifts from "now" in the LC timezone.
 * A shift is "available" if `now < generalStartMin` for *today*; if none are left
 * today, start from the first shift of *tomorrow*.
 *
 * Output: [{ date: "YYYY-MM-DD", name: "morning|afternoon|evening|night" }, ...]
 */
export async function getNextAvailableShifts(params: {
  logisticCenterId: string;
  count?: number;   // default 5
  fromTs?: number;  // optional epoch millis for tests
}) {
  const { logisticCenterId, count = 5, fromTs } = params;

  // Pull only what we need, lean for speed
  const rows = await ShiftConfig.find(
    { logisticCenterId },
    {
      name: 1,
      timezone: 1,
      generalStartMin: 1,
    }
  ).lean<Pick<ShiftConfigType, "name" | "timezone" | "generalStartMin">[]>().exec();

  if (!rows?.length) {
    throw new ApiError(404, `No ShiftConfig found for lc='${logisticCenterId}'`);
  }

  // Use LC timezone from first row; assume all same tz
  const tz = rows[0].timezone || "Asia/Jerusalem";

  // Sort shifts by start time within a day (earliest → latest).
  // This naturally makes 00:00-night come before morning if you have such a config.
  const ordered = rows
    .slice()
    .sort((a, b) => a.generalStartMin - b.generalStartMin);

  const now = fromTs
    ? DateTime.fromMillis(fromTs, { zone: tz })
    : DateTime.now().setZone(tz);

  const today = now.startOf("day"); // local day in tz
  const minutesSinceMidnight = now.hour * 60 + now.minute;

  // find the first shift that hasn't started yet today
  let dayCursor = today;
  let idx = ordered.findIndex(s => s.generalStartMin > minutesSinceMidnight);

  // if none left today, move to next day and start from first (earliest) shift
  if (idx === -1) {
    dayCursor = dayCursor.plus({ days: 1 });
    idx = 0;
  }

  const out: Array<{ date: string; name: ShiftConfigType["name"] }> = [];

  while (out.length < count) {
    const s = ordered[idx];
    out.push({
      date: dayCursor.toFormat("yyyy-LL-dd"),
      name: s.name,
    });

    // advance to next shift
    idx += 1;
    if (idx >= ordered.length) {
      idx = 0;
      dayCursor = dayCursor.plus({ days: 1 });
    }
  }

  return out;
}


export async function getCurrentShift(): Promise<"morning"|"afternoon"|"evening"|"night"|"none"> {
  const configs = await ShiftConfig.find({}).lean().exec();
  if (!configs.length) return "none";

  const tz = configs[0].timezone || "Asia/Jerusalem";
  const now = DateTime.now().setZone(tz);
  const nowMinutes = now.hour * 60 + now.minute;

  for (const cfg of configs) {
    if (isNowInShift(nowMinutes, cfg.generalStartMin, cfg.generalEndMin)) {
      return cfg.name as any;
    }
  }
  return "none";
}
