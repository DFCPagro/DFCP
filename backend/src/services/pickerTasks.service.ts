import mongoose, { Types, type PipelineStage } from "mongoose";
import { DateTime } from "luxon";

import PickerTaskModel, { type PickerTaskLean } from "../models/PickerTasks.model";
import ItemModel from "../models/Item.model";
import PackageSizeModel from "../models/PackageSize";
import ItemPackingModel from "../models/ItemPacking";

import { getContactInfoByIdService } from "./user.service";
import { getShiftConfigByKey, getCurrentShift } from "./shiftConfig.service";
import { listOrdersForShift } from "./order.service";

import {
  computePackingForOrderDoc,
  type ItemLite,
  type PackageSizeLite,
  type ItemPackingById,
  type ItemPackingOverride,
} from "./packing.service";

/* =========================================================================================
 * Types & small helpers
 * =======================================================================================*/

type ShiftName = "morning" | "afternoon" | "evening" | "night";
const STATUS_ORDER = ["ready", "claimed", "in_progress", "open", "problem", "cancelled", "done"] as const;

const BLOCKING_STATUSES = ["claimed", "in_progress"] as const; // change if policy differs
type BlockingStatus = (typeof BLOCKING_STATUSES)[number];

function toOid(v: string | Types.ObjectId): Types.ObjectId {
  return v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));
}

/** Small audit helper to keep your trail consistent */
function buildAuditEntry(args: {
  action: string;
  note?: string;
  by?: { id: Types.ObjectId; name?: string; role?: string };
  meta?: Record<string, any>;
  at?: Date;
}) {
  const { action, note, by, meta, at } = args;
  return {
    action,
    note: note ?? "",
    by,
    at: at ?? new Date(),
    meta: meta ?? {},
  };
}

/** Resolve (name, date, tz) for a shift, defaulting to current LC timezone and today */
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

/* =========================================================================================
 * Packing overrides loader
 * =======================================================================================*/

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

/* =========================================================================================
 * Rollups (KEEP packing output as-is; we compute totals here)
 * =======================================================================================*/

/**
 * Compute rollups from your PackingPlan:
 * - totalEstKg  : sum of box.estWeightKg
 * - totalLiters : sum of box.estFillLiters
 * - totalEstUnits : sum of contents.units for unit-mode pieces
 * - totalBoxes  : boxes.length (used to fill summary if missing)
 */
function rollupFromPlan(plan?: {
  boxes?: Array<{
    estWeightKg?: number;
    estFillLiters?: number;
    contents?: Array<{ mode: "kg" | "unit"; units?: number }>;
  }>;
}) {
  const boxes = plan?.boxes ?? [];
  let totalEstKg = 0;
  let totalLiters = 0;
  let totalEstUnits = 0;

  for (const b of boxes) {
    if (typeof b.estWeightKg === "number") totalEstKg += b.estWeightKg;
    if (typeof b.estFillLiters === "number") totalLiters += b.estFillLiters;

    for (const p of b.contents ?? []) {
      if (p.mode === "unit") totalEstUnits += Number(p.units || 0);
    }
  }

  return {
    totalBoxes: boxes.length,
    totalEstKg: +Number(totalEstKg).toFixed(3),
    totalLiters: +Number(totalLiters).toFixed(3),
    totalEstUnits,
  };
}

/* =========================================================================================
 * Generate tasks (ONE task per order)
 * =======================================================================================*/


