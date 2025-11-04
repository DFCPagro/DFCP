import ShiftConfig, { ShiftConfig as ShiftConfigType } from "../models/shiftConfig.model";
import ApiError from "../utils/ApiError";
import { DateTime } from "luxon";
import { normalizeWindow } from "../utils/time";


export const SHIFT_ORDER: Array<ShiftConfigType["name"]> = ["morning", "afternoon", "evening", "night"];

// add this union locally (or import from a pure types module)
export type ShiftName = "morning" | "afternoon" | "evening" | "night" | "none";

function isNowInShift(nowMinutes: number, start: number, end: number): boolean {
  if (start <= end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
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
  const rows = await ShiftConfig.find({ logisticCenterId }).lean<ShiftConfigType[]>().exec();
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

export async function getNextAvailableShifts(params: {
  logisticCenterId: string;
  count?: number;
  fromTs?: number;
}) {
  const { logisticCenterId, count = 5, fromTs } = params;

  const rows = await ShiftConfig.find(
    { logisticCenterId },
    { name: 1, timezone: 1, generalStartMin: 1 }
  ).lean<Pick<ShiftConfigType, "name" | "timezone" | "generalStartMin">[]>().exec();

  if (!rows?.length) throw new ApiError(404, `No ShiftConfig found for lc='${logisticCenterId}'`);

  const tz = rows[0].timezone || "Asia/Jerusalem";
  const ordered = rows.slice().sort((a, b) => a.generalStartMin - b.generalStartMin);

  const now = fromTs ? DateTime.fromMillis(fromTs, { zone: tz }) : DateTime.now().setZone(tz);
  const today = now.startOf("day");
  const minutesSinceMidnight = now.hour * 60 + now.minute;

  let dayCursor = today;
  let idx = ordered.findIndex((s) => s.generalStartMin > minutesSinceMidnight);
  if (idx === -1) { dayCursor = dayCursor.plus({ days: 1 }); idx = 0; }

  const out: Array<{ date: string; name: ShiftConfigType["name"] }> = [];
  while (out.length < count) {
    const s = ordered[idx];
    out.push({ date: dayCursor.toFormat("yyyy-LL-dd"), name: s.name });
    idx += 1;
    if (idx >= ordered.length) { idx = 0; dayCursor = dayCursor.plus({ days: 1 }); }
  }
  return out;
}

export async function getCurrentShift(): Promise<ShiftName> {
  const configs = await ShiftConfig.find({}).lean().exec();
  if (!configs.length) return "none";

  // figure timezone (prefer doc.tz if present)
  const tz =
    (configs[0] as any).timezone ||
    (configs[0] as any).tz ||
    "Asia/Jerusalem";
  const now = DateTime.now().setZone(tz);
  const nowMinutes = now.hour * 60 + now.minute;

  console.log(`Now in ${tz}: ${now.toISO()} (${nowMinutes} min)`);

  // case A: multiple docs, each a shift
  const looksLikePerShiftDocs =
    typeof (configs[0] as any).name === "string" &&
    ("generalStartMin" in configs[0] || "generalEndMin" in configs[0]);

  if (looksLikePerShiftDocs) {
    for (const cfg of configs as any[]) {
      if (isNowInShift(nowMinutes, cfg.generalStartMin, cfg.generalEndMin)) {
        console.log("Matched shift (per-doc):", cfg.name);
        return cfg.name;
      }
    }
    return "none";
  }

  // case B: one doc with nested shifts array
  const shifts = (configs[0] as any).shifts;
  if (Array.isArray(shifts)) {
    for (const s of shifts) {
      if (isNowInShift(nowMinutes, s.generalStartMin, s.generalEndMin)) {
        console.log("Matched shift (nested):", s.name);
        return s.name as ShiftName;
      }
    }
  }
  return "none";
}

/** INTERNAL: turn a shift (mins) into UTC ISO for "today" in given tz */
function shiftMinsToIsoRange(tz: string, startMin: number, endMin: number) {
  const base = DateTime.now().setZone(tz).startOf("day");
  const start = base.plus({ minutes: startMin });
  const endRaw = base.plus({ minutes: endMin });
  const end = endMin <= startMin ? endRaw.plus({ days: 1 }) : endRaw; // wrap-around
  return { startISO: start.toUTC().toISO()!, endISO: end.toUTC().toISO()! };
}

/** PUBLIC: get current active shift time window as UTC ISO range (optionally scoped to a specific LC). */
export async function getCurrentShiftIsoWindow(logisticCenterId?: string) {
  const shiftName = await getCurrentShift();
  if (shiftName === "none") throw new ApiError(404, "No active shift right now");

  if (!logisticCenterId) {
    const anyCfg = await ShiftConfig.findOne({ name: shiftName }).lean<ShiftConfigType>().exec();
    if (!anyCfg) throw new ApiError(404, `ShiftConfig not found for shift='${shiftName}'`);
    return shiftMinsToIsoRange(
      anyCfg.timezone || "Asia/Jerusalem",
      anyCfg.generalStartMin,
      anyCfg.generalEndMin,
     
    );
  }

  // getShiftWindows expects { logisticCenterId, name }
  const win = await getShiftWindows({ logisticCenterId, name: shiftName });
  const { timezone, general } = win;
  return shiftMinsToIsoRange(timezone || "Asia/Jerusalem", general.startMin, general.endMin);
}
