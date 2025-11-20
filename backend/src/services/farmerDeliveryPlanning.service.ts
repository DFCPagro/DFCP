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
import { Item } from "../models/Item.model";
import { ContainerSize } from "../models/containerSize.model";
import {
  estimateContainersForItemQuantity,
  type ContainerSizeLite,
} from "./containerPacking.service";
import type { ItemLite } from "./packing.service";

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
 * Pure helper: given a FarmerOrder-like object, its Item data, and all container
 * sizes, return just the *number* of expected containers for that order.
 *
 * Uses:
 *  - finalQuantityKg
 *  - then forcastedQuantityKg (same spelling as model)
 *  - then sumOrderedQuantityKg
 */
export function getExpectedContainersForOrder(
  order: {
    finalQuantityKg?: number;
    forcastedQuantityKg?: number;
    sumOrderedQuantityKg?: number;
  },
  item: ItemLite | undefined,
  containers: ContainerSizeLite[]
): number {
  if (!item || !containers.length) return 0;

  const quantityKg =
    order.finalQuantityKg ??
    order.forcastedQuantityKg ?? // alias forecastedQuantityKg
    order.sumOrderedQuantityKg ??
    0;

  if (!quantityKg || quantityKg <= 0) return 0;

  const estimate = estimateContainersForItemQuantity(
    item,
    quantityKg,
    containers
  );

  return estimate?.containersNeeded ?? 0;
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
 * We now also need:
 *  - itemsById: ItemLite map
 *  - containers: ContainerSizeLite[]
 *
 * to compute expectedContainers as a *number*.
 */
function groupOrdersIntoStopsByAddress<T extends {
  pickupAddress?: AddressLike;
  farmerId: Types.ObjectId;
  farmerName: string;
  farmName: string;
  _id: any;
  itemId: any;
  finalQuantityKg?: number;
  sumOrderedQuantityKg?: number;
  forcastedQuantityKg?: number;
}>(
  orders: T[],
  itemsById: Record<string, ItemLite>,
  containers: ContainerSizeLite[]
): StopGroup[] {
  const map = new Map<string, StopGroup>();

  for (const o of orders) {
    const addr = o.pickupAddress as AddressLike | undefined;
    if (!addr) continue;

    // key purely by address (text + coords)
    const key = [addr.address, addr.lnt, addr.alt].join("|");

    const item = itemsById[String(o.itemId)];
    const expectedContainers = getExpectedContainersForOrder(
      o,
      item,
      containers
    );
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
  const lcObjectId = new Types.ObjectId(logisticCenterId);

  const orders = await FarmerOrder.find({
    logisticCenterId: lcObjectId,
    pickUpDate,
    shift,
    farmerStatus: "ok",
  }).lean();

  if (!orders.length) return [];

  // 2b) Preload Items and Containers once (for container estimation)

  const itemIds = Array.from(
    new Set(orders.map((o: any) => String(o.itemId)))
  );

  const itemDocs = await Item.find({ _id: { $in: itemIds } }).lean();

  const itemsById: Record<string, ItemLite> = {};
  for (const it of itemDocs) {
    itemsById[String(it._id)] = {
      _id: String(it._id),
      name: `${it.type ?? ""} ${it.variety ?? ""}`.trim(),
      category: it.category,
      type: it.type,
      variety: it.variety,
      avgWeightPerUnitGr: it.avgWeightPerUnitGr,
    };
  }

  const containersDocs = await ContainerSize.find({}).lean();
  const containersLite: ContainerSizeLite[] = containersDocs.map((c: any) => ({
    key: c.key,
    name: c.name,
    usableLiters: c.usableLiters,
    maxWeightKg: c.maxWeightKg,
    vented: c.vented,
  }));

  // 3) Group into stops by address (now with expectedContainers based on quantity)
  const groups = groupOrdersIntoStopsByAddress(
    orders as any[],
    itemsById,
    containersLite
  );

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
      currentPlannedEndAt = shiftStart
        .plus({ minutes: totalMinutesOut })
        .toJSDate();
    }
  }

  // finalize leftover
  finalizeCurrentTrip();

  // persist all trips
  const saved = await FarmerDelivery.insertMany(createdTrips);
  return saved as any;
}



