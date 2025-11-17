// src/services/farmerDelivery.service.ts

import { Types } from "mongoose";
import FarmerOrder, { type Shift } from "../models/farmerOrder.model";
import FarmerDelivery, {
  type FarmerDelivery as FarmerDeliveryType,
} from "../models/farmerDelivery.model";

import {
  planInboundDeliveriesForShift,
  type AddressLike,
} from "./farmerDeliveryPlanning.service";

import { getNextAvailableShifts } from "./shiftConfig.service";

export type FarmerDeliveryShiftSummary = {
  date: string;                 // "YYYY-MM-DD"
  shift: Shift;
  farmerOrdersCount: number;    // how many FO we have
  deliveriesCount: number;      // how many FarmerDelivery docs
  activeDeliverersCount: number;// stub: random 10–17 for now
  hasPlan: boolean;             // deliveriesCount > 0
};

/* -------------------------------------------------------------------------- */
/*                       Stub: active deliverers count                         */
/* -------------------------------------------------------------------------- */

export async function getActiveDeliverersCountForShift(_params: {
  logisticCenterId: string;
  date: string;
  shift: Shift;
}): Promise<number> {
  const min = 10;
  const max = 17;
  const value = Math.floor(Math.random() * (max - min + 1)) + min;
  return value;
}

/* -------------------------------------------------------------------------- */
/*                  Dashboard summary: current + next 5 shifts                 */
/* -------------------------------------------------------------------------- */

export async function getFarmerDeliveryDashboardSummary(params: {
  logisticCenterId: string;
  count?: number; // how many rows (shifts) to return – default 6
}): Promise<FarmerDeliveryShiftSummary[]> {
  const { logisticCenterId, count = 6 } = params;

  // Get upcoming shifts (date + shift name) from ShiftConfig
  const upcoming = await getNextAvailableShifts({
    logisticCenterId,
    count,
  });
  // upcoming: Array<{ date: "YYYY-MM-DD"; name: Shift }>

  const lcObjectId = new Types.ObjectId(logisticCenterId);

  const summaries: FarmerDeliveryShiftSummary[] = [];

  for (const row of upcoming) {
    const { date, name } = row;

    const farmerOrdersCount = await FarmerOrder.countDocuments({
      logisticCenterId: lcObjectId, // FarmerOrder stores ObjectId
      pickUpDate: date,
      shift: name,
    });

    const deliveriesCount = await FarmerDelivery.countDocuments({
      logisticCenterId, // FarmerDelivery stores string
      pickUpDate: date,
      shift: name,
    });

    const activeDeliverersCount = await getActiveDeliverersCountForShift({
      logisticCenterId,
      date,
      shift: name as Shift,
    });

    summaries.push({
      date,
      shift: name as Shift,
      farmerOrdersCount,
      deliveriesCount,
      activeDeliverersCount,
      hasPlan: deliveriesCount > 0,
    });
  }

  return summaries;
}

/* -------------------------------------------------------------------------- */
/*                      Ensure plan exists for a given shift                   */
/* -------------------------------------------------------------------------- */

export async function ensurePlanForShift(params: {
  logisticCenterId: string;
  logisticCenterAddress: AddressLike;
  pickUpDate: string; // "YYYY-MM-DD"
  shift: Shift;
  createdBy: Types.ObjectId;   // who triggered the planning
}): Promise<{ created: boolean; deliveries: FarmerDeliveryType[] }> {
  const {
    logisticCenterId,
    logisticCenterAddress,
    pickUpDate,
    shift,
    createdBy,
  } = params;

  const existing = await FarmerDelivery.find({
    logisticCenterId,     // string on FarmerDelivery
    pickUpDate,
    shift,
  });

  // console.log("[ensurePlanForShift] existing deliveries:", existing.length, logisticCenterId, pickUpDate, shift);

  if (existing.length > 0) {
    return { created: false, deliveries: existing as any };
  }

  const planned = await planInboundDeliveriesForShift({
    logisticCenterId,      // string id
    logisticCenterAddress,
    pickUpDate,
    shift,
    createdBy,
  });

  // console.log("[ensurePlanForShift] planned deliveries:", planned.length, logisticCenterId, pickUpDate, shift);

  return { created: true, deliveries: planned as any };
}

/* -------------------------------------------------------------------------- */
/*                            Get deliveries by shift                          */
/* -------------------------------------------------------------------------- */

export async function getFarmerDeliveriesByShift(params: {
  logisticCenterId: string;
  pickUpDate: string;
  shift: Shift;
}): Promise<FarmerDeliveryType[]> {
  const { logisticCenterId, pickUpDate, shift } = params;

  const deliveries = await FarmerDelivery.find({
    logisticCenterId, // string
    pickUpDate,
    shift,
  })
    .lean<FarmerDeliveryType[]>()
    .exec();

  return deliveries;
}
