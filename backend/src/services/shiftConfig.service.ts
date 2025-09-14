import ShiftConfig, { ShiftConfig as ShiftConfigType } from "../models/shiftConfig.model";
import ApiError from "../utils/ApiError";
import { normalizeWindow } from "../utils/time";

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
    logisticCenterId: cfg.logisticCenterId,
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
    logisticCenterId: cfg.logisticCenterId,
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
