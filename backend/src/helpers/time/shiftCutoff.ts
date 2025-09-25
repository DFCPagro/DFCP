import { DateTime } from "luxon";

export type ShiftClock = {
  serviceDayUTC: Date;
  cutoffUTC: Date;
  endUTC: Date;
};

export function calcShiftCutoffUTC(params: {
  tz: string | undefined;
  startMin: number;
  endMin: number;
  cutoffMin?: number;
}): ShiftClock {
  const tz = params.tz || "Asia/Jerusalem";
  const cutoffMin = params.cutoffMin ?? 15;
  const startMin = params.startMin;
  const endMinRaw = params.endMin;

  const nowTz = DateTime.now().setZone(tz);
  const serviceDayTz = nowTz.startOf("day");
  const endMin = endMinRaw <= startMin ? endMinRaw + 1440 : endMinRaw;

  const endTz = serviceDayTz.plus({ minutes: endMin });
  const cutoffTz = endTz.minus({ minutes: cutoffMin });

  return {
    serviceDayUTC: serviceDayTz.toUTC().startOf("day").toJSDate(),
    cutoffUTC: cutoffTz.toUTC().toJSDate(),
    endUTC: endTz.toUTC().toJSDate(),
  };
}

export function calcShiftCutoffForServiceDayUTC(params: {
  tz: string | undefined;
  serviceDayUTC: Date;
  startMin: number;
  endMin: number;
  cutoffMin?: number;
}): { cutoffUTC: Date; endUTC: Date } {
  const tz = params.tz || "Asia/Jerusalem";
  const cutoffMin = params.cutoffMin ?? 15;
  const startMin = params.startMin;
  const endMinRaw = params.endMin;

  const serviceDayTz = DateTime.fromJSDate(params.serviceDayUTC, { zone: "utc" })
    .setZone(tz)
    .startOf("day");

  const endMin = endMinRaw <= startMin ? endMinRaw + 1440 : endMinRaw;
  const endTz = serviceDayTz.plus({ minutes: endMin });
  const cutoffTz = endTz.minus({ minutes: cutoffMin });

  return {
    cutoffUTC: cutoffTz.toUTC().toJSDate(),
    endUTC: endTz.toUTC().toJSDate(),
  };
}
