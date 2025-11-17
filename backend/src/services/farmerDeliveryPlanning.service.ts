// src/services/farmerDeliveryPlanning.service.ts

import { Types } from "mongoose";
import { DateTime } from "luxon";

import FarmerOrder, {
  type Shift,
  type FarmerOrder as FarmerOrderType,
} from "../models/farmerOrder.model";
import FarmerDelivery, {
  type FarmerDelivery as FarmerDeliveryType,
} from "../models/farmerDelivery.model";

import { getShiftWindows } from "./shiftConfig.service";

const MAX_MINUTES_TO_FIRST_STOP = 90;  // 1.5h
const MAX_MINUTES_TO_RETURN     = 180; // 3h

// Shape compatible with your AddressSchema
export type AddressLike = {
  lnt: number;           // longitude
  alt: number;           // latitude
  address: string;
  logisticCenterId?: string | null;
  note?: string;
};

/* -------------------------------------------------------------------------- */
/*                         Helper: expected containers                         */
/* -------------------------------------------------------------------------- */

/**
 * TEMP: Simple heuristic for expected containers per order.
 * For now: always return 10.
 * Later you can compute from finalQuantityKg, avg kg per container, etc.
 */
export function getExpectedContainersForOrder(order: any): number {
  // you can use order.finalQuantityKg etc. later
  return 10;
}

/* -------------------------------------------------------------------------- */
/*                       Helper: travel time estimation                        */
/* -------------------------------------------------------------------------- */

/**
 * Simple distance-based travel time estimator (Haversine + constant speed).
 * Replace later with real map API if needed.
 */
function estimateTravelMinutesBetween(a: AddressLike, b: AddressLike): number {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad((b.alt ?? 0) - (a.alt ?? 0));
  const dLng = toRad((b.lnt ?? 0) - (a.lnt ?? 0));

  const lat1 = toRad(a.alt ?? 0);
  const lat2 = toRad(b.alt ?? 0);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const aa =
    sinDLat * sinDLat +
    sinDLng * sinDLng * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  const distanceKm = R * c;

  const SPEED_KM_H = 40; // assume 40 km/h average
  const hours = distanceKm / SPEED_KM_H;
  const minutes = hours * 60;

  // minimum few minutes even for same-place stops
  return Math.max(5, Math.round(minutes));
}

/* -------------------------------------------------------------------------- */
/*                    Helper: group orders into stops by address              */
/* -------------------------------------------------------------------------- */

type StopGroup = {
  address: AddressLike;
  farmerId: Types.ObjectId;
  farmerName: string;
  farmName: string;
  farmerOrderIds: Types.ObjectId[];
  expectedContainers: number;
  expectedWeightKg: number;
};

/**
 * Group FarmerOrders into physical stops.
 * Group key = address (same AddressSchema → same stop).
 *
 * Make it generic so it works with `lean()` results (FlattenMaps, etc.).
 */
function groupOrdersIntoStopsByAddress<T extends {
  pickupAddress?: AddressLike;
  farmerId: Types.ObjectId;
  farmerName: string;
  farmName: string;
  _id: any;
  finalQuantityKg?: number;
  sumOrderedQuantityKg?: number;
}>(orders: T[]): StopGroup[] {
  const map = new Map<string, StopGroup>();

  for (const o of orders) {
    const addr = o.pickupAddress as AddressLike | undefined;
    if (!addr) continue;

    // key purely by address (text + coords)
    const key = [addr.address, addr.lnt, addr.alt].join("|");

    const expectedContainers = getExpectedContainersForOrder(o);
    const expectedWeightKg = Number(
      o.finalQuantityKg ?? o.sumOrderedQuantityKg ?? 0
    );

    if (!map.has(key)) {
      map.set(key, {
        address: addr,
        farmerId: o.farmerId,
        farmerName: o.farmerName,
        farmName: o.farmName,
        farmerOrderIds: [o._id],
        expectedContainers,
        expectedWeightKg,
      });
    } else {
      const g = map.get(key)!;
      g.farmerOrderIds.push(o._id);
      g.expectedContainers += expectedContainers;
      g.expectedWeightKg += expectedWeightKg;
    }
  }

  return Array.from(map.values());
}

