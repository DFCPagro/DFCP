// src/services/pickerTask.service.ts
import mongoose, { Types, PipelineStage } from "mongoose";
import { DateTime } from "luxon";

import PickerTaskModel from "../models/PickerTasks.model";
import ItemModel from "../models/Item.model";
import PackageSizeModel from "../models/PackageSize";
import ItemPackingModel from "../models/ItemPacking";
import { getContactInfoByIdService } from "./user.service";
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

/* =========================
 * Shift helpers
 * ========================= */
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

/* =========================
 * Packing overrides
 * ========================= */
async function loadPackingOverrides(itemIds: string[]) {
  const overridesById: ItemPackingById = {};
  const ids = itemIds
    .filter((x) => mongoose.isValidObjectId(String(x)))
    .map((x) => new Types.ObjectId(x));
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

/* =========================
 * Generate (ONE task per order)
 * ========================= */
export async function generatePickerTasksForShift(params: {
  logisticCenterId: string | Types.ObjectId;
  createdByUserId: string | Types.ObjectId;
  shiftName?: ShiftName | null;
  shiftDate?: string | null; // yyyy-LL-dd
  priority?: number;
  stageKey?: string; // not used to filter orders anymore
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

  // 1) Fetch all orders for LC + date + shift
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

  // 2) Orders that already have a task for this LC+shift+date
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

  // 3) Only create for orders without tasks
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

  // 4) Preload items + packages + overrides for packing
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

  // 5) Build upserts (ONE per order)
  const ops: any[] = [];

  for (const order of toCreate) {
    const plan = computePackingForOrderDoc(order as any, itemsById, packageSizes, overridesById); // <- your PackingPlan

    const boxes = plan?.boxes ?? [];

    // rollups using your PackingPlan fields
    const totalEstKg = boxes.reduce((s, b) => s + (Number(b.estWeightKg) || 0), 0);
    const totalLiters = boxes.reduce((s, b) => s + (Number(b.estFillLiters) || 0), 0);
    const totalEstUnits = boxes.reduce(
      (s, b) =>
        s +
        (b.contents || []).reduce(
          (ss, c) => ss + (c.mode === "unit" ? Number(c.units || 0) : 0),
          0
        ),
      0
    );

    ops.push({
      updateOne: {
        // Scope uniqueness to LC + shift + date + order
        filter: {
          logisticCenterId: toOid(logisticCenterId),
          shiftName: sName,
          shiftDate: sDate,
          orderId: toOid(order._id),
        },
        update: {
          // keep insert-only by default; if you want reruns to refresh plan, move fields to $set
          $setOnInsert: {
            logisticCenterId: toOid(logisticCenterId),
            shiftName: sName,
            shiftDate: sDate,
            orderId: toOid(order._id),

            // store plan EXACTLY as PackingPlan (normalized numbers, ObjectIds)
            plan: {
              boxes: boxes.map((b) => ({
                boxNo: b.boxNo,
                boxType: String(b.boxType),
                vented: typeof b.vented === "boolean" ? b.vented : undefined,
                estFillLiters: Number(b.estFillLiters || 0),
                estWeightKg: Number(b.estWeightKg || 0),
                fillPct: Number(b.fillPct || 0),
                contents: (b.contents || []).map((c) => ({
                  itemId: toOid(String(c.itemId)),
                  itemName: c.itemName,
                  pieceType: c.pieceType, // "bag" | "bundle"
                  mode: c.mode,           // "kg" | "unit"
                  qtyKg: c.qtyKg,         // may be undefined
                  units: c.units,         // may be undefined
                  liters: Number(c.liters || 0),
                  estWeightKgPiece: Number(c.estWeightKgPiece || 0),
                })),
              })),
              summary: plan?.summary
                ? {
                    totalBoxes: Number(plan.summary.totalBoxes || boxes.length),
                    byItem: (plan.summary.byItem || []).map((bi) => ({
                      itemId: toOid(String(bi.itemId)),
                      itemName: bi.itemName,
                      bags: Number(bi.bags || 0),
                      bundles: Number(bi.bundles || 0),
                      totalKg: typeof bi.totalKg === "number" ? bi.totalKg : undefined,
                      totalUnits: typeof bi.totalUnits === "number" ? bi.totalUnits : undefined,
                    })),
                    warnings: plan.summary.warnings || [],
                  }
                : undefined,
            },

            // rollups
            totalEstKg,
            totalLiters,
            totalEstUnits,

            status: "open",
            priority,
            assignedPickerUserId: null,
            progress: {
              currentBoxIndex: 0,
              currentStepIndex: 0,
              placedKg: 0,
              placedUnits: 0,
              startedAt: null,
              finishedAt: null,
            },
            createdByUserId: toOid(createdByUserId),

            // timestamps handled by schema
            historyAuditTrail: [],
            notes: "",
          },
        },
        upsert: true,
      },
    });
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

  // 6) Execute bulk upserts
  const bulk = await PickerTaskModel.bulkWrite(ops, { ordered: false });
  const upserts = bulk?.upsertedCount ?? 0;
  const matched = bulk?.matchedCount ?? 0;

  // 7) Optionally flip open -> ready (timestamps auto)
  if (autoSetReady) {
    await PickerTaskModel.updateMany(
      {
        logisticCenterId: toOid(logisticCenterId),
        shiftName: sName,
        shiftDate: sDate,
        status: "open",
      },
      { $set: { status: "ready" } }
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

/* =========================
 * Listing helpers
 * ========================= */
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

/* =========================
 * Public list APIs
 * ========================= */
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
  const { items, total, countsByStatus, countsByAssignment } = await aggregateList(q, p, l, skip);

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

// src/services/pickerTask.service.ts (add below existing exports)
export type ShiftPickerTaskSummary = {
  shift: {
    logisticCenterId: string;
    shiftName: ShiftName;
    shiftDate: string; // yyyy-LL-dd
  };
  totalTasks: number;
  counts: {
    open: number;
    ready: number;
    in_progress: number;
    problem: number;
  };
  // Optional: what the ensure step did (created, existed, etc.)
  ensure: {
    createdCount: number;
    alreadyExisted: number;
  };
};

/**
 * Ensure picker tasks exist for a given shift, then count statuses.
 * - One task per order (your current design).
 * - Auto-flips "open" -> "ready" if you keep `autoSetReady: true` in generator.
 */
export async function getShiftPickerTasksSummary(params: {
  logisticCenterId: string | Types.ObjectId;
  createdByUserId: string | Types.ObjectId; // needed for generation
  shiftName: ShiftName;
  shiftDate: string; // yyyy-LL-dd
}): Promise<ShiftPickerTaskSummary> {
  const { logisticCenterId, createdByUserId, shiftName, shiftDate } = params;

  // 1) Ensure tasks exist for the shift (handles new orders added later)
  const ensure = await generatePickerTasksForShift({
    logisticCenterId,
    createdByUserId,
    shiftName,
    shiftDate,
    autoSetReady: true,
  });

  // 2) Aggregate counts by status for that shift
  const q = {
    logisticCenterId: toOid(logisticCenterId),
    shiftName,
    shiftDate,
  };

  // Single pipeline to get both total and counts map
  const [row] = await PickerTaskModel.aggregate([
    { $match: q },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    {
      $group: {
        _id: null,
        total: { $sum: "$count" },
        countsArray: { $push: { k: "$_id", v: "$count" } },
      },
    },
    {
      $project: {
        _id: 0,
        total: 1,
        counts: { $arrayToObject: "$countsArray" },
      },
    },
  ]);

  // Normalize to ensure the four keys always exist
  const counts = row?.counts || {};
  const normalized = {
    open: Number(counts.open || 0),
    ready: Number(counts.ready || 0),
    in_progress: Number(counts.in_progress || 0),
    problem: Number(counts.problem || 0),
  };

  return {
    shift: {
      logisticCenterId: String(logisticCenterId),
      shiftName,
      shiftDate,
    },
    totalTasks: Number(row?.total || 0),
    counts: normalized,
    ensure: {
      createdCount: ensure.createdCount,
      alreadyExisted: ensure.alreadyExisted,
    },
  };
}

/**
 * Atomically claim the first READY picker task for the current shift.
 * Sort order: priority DESC, createdAt ASC, _id ASC (FIFO among same priority).
 */
export async function claimFirstReadyTaskForCurrentShift(params: {
  logisticCenterId: string | Types.ObjectId;
  pickerUserId: string | Types.ObjectId;
}) {
  const { logisticCenterId, pickerUserId } = params;

  // Resolve current shift (name + date) using your existing utilities
  const { shiftName, shiftDate } = await (async () => {
    const name = (await getCurrentShift()) as ShiftName;
    const cfg = await getShiftConfigByKey({
      logisticCenterId: String(logisticCenterId),
      name,
    });
    const tz = cfg?.timezone || "Asia/Jerusalem";
    const date = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");
    return { shiftName: name, shiftDate: date };
  })();

  // Optional: enrich audit "by" with a contact snapshot for picker
  let byContact: any = undefined;
  try {
    byContact = await getContactInfoByIdService(String(pickerUserId)); // { id, name, role, ... }
  } catch (_) {
    // ignore if contact service not available
  }

  // Build atomic filter (prevents double-claim under concurrency)
  const filter = {
    logisticCenterId: toOid(logisticCenterId),
    shiftName,
    shiftDate,
    status: "ready",
    assignedPickerUserId: null,
  };

  const now = new Date();

  const update = {
    $set: {
      status: "claimed",
      assignedPickerUserId: toOid(pickerUserId),
      "progress.startedAt": now,
    },
    $setOnInsert: {}, // nothing, but keeps intent clear
    $push: {
      historyAuditTrail: {
        action: "claimed",
        note: "Task claimed by picker",
        by: byContact
          ? { id: toOid(byContact.id || pickerUserId), name: byContact.name, role: byContact.role || "picker" }
          : { id: toOid(pickerUserId), role: "picker" },
        at: now,
        meta: { shiftName, shiftDate },
      },
    },
  };

  // Sort: highest priority first, then oldest created
  const sort = { priority: -1, createdAt: 1, _id: 1 as const };

  // Atomic claim
  const task = await PickerTaskModel.findOneAndUpdate(filter, update, {
    sort,
    new: true, // return the document AFTER update
  }).lean();

  return {
    shift: { logisticCenterId: String(logisticCenterId), shiftName, shiftDate },
    claimed: !!task,
    task, // null if none found
  };
}