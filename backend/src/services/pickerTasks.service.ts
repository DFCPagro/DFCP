import mongoose, { Types, PipelineStage } from "mongoose";
import { DateTime } from "luxon";
import PickerTaskModel from "../models/PickerTasks.model";
import ItemModel from "../models/Item.model";
import PackageSizeModel from "../models/PackageSize";
import ItemPackingModel from "../models/ItemPacking";

import {
  computePackingForOrderDoc,
  type ItemLite,
  type PackageSizeLite,
  type ItemPackingById,
  type ItemPackingOverride,
} from "./packing.service";

import { getShiftConfigByKey, getCurrentShift } from "./shiftConfig.service";
import { listOrdersForShift } from "./order.service";

type ShiftName = "morning" | "afternoon" | "evening" | "night";
const STATUS_ORDER = ["ready", "claimed", "in_progress", "open", "problem", "cancelled", "done"];

function toOid(v: string | Types.ObjectId): Types.ObjectId {
  return v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));
}

async function resolveCurrentShiftParams(
  logisticCenterId: string | Types.ObjectId,
  maybeName?: string | null,
  maybeDate?: string | null
) {
  const name: ShiftName = (maybeName as ShiftName) || ((await getCurrentShift()) as ShiftName);
  const cfg = await getShiftConfigByKey({ logisticCenterId: String(logisticCenterId), name });
  const tz = cfg?.timezone || "Asia/Jerusalem";
  const date =
    maybeDate && typeof maybeDate === "string"
      ? maybeDate
      : DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");
  return { shiftName: name, shiftDate: date, tz };
}

async function loadPackingOverrides(itemIds: string[]) {
  const overridesById: ItemPackingById = {};
  const ids = itemIds.filter((x) => mongoose.isValidObjectId(String(x))).map((x) => new Types.ObjectId(x));
  if (!ids.length) return overridesById;

  const ipDocs = await ItemPackingModel.find({ "items.itemId": { $in: ids } })
    .select(
      [
        "items.itemId",
        "items.packing.fragility",
        "items.packing.allowMixing",
        "items.packing.requiresVentedBox",
        "items.packing.minBoxType",
        "items.packing.maxWeightPerPackageKg",
        "items.packing.maxKgPerBag",
        "items.packing.densityKgPerL",
        "items.packing.unitVolLiters",
      ].join(" ")
    )
    .lean();

  for (const doc of ipDocs || []) {
    for (const it of (doc as any).items || []) {
      const key = String(it.itemId);
      const p = it?.packing || {};
      const ov: ItemPackingOverride = {};
      if (p.fragility) ov.fragility = p.fragility;
      if (typeof p.allowMixing === "boolean") ov.allowMixing = p.allowMixing;
      if (typeof p.requiresVentedBox === "boolean") ov.requiresVentedBox = p.requiresVentedBox;
      if (p.minBoxType) ov.minBoxType = p.minBoxType;
      if (typeof p.maxWeightPerPackageKg === "number") ov.maxWeightPerPackageKg = p.maxWeightPerPackageKg;
      if (typeof p.maxKgPerBag === "number") ov.maxKgPerBag = p.maxKgPerBag;
      if (typeof p.densityKgPerL === "number") ov.densityKgPerL = p.densityKgPerL;
      if (typeof p.unitVolLiters === "number") ov.unitVolLiters = p.unitVolLiters;
      overridesById[key] = { ...(overridesById[key] || {}), ...ov };
    }
  }
  return overridesById;
}