export async function generatePickerTasksForShift(params: {
  logisticCenterId: string | Types.ObjectId;
  createdByUserId: string | Types.ObjectId;
  shiftName?: "morning" | "afternoon" | "evening" | "night" | null;
  shiftDate?: string | null; // yyyy-LL-dd
  priority?: number;
  stageKey?: string; // kept for BC if you pass it around
  autoSetReady?: boolean; // default false (OPEN by default)
}) {
  const {
    logisticCenterId,
    createdByUserId,
    shiftName,
    shiftDate,
    priority = 0,
    autoSetReady = false, // 👈 default = false → tasks remain "open"
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
      examples: [] as PickerTaskLean[],
    };
  }

  // 2) Orders that already have a task for this LC+shift+date
  const existing = await PickerTaskModel.aggregate([
    { $match: { logisticCenterId: toOid(logisticCenterId), shiftName: sName, shiftDate: sDate } },
    { $group: { _id: "$orderId", n: { $sum: 1 } } },
  ]);
  const orderIdsWithTasks = new Set<string>((existing as any[]).map((x) => String(x._id)));

  // 3) Only create for orders without tasks
  const toCreate = (orders as any[]).filter((o) => !orderIdsWithTasks.has(String(o._id)));
  if (!toCreate.length) {
    const examples = await PickerTaskModel.find({
      logisticCenterId: toOid(logisticCenterId),
      shiftName: sName,
      shiftDate: sDate,
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean<PickerTaskLean[]>()
      .exec();

    return {
      createdCount: 0,
      alreadyExisted: (existing as any[]).length,
      shiftName: sName,
      shiftDate: sDate,
      tz,
      ordersProcessed: orders.length,
      examples,
    };
  }

  // 4) Preload items + package sizes + packing overrides
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
    .select("key innerDimsCm headroomPct usableLiters maxWeightKg vented maxSkusPerBox mixingAllowed")
    .lean()) as unknown as PackageSizeLite[];

  const overridesById = await loadPackingOverrides(allItemIds);

  // 5) Build upserts (ONE per order)
  const ops: any[] = [];

  for (const order of toCreate) {
    // Compute packing plan
    const plan = computePackingForOrderDoc(order as any, itemsById, packageSizes, overridesById);

    // Compute rollups and mirror totals into summary
    const { totalBoxes, totalEstKg, totalLiters, totalEstUnits } = rollupFromPlan(plan);

    // Normalize plan for persistence
    const normalizedPlan = {
      boxes: (plan?.boxes ?? []).map((b) => ({
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
          mode: c.mode, // "kg" | "unit"
          qtyKg: typeof c.qtyKg === "number" ? c.qtyKg : undefined,
          units: typeof c.units === "number" ? c.units : undefined,
          liters: Number(c.liters || 0),
          estWeightKgPiece: Number(c.estWeightKgPiece || 0),
        })),
      })),
      summary: plan?.summary
        ? {
            totalBoxes: Number(plan.summary.totalBoxes || totalBoxes),
            byItem: (plan.summary.byItem || []).map((bi) => ({
              itemId: toOid(String(bi.itemId)),
              itemName: bi.itemName,
              bags: Number(bi.bags || 0),
              bundles: Number(bi.bundles || 0),
              totalKg: typeof bi.totalKg === "number" ? bi.totalKg : undefined,
              totalUnits: typeof bi.totalUnits === "number" ? bi.totalUnits : undefined,
            })),
            warnings: plan.summary.warnings || [],
            totalKg: totalEstKg,
            totalLiters: totalLiters,
          }
        : {
            totalBoxes,
            byItem: [],
            warnings: [],
            totalKg: totalEstKg,
            totalLiters: totalLiters,
          },
    };

    ops.push({
      updateOne: {
        filter: {
          logisticCenterId: toOid(logisticCenterId),
          shiftName: sName,
          shiftDate: sDate,
          orderId: toOid(order._id),
        },
        update: {
          // always refresh these
          $set: {
            plan: normalizedPlan,
            totalEstKg,
            totalLiters,
            totalEstUnits,
            ...(autoSetReady ? { status: "ready" } : {}), // 👈 only set to "ready" if explicitly requested
          },
          // insert-only fields
          $setOnInsert: {
            logisticCenterId: toOid(logisticCenterId),
            shiftName: sName,
            shiftDate: sDate,
            orderId: toOid(order._id),
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
            historyAuditTrail: [],
            notes: "",
            // status omitted here → schema default "open"
          },
        },
        upsert: true,
      },
    });
  }

  // 6) Execute bulk upserts
  const bulk = ops.length ? await PickerTaskModel.bulkWrite(ops, { ordered: false }) : null;
  const upserts = bulk?.upsertedCount ?? 0;
  const matched = bulk?.matchedCount ?? 0;

  // 7) OPTIONAL: if you want to flip existing "open" to "ready" only on request
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
    .lean<PickerTaskLean[]>()
    .exec();

  return {
    createdCount: upserts,
    alreadyExisted: matched + (existing as any[]).length,
    shiftName: sName,
    shiftDate: sDate,
    tz,
    ordersProcessed: orders.length,
    examples,
  };
}

