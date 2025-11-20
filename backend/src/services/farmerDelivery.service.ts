// src/services/farmerDelivery.service.ts

import { Types } from "mongoose";
import FarmerOrder, { type Shift } from "../models/farmerOrder.model";
import FarmerDelivery, {
  type FarmerDelivery as FarmerDeliveryType,
} from "../models/farmerDelivery.model";
import { getWorkersForShift} from "./schedule.service"
import {
  planInboundDeliveriesForShift,
  type AddressLike,
} from "./farmerDeliveryPlanning.service";

import { getNextAvailableShifts } from "./shiftConfig.service";
import { toIdString } from '../utils/validations/mongose';

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

///**************************************change it to get role and active or not 

export async function getActiveDeliverersCountForShift(params: {
  logisticCenterId: string;
  date: string;       // "YYYY-MM-DD"
  shift: Shift;       // "morning" | "afternoon" | "evening" | "night"
}): Promise<number> {
  const { logisticCenterId, date, shift } = params;

  const result = await getWorkersForShift({
    role: "industrialDeliverer",
    shiftName: shift,
    date,
    scheduleType: "active" ,   // or whatever ScheduleType you want
    logisticCenterId,
  });
  console.log(result.workers.length)
  return result.workers.length;
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

  // 1) Check if we already have a plan for this LC + date + shift
  const existing = await FarmerDelivery.find({
    logisticCenterId, // string on FarmerDelivery
    pickUpDate,
    shift,
  });

  const hadExisting = existing.length > 0;

  // 2) If something already exists, wipe it so we can fully recompute
  //    (containers & assignments will be recalculated from scratch)
  if (hadExisting) {
    await FarmerDelivery.deleteMany({
      logisticCenterId,
      pickUpDate,
      shift,
    });
  }

  // 3) Always re-run the planner — it should:
  //    - read current FarmerOrders / containers for this shift
  //    - recompute all trips & container assignments
  const planned = await planInboundDeliveriesForShift({
    logisticCenterId,      // string id
    logisticCenterAddress,
    pickUpDate,
    shift,
    createdBy,
  });

  // If there was an existing plan, `created` is false (we UPDATED / recalced).
  // If not, then we CREATED the plan for the first time.
  return {
    created: !hadExisting,
    deliveries: planned as any,
  };
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