/* -------------------------------------------------------------------------- */
/*  Per-FO container estimates + totals for this LC+date+shift                */
/* -------------------------------------------------------------------------- */

/**
 * For all FarmerOrders in a given LC + date + shift:
 *  - compute containers *per FO*:
 *      • estimatedContainers = based on forecast (forcastedQuantityKg → sumOrderedQuantityKg)
 *      • currentlyEstimatedContainers = based on current/final (finalQuantityKg → sumOrderedQuantityKg)
 *  - return:
 *      • perOrder list
 *      • totals: sum over all FO
 */
export async function computeContainerEstimatesForShiftOrders(params: {
  logisticCenterId: string;
  pickUpDate: string;
  shift: Shift;
}): Promise<{
  perOrder: Array<{
    farmerOrderId: string;
    itemId: string;
    itemName: string;
    estimatedContainers: number;
    currentlyEstimatedContainers: number;
  }>;
  totalEstimatedContainers: number;
  totalCurrentlyEstimatedContainers: number;
}> {
  const { logisticCenterId, pickUpDate, shift } = params;

  const lcObjectId = new Types.ObjectId(logisticCenterId);

  const orders = await FarmerOrder.find({
    logisticCenterId: lcObjectId,
    pickUpDate,
    shift,
    farmerStatus: "ok",
  }).lean();

  if (!orders.length) {
    return {
      perOrder: [],
      totalEstimatedContainers: 0,
      totalCurrentlyEstimatedContainers: 0,
    };
  }

  // ---- preload items ----
  const itemIds = Array.from(
    new Set(orders.map((o: any) => String(o.itemId)))
  );

  const itemDocs = await Item.find({ _id: { $in: itemIds } }).lean();

  const itemsById: Record<string, ItemLite> = {};
  for (const it of itemDocs) {
    itemsById[String(it._id)] = {
      _id: String(it._id),
      name: `${it.type ?? ""} ${it.variety ?? ""}`.trim(), // type + variety
      category: it.category,
      type: it.type,
      variety: it.variety,
      avgWeightPerUnitGr: it.avgWeightPerUnitGr,
    };
  }

  // ---- preload containers ----
  const containersDocs = await ContainerSize.find({}).lean();
  const containersLite: ContainerSizeLite[] = containersDocs.map((c: any) => ({
    key: c.key,
    name: c.name,
    usableLiters: c.usableLiters,
    maxWeightKg: c.maxWeightKg,
    vented: c.vented,
  }));

  const perOrder: Array<{
    farmerOrderId: string;
    itemId: string;
    itemName: string;
    estimatedContainers: number;
    currentlyEstimatedContainers: number;
  }> = [];

  let totalEstimatedContainers = 0;
  let totalCurrentlyEstimatedContainers = 0;

  for (const o of orders) {
    const item = itemsById[String(o.itemId)];
    if (!item) continue;

    // ---- estimated: forecast-based ----
    const qtyEstimatedKg =
      (o as any).forcastedQuantityKg ??
      (o as any).sumOrderedQuantityKg ??
      0;

    let estimatedContainers = 0;
    if (qtyEstimatedKg > 0) {
      const est = estimateContainersForItemQuantity(
        item,
        qtyEstimatedKg,
        containersLite
      );
      estimatedContainers = est?.containersNeeded ?? 0;
    }

    // ---- currentlyEstimated: final-based ----
    const qtyCurrentKg =
      (o as any).finalQuantityKg ??
      (o as any).sumOrderedQuantityKg ??
      0;

    let currentlyEstimatedContainers = 0;
    if (qtyCurrentKg > 0) {
      const cur = estimateContainersForItemQuantity(
        item,
        qtyCurrentKg,
        containersLite
      );
      currentlyEstimatedContainers = cur?.containersNeeded ?? 0;
    }

    totalEstimatedContainers += estimatedContainers;
    totalCurrentlyEstimatedContainers += currentlyEstimatedContainers;

    perOrder.push({
      farmerOrderId: String(o._id),
      itemId: String(o.itemId),
      itemName: item.name || "",
      estimatedContainers,
      currentlyEstimatedContainers,
    });
  }

  return {
    perOrder,
    totalEstimatedContainers,
    totalCurrentlyEstimatedContainers,
  };
}