/* =========================================================================================
 * List (with pagination + counts)
 * =======================================================================================*/

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
  items: PickerTaskLean[];
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

  const sortStage: PipelineStage.Sort = { $sort: { __status_ord: 1, priority: -1, createdAt: 1, _id: 1 } };
  const pageStages: PipelineStage[] = [{ $skip: skip }, { $limit: l }];

  const [items, total, byStatus, byAssignment] = await Promise.all([
    PickerTaskModel.aggregate<PickerTaskLean>([baseMatch, addStatusOrder, sortStage, ...pageStages]),
    PickerTaskModel.countDocuments(q),
    PickerTaskModel.aggregate<{ _id: string; count: number }>([baseMatch, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    PickerTaskModel.aggregate<{ _id: boolean; count: number }>([
      baseMatch,
      { $group: { _id: { $ne: ["$assignedPickerUserId", null] }, count: { $sum: 1 } } },
    ]),
  ]);

  const countsByStatus = Object.fromEntries((byStatus as any[]).map((x: any) => [x._id, x.count]));
  const countsByAssignment = {
    assigned: (byAssignment as any[]).find((x: any) => x._id === true)?.count ?? 0,
    unassigned: (byAssignment as any[]).find((x: any) => x._id === false)?.count ?? 0,
  };

  return { items: items as unknown as PickerTaskLean[], total, countsByStatus, countsByAssignment };
}

/* =========================================================================================
 * Public list APIs
 * =======================================================================================*/

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

/** Ensure (generate missing) then list — does NOT auto-ready */
export async function ensureAndListPickerTasksForShift(params: {
  logisticCenterId: string | Types.ObjectId;
  createdByUserId: string | Types.ObjectId;
  shiftName: ShiftName;
  shiftDate: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const { logisticCenterId, createdByUserId, shiftName, shiftDate, status, page, limit } = params;

  const ensure = await generatePickerTasksForShift({
    logisticCenterId,
    createdByUserId,
    shiftName,
    shiftDate,
    autoSetReady: false, // ⬅️ keep new tasks OPEN unless POST /generate explicitly sends true
  });

  const data = await listPickerTasksForShift({
    logisticCenterId,
    shiftName,
    shiftDate,
    status,
    page,
    limit,
  });

  return { ensure, data };
}


/* =========================================================================================
 * Summary + Claim
 * =======================================================================================*/

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
  ensure: {
    createdCount: number;
    alreadyExisted: number;
  };
};

/** Ensure picker tasks exist for a given shift, then return status counts. */
export async function getShiftPickerTasksSummary(params: {
  logisticCenterId: string | Types.ObjectId;
  createdByUserId: string | Types.ObjectId;
  shiftName: ShiftName;
  shiftDate: string; // yyyy-LL-dd
}): Promise<ShiftPickerTaskSummary> {
  const { logisticCenterId, createdByUserId, shiftName, shiftDate } = params;

  const ensure = await generatePickerTasksForShift({
    logisticCenterId,
    createdByUserId,
    shiftName,
    shiftDate,
    autoSetReady: true,
  });

  const q = { logisticCenterId: toOid(logisticCenterId), shiftName, shiftDate };

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
    { $project: { _id: 0, total: 1, counts: { $arrayToObject: "$countsArray" } } },
  ]);

  const counts = (row as any)?.counts || {};
  const normalized = {
    open: Number(counts.open || 0),
    ready: Number(counts.ready || 0),
    in_progress: Number(counts.in_progress || 0),
    problem: Number(counts.problem || 0),
  };

  return {
    shift: { logisticCenterId: String(logisticCenterId), shiftName, shiftDate },
    totalTasks: Number((row as any)?.total || 0),
    counts: normalized,
    ensure: { createdCount: ensure.createdCount, alreadyExisted: ensure.alreadyExisted },
  };
}