/* -------------------------------------------------------------------------- */
/*        Main service: planInboundDeliveriesForShift (no driver yet)         */
/* -------------------------------------------------------------------------- */

/**
 * Plan inbound FarmerDelivery trips for a given LC + date + shift.
 *
 * Uses:
 *  - FarmerOrder.pickupAddress as source-of-truth for location.
 *  - ShiftConfig (industrialDeliverer window) to compute shiftStartAt.
 *  - SLA:
 *      • first stop ETA ≤ shiftStartAt + 1.5h
 *      • return to LC ≤ shiftStartAt + 3h
 *
 * Note:
 *  - logisticCenterAddress must be passed in (AddressSchema-like).
 *  - delivererId is NOT assigned here; that’s a separate step.
 */
export async function planInboundDeliveriesForShift(params: {
  logisticCenterId: string;           // same id you use in ShiftConfig (and as hex ObjectId for FarmerOrder.lcId)
  logisticCenterAddress: AddressLike; // LC address+coords
  pickUpDate: string;                 // "YYYY-MM-DD"
  shift: Shift;
  createdBy: Types.ObjectId;          // user who triggered planning
}): Promise<FarmerDeliveryType[]> {
  const {
    logisticCenterId,
    logisticCenterAddress,
    pickUpDate,
    shift,
    createdBy,
  } = params;

  // 1) Get shift windows for this LC + shift to compute shiftStartAt from config
  const windows = await getShiftWindows({
    logisticCenterId,
    name: shift,
  });

  const tz = windows.timezone || "Asia/Jerusalem";
  const industrial = windows.industrialDeliverer; // { startMin, endMin }

  // Use the *industrial deliverer* start minute as shiftStartAt baseline
  const baseDate = DateTime.fromISO(pickUpDate, { zone: tz }).startOf("day");
  const shiftStart = baseDate.plus({ minutes: industrial.startMin });
  const shiftStartAtDate = shiftStart.toJSDate();

  // 2) Load FarmerOrders for this LC + date + shift
  //    Assuming FarmerOrder.logisticCenterId is ObjectId, with hex string logisticCenterId.
  const lcObjectId = new Types.ObjectId(logisticCenterId);

  const orders = await FarmerOrder.find({
    logisticCenterId: lcObjectId,
    pickUpDate,
    shift,
    farmerStatus: "ok",
  }).lean();

  if (!orders.length) return [];

  // 3) Group into stops by address
  const groups = groupOrdersIntoStopsByAddress(orders as any []);

  // 4) Sort stops by distance from LC (nearest first)
  const sortedStops = [...groups].sort((a, b) => {
    const da = estimateTravelMinutesBetween(logisticCenterAddress, a.address);
    const db = estimateTravelMinutesBetween(logisticCenterAddress, b.address);
    return da - db;
  });

  // 5) Build one or more FarmerDelivery trips under SLA constraints
  const createdTrips: FarmerDeliveryType[] = [];
  let currentStops: any[] = [];
  let currentPlannedStartAt: Date | null = null;
  let currentPlannedEndAt: Date | null = null;

  function finalizeCurrentTrip() {
    if (!currentStops.length) return;

    const trip = new FarmerDelivery({
      // no driver yet
      delivererId: null,
      logisticCenterId,    // string, e.g. "66e007000000000000000001" or "LC-1"
      pickUpDate,
      shift,
      shiftStartAt: shiftStartAtDate,

      // stages & stageKey come from schema defaults (planned)
      plannedStartAt: currentPlannedStartAt ?? shiftStartAtDate,
      plannedEndAt: currentPlannedEndAt,

      stops: currentStops.map((s: any, idx: number) => ({
        type: "pickup",
        label: s.farmName,
        address: s.address,
        farmerId: s.farmerId,
        farmerName: s.farmerName,
        farmName: s.farmName,
        farmerOrderIds: s.farmerOrderIds,
        sequence: idx,
        expectedContainers: s.expectedContainers,
        expectedWeightKg: s.expectedWeightKg,

        scans: [],
        loadedContainersCount: 0,
        loadedWeightKg: 0,
        status: "planned",

        plannedAt: s.plannedAt,
        arrivedAt: null,
        departedAt: null,
        loadingStartedAt: null,
        loadingFinishedAt: null,
        note: "",
      })),

      historyAuditTrail: [
        {
          userId: createdBy,
          action: "TRIP_PLANNED",
          note: "Auto-planned inbound route",
          meta: { pickUpDate, shift },
          timestamp: new Date(),
        },
      ],
    });

    createdTrips.push(trip as any);
    currentStops = [];
    currentPlannedStartAt = null;
    currentPlannedEndAt = null;
  }

  for (const g of sortedStops) {
  const candidateStops = [...currentStops, g];

  // simulate route for candidateStops using minutes only
  let timeCursor = shiftStart;
  let totalMinutesOut = 0;                 // minutes from shiftStart for full trip
  let firstStopMinutesFromStart: number | null = null;
  let lastAddress: AddressLike = logisticCenterAddress;

  const stopsWithPlan = candidateStops.map((s, idx) => {
    const legMinutes = estimateTravelMinutesBetween(lastAddress, s.address);
    totalMinutesOut += legMinutes;
    timeCursor = timeCursor.plus({ minutes: legMinutes });

    if (idx === 0) {
      // minutes until first stop from shiftStart
      firstStopMinutesFromStart = totalMinutesOut;
    }

    const res = {
      ...s,
      plannedAt: timeCursor.toJSDate(),
    };

    lastAddress = s.address;
    return res;
  });

  // travel back to LC
  const backMinutes = estimateTravelMinutesBetween(
    lastAddress,
    logisticCenterAddress
  );
  totalMinutesOut += backMinutes;

  // SLA checks: we now have:
  //  - firstStopMinutesFromStart
  //  - totalMinutesOut  (full trip duration)
  const firstEtaMinutesFromShift = firstStopMinutesFromStart ?? 0;
  const totalMinutesFromShift = totalMinutesOut;

  const violatesFirstStop =
    firstEtaMinutesFromShift > MAX_MINUTES_TO_FIRST_STOP;
  const violatesReturn = totalMinutesFromShift > MAX_MINUTES_TO_RETURN;

  if (violatesFirstStop || violatesReturn) {
    // current candidate would break SLA -> close previous trip and start new
    finalizeCurrentTrip();

    // start a fresh trip with just this group g
    const legToFirst = estimateTravelMinutesBetween(
      logisticCenterAddress,
      g.address
    );
    const firstEta = shiftStart.plus({ minutes: legToFirst });
    const back = estimateTravelMinutesBetween(
      g.address,
      logisticCenterAddress
    );
    const retEta = firstEta.plus({ minutes: back });

    currentStops = [
      {
        ...g,
        plannedAt: firstEta.toJSDate(),
      },
    ];
    currentPlannedStartAt = shiftStartAtDate;
    currentPlannedEndAt = retEta.toJSDate();
  } else {
    // candidate is still valid under SLA → continue accumulating stops
    currentStops = stopsWithPlan;
    currentPlannedStartAt = shiftStartAtDate;
    currentPlannedEndAt = shiftStart.plus({ minutes: totalMinutesOut }).toJSDate();
  }
}


  // finalize leftover
  finalizeCurrentTrip();

  // persist all trips
  const saved = await FarmerDelivery.insertMany(createdTrips);
  return saved as any;
}