/** Create picker tasks (one per box) for a shift */
export async function generatePickerTasksForShift(params: {
  logisticCenterId: string | Types.ObjectId;
  createdByUserId: string | Types.ObjectId;
  shiftName?: ShiftName | null;
  shiftDate?: string | null; // yyyy-LL-dd
  priority?: number;
  stageKey?: string;  // ⬅️ no longer used to filter orders
  autoSetReady?: boolean; // default true
}) {
  const {
    logisticCenterId,
    createdByUserId,
    shiftName,
    shiftDate,
    priority = 0,
    autoSetReady = true,
  } = params;

  const { shiftName: sName, shiftDate: sDate, tz } = await resolveCurrentShiftParams(
    logisticCenterId,
    shiftName,
    shiftDate
  );

  // 1) get ALL orders for this LC + shiftDate + shiftName (no stage filter)
  const { items: orders } = await listOrdersForShift({
    logisticCenterId: String(logisticCenterId),
    date: sDate,
    shiftName: sName,
    page: 1,
    limit: 5000,
    fields: [
      "_id",
      "items.itemId",
      "items.name",
      "items.quantityKg",
      "items.units",
      "items.estimatesSnapshot.avgWeightPerUnitKg",
      "shiftName",
      "deliveryDate",
      "pickUpDate",
      // stages/stageKey are no longer used to filter
    ],
  });

  if (!orders?.length) {
    return {
      createdCount: 0,
      alreadyExisted: 0,
      shiftName: sName,
      shiftDate: sDate,
      tz,
      ordersProcessed: 0,
      examples: [],
    };
  }

  // 2) find which orders already have ANY picker task for this LC+shift
  const existing = await PickerTaskModel.aggregate([
    {
      $match: {
        logisticCenterId: toOid(logisticCenterId),
        shiftName: sName,
        shiftDate: sDate,
      },
    },
    { $group: { _id: "$orderId", n: { $sum: 1 } } },
  ]);

  const orderIdsWithTasks = new Set<string>(existing.map((x: any) => String(x._id)));

  // 3) only create for orders that don't have tasks yet
  const toCreate = (orders as any[]).filter((o) => !orderIdsWithTasks.has(String(o._id)));

  if (!toCreate.length) {
    return {
      createdCount: 0,
      alreadyExisted: existing.length,
      shiftName: sName,
      shiftDate: sDate,
      tz,
      ordersProcessed: orders.length,
      examples: await PickerTaskModel.find({
        logisticCenterId: toOid(logisticCenterId),
        shiftName: sName,
        shiftDate: sDate,
      })
        .sort({ createdAt: -1 })
        .limit(3)
        .lean()
        .exec(),
    };
  }

  // 4) pre-load item docs + packing overrides for packing
  const allItemIds = Array.from(
    new Set(toCreate.flatMap((o: any) => (o.items || []).map((l: any) => String(l.itemId))))
  );

  const itemDocs = await ItemModel.find({ _id: { $in: allItemIds } })
    .select("_id name category type variety avgWeightPerUnitGr")
    .lean();
  const itemsById: Record<string, ItemLite> = Object.fromEntries(
    (itemDocs || []).map((it: any) => [String(it._id), it as ItemLite])
  );

  const packageSizes = (await PackageSizeModel.find({})
    .select(
      "key innerDimsCm headroomPct usableLiters maxWeightKg vented maxSkusPerBox mixingAllowed"
    )
    .lean()) as unknown as PackageSizeLite[];

  const overridesById = await loadPackingOverrides(allItemIds);

  // 5) build upserts (one per box)
  const ops: any[] = [];
  const dedupe = new Set<string>();

  for (const order of toCreate) {
    const plan = computePackingForOrderDoc(order as any, itemsById, packageSizes, overridesById);
    const boxes = (plan?.boxes || []) as Array<any>;
    for (const b of boxes) {
      if (!b?.contents?.length) continue;
      const key = `${order._id}:${b.boxNo}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      ops.push({
        updateOne: {
          filter: { orderId: toOid(order._id), boxNo: b.boxNo },
          update: {
            $setOnInsert: {
              logisticCenterId: toOid(logisticCenterId),
              shiftName: sName,
              shiftDate: sDate,
              orderId: toOid(order._id),
              boxNo: b.boxNo,
              boxType: String(b.boxType || "Medium"),
              contents: (b.contents || []).map((c: any) => ({
                itemId: toOid(String(c.itemId)),
                name: c.itemName || itemsById[String(c.itemId)]?.name || String(c.itemId),
                estWeightKgPiece: c.estWeightKgPiece ?? null,
                estUnitsPiece: c.estUnitsPiece ?? null,
                liters: c.liters ?? null,
              })),
              totalEstKg: Number(b.totalWeightKg || 0),
              totalEstUnits: Number(b.totalUnits || 0),
              totalLiters: Number(b.totalLiters || 0),
              status: "open",
              priority,
              assignedPickerUserId: null,
              progress: {
                currentStepIndex: 0,
                placedKg: 0,
                placedUnits: 0,
                startedAt: null,
                finishedAt: null,
              },
              createdByUserId: toOid(createdByUserId),
              createdAt: new Date(),
              updatedAt: new Date(),
              historyAuditTrail: [],
              notes: "",
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (!ops.length) {
    return {
      createdCount: 0,
      alreadyExisted: existing.length,
      shiftName: sName,
      shiftDate: sDate,
      tz,
      ordersProcessed: orders.length,
      examples: [],
    };
  }

  const bulk = await PickerTaskModel.bulkWrite(ops, { ordered: false });
  const upserts = bulk?.upsertedCount ?? 0;
  const matched = bulk?.matchedCount ?? 0; // rare, thanks to pre-check

  if (autoSetReady) {
    await PickerTaskModel.updateMany(
      {
        logisticCenterId: toOid(logisticCenterId),
        shiftName: sName,
        shiftDate: sDate,
        status: "open",
      },
      { $set: { status: "ready", updatedAt: new Date() } }
    );
  }

  const examples = await PickerTaskModel.find({
    logisticCenterId: toOid(logisticCenterId),
    shiftName: sName,
    shiftDate: sDate,
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean()
    .exec();

  return {
    createdCount: upserts,
    alreadyExisted: matched + existing.length,
    shiftName: sName,
    shiftDate: sDate,
    tz,
    ordersProcessed: orders.length,
    examples,
  };
}


// ---------- listing ----------
function pageLimit(page?: number, limit?: number) {
  const p = Math.max(1, Number.isFinite(page as number) ? (page as number) : 1);
  const l = Math.min(500, Math.max(1, Number.isFinite(limit as number) ? (limit as number) : 100));
  const skip = (p - 1) * l;
  return { p, l, skip };
}

type AssignmentFilter = {
  assignedOnly?: boolean;
  unassignedOnly?: boolean;
  pickerUserId?: string | Types.ObjectId;
};

async function aggregateList(
  q: any,
  p: number,
  l: number,
  skip: number
): Promise<{
  items: any[];
  total: number;
  countsByStatus: Record<string, number>;
  countsByAssignment: { assigned: number; unassigned: number };
}> {
  const baseMatch: PipelineStage.Match = { $match: q };

  const addStatusOrder: PipelineStage.AddFields = {
    $addFields: {
      __status_ord: {
        $let: {
          vars: { ix: { $indexOfArray: [STATUS_ORDER, "$status"] } },
          in: { $cond: [{ $gte: ["$$ix", 0] }, "$$ix", 99] },
        },
      },
      isAssigned: { $ne: ["$assignedPickerUserId", null] },
    },
  };

  const sortStage: PipelineStage.Sort = {
    $sort: { __status_ord: 1, priority: -1, createdAt: 1, _id: 1 },
  };

  const pageStages: PipelineStage[] = [{ $skip: skip }, { $limit: l }];

  const [items, total, byStatus, byAssignment] = await Promise.all([
    PickerTaskModel.aggregate([baseMatch, addStatusOrder, sortStage, ...pageStages]),
    PickerTaskModel.countDocuments(q),
    PickerTaskModel.aggregate([baseMatch, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    PickerTaskModel.aggregate([
      baseMatch,
      { $group: { _id: { $ne: ["$assignedPickerUserId", null] }, count: { $sum: 1 } } },
    ]),
  ]);

  const countsByStatus = Object.fromEntries(byStatus.map((x: any) => [x._id, x.count]));
  const countsByAssignment = {
    assigned: byAssignment.find((x: any) => x._id === true)?.count ?? 0,
    unassigned: byAssignment.find((x: any) => x._id === false)?.count ?? 0,
  };

  return { items, total, countsByStatus, countsByAssignment };
}

export async function listPickerTasksForShift(params: {
  logisticCenterId: string | Types.ObjectId;
  shiftName: ShiftName;
  shiftDate: string; // yyyy-LL-dd
  status?: string;
  page?: number;
  limit?: number;
} & AssignmentFilter) {
  const {
    logisticCenterId,
    shiftName,
    shiftDate,
    status,
    page,
    limit,
    assignedOnly,
    unassignedOnly,
    pickerUserId,
  } = params;

  const q: any = {
    logisticCenterId: toOid(logisticCenterId),
    shiftName,
    shiftDate,
  };

  if (status) q.status = status;

  if (assignedOnly) q.assignedPickerUserId = { $ne: null };
  else if (unassignedOnly) q.assignedPickerUserId = null;

  if (pickerUserId) q.assignedPickerUserId = toOid(pickerUserId);

  const { p, l, skip } = pageLimit(page, limit);
  const { items, total, countsByStatus, countsByAssignment } =
    await aggregateList(q, p, l, skip);

  return {
    shift: { logisticCenterId: String(logisticCenterId), shiftName, shiftDate },
    pagination: { page: p, limit: l, total },
    countsByStatus,
    countsByAssignment,
    items,
  };
}

/** Ensure (generate missing) then list */
export async function ensureAndListPickerTasksForShift(params: {
  logisticCenterId: string | Types.ObjectId;
  createdByUserId: string | Types.ObjectId;
  shiftName: ShiftName;
  shiftDate: string;
  status?: string;
  page?: number;
  limit?: number;
  assignedOnly?: boolean;
  unassignedOnly?: boolean;
  pickerUserId?: string | Types.ObjectId;
}) {
  const {
    logisticCenterId,
    createdByUserId,
    shiftName,
    shiftDate,
    status,
    page,
    limit,
    assignedOnly,
    unassignedOnly,
    pickerUserId,
  } = params;

  const ensure = await generatePickerTasksForShift({
    logisticCenterId,
    createdByUserId,
    shiftName,
    shiftDate,
    stageKey: "open",
    priority: 0,
    autoSetReady: true,
  });

  const data = await listPickerTasksForShift({
    logisticCenterId,
    shiftName,
    shiftDate,
    status,
    page,
    limit,
    assignedOnly,
    unassignedOnly,
    pickerUserId,
  });

  return { ensure, data };
}