/**
 * Claim the first READY, unassigned picker task for the current shift.
 * If the picker already has a blocking task this shift, returns that instead and DOES NOT claim a new one.
 * Shape matches your list operation (task is full doc, lean).
 */
export async function claimFirstReadyTaskForCurrentShift(params: {
  logisticCenterId: string | Types.ObjectId;
  pickerUserId: string | Types.ObjectId;
  /** Optional: override which statuses block new claims */
  blockingStatuses?: BlockingStatus[]; // default BLOCKING_STATUSES
}) {
  const { logisticCenterId, pickerUserId, blockingStatuses = [...BLOCKING_STATUSES] } = params;

  // 1) Resolve current shift
  const { shiftName, shiftDate } = await resolveCurrentShiftParams(logisticCenterId, null, null);

  // 2) Guard: if picker already has a blocking task this shift, return it (no new claim)
  const already = await findActiveTaskForPickerInShift({
    logisticCenterId,
    pickerUserId,
    shiftName,
    shiftDate,
    blockingStatuses,
  });

  if (already.task) {
    return {
      shift: { logisticCenterId: String(logisticCenterId), shiftName, shiftDate },
      claimed: false,
      alreadyAssigned: true as const,
      taskId: String(already.task._id),
      task: already.task,
    };
  }

  // 3) Prepare audit "by" contact (best-effort)
  let byContact: any;
  try {
    byContact = await getContactInfoByIdService(String(pickerUserId));
  } catch {
    /* noop */
  }

  // 4) Atomically claim the first READY, unassigned task
  const now = new Date();

  const filter = {
    logisticCenterId: toOid(logisticCenterId),
    shiftName,
    shiftDate,
    status: "ready",
    $or: [{ assignedPickerUserId: null }, { assignedPickerUserId: { $exists: false } }],
  };

  const update = {
    $set: {
      status: "claimed",
      assignedPickerUserId: toOid(pickerUserId),
      "progress.startedAt": now,
    },
    $push: {
      historyAuditTrail: buildAuditEntry({
        action: "claimed",
        note: "Task claimed by picker",
        by: byContact
          ? {
              id: toOid(byContact.id || pickerUserId),
              name: byContact.name,
              role: byContact.role || "picker",
            }
          : { id: toOid(pickerUserId), role: "picker" },
        meta: { shiftName, shiftDate },
        at: now,
      }),
    },
  };

  const sort = { priority: -1, createdAt: 1, _id: 1 as const };

  const task = await PickerTaskModel.findOneAndUpdate(filter, update, {
    sort,
    new: true,
    lean: true,
  })
    .lean<PickerTaskLean>()
    .exec();

  return {
    shift: { logisticCenterId: String(logisticCenterId), shiftName, shiftDate },
    claimed: !!task,
    alreadyAssigned: false as const,
    taskId: task ? String(task._id) : null,
    task,
  };
}

/** Return the picker's currently-blocking task in this LC + shift (or null). */
export async function findActiveTaskForPickerInShift(params: {
  logisticCenterId: string | Types.ObjectId;
  pickerUserId: string | Types.ObjectId;
  shiftName?: ShiftName | null;
  shiftDate?: string | null; // yyyy-LL-dd
  blockingStatuses?: BlockingStatus[]; // default BLOCKING_STATUSES
}) {
  const {
    logisticCenterId,
    pickerUserId,
    shiftName,
    shiftDate,
    blockingStatuses = [...BLOCKING_STATUSES],
  } = params;

  const { shiftName: sName, shiftDate: sDate } = await resolveCurrentShiftParams(
    logisticCenterId,
    shiftName ?? null,
    shiftDate ?? null
  );

  const task = await PickerTaskModel.findOne({
    logisticCenterId: toOid(logisticCenterId),
    shiftName: sName,
    shiftDate: sDate,
    assignedPickerUserId: toOid(pickerUserId),
    status: { $in: blockingStatuses as unknown as string[] },
  })
    .sort({ __status_ord: 1, priority: -1, createdAt: 1, _id: 1 })
    .lean<PickerTaskLean>()
    .exec();

  return {
    shift: { logisticCenterId: String(logisticCenterId), shiftName: sName, shiftDate: sDate },
    task, // may be null
  };
}
