import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";

import { FarmerOrder } from "../models/farmerOrder.model";
import { Item } from "../models/Item.model";
import { Farmer } from "../models/farmer.model";
import ShiftConfig from "../models/shiftConfig.model";
import QRModel from "../models/QRModel.model";

import { DateTime } from "luxon";
import { getCurrentShift, getNextAvailableShifts } from "./shiftConfig.service";

import {
  addItemToAvailableMarketStock,
  findOrCreateAvailableMarketStock,
} from "../services/availableMarketStock.service";

import { ensureFarmerOrderToken, signPayload } from "./ops.service";
import ApiError from "../utils/ApiError";
import { canonicalizeClaims } from "../utils/canonicalizeClaims";

import {
  FARMER_ORDER_STAGE_KEYS,
  FARMER_ORDER_STAGE_LABELS,
  FarmerOrderStageKey,
} from "../models/shared/stage.types";

/* =============================
 * Constants / helpers
 * ============================= */
const SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
type Shift = (typeof SHIFTS)[number];

// legacy status field on FarmerOrder (we'll keep writing it for now)
const FARMER_APPROVAL_STATUSES = ["pending", "ok", "problem"] as const;
type FarmerApprovalStatus = (typeof FARMER_APPROVAL_STATUSES)[number];

const STATIC_LC_ID = "66e007000000000000000001"; // dev default LC

const isObjectId = (v: unknown) =>
  typeof v === "string" && mongoose.isValidObjectId(v);
const toOID = (v: string | Types.ObjectId) =>
  v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));
const isYMD = (s: unknown) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const nonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;

type UserCtx = { userId: Types.ObjectId; role: string };

export interface AuthUser {
  id: string; // User._id string
  role: "farmer" | "fManager" | "admin" | string;
}

/* -------------------------------- stage utils -------------------------------- */

/**
 * FarmerOrder uses stageKey + stages[] just like Order.
 * We consider the FO "problem" if the current stage's status === "problem".
 */
function isFarmerOrderProblem(fo: {
  stageKey?: string;
  stages?: Array<{ key?: string; status?: string }>;
}): boolean {
  if (!fo || !fo.stageKey || !Array.isArray(fo.stages)) return false;
  const cur = fo.stages.find((s) => s && s.key === fo.stageKey);
  return cur?.status === "problem";
}

/**
 * Ensure stages[] has an entry for this key.
 * Return a mutable reference.
 */
function ensureFOStageEntry(doc: any, key: FarmerOrderStageKey) {
  if (!Array.isArray(doc.stages)) doc.stages = [];
  let st = doc.stages.find((s: any) => s?.key === key);
  if (!st) {
    st = {
      key,
      label: FARMER_ORDER_STAGE_LABELS[key] || key,
      status: "pending",
      expectedAt: null,
      startedAt: null,
      completedAt: null,
      timestamp: new Date(),
      note: "",
    };
    doc.stages.push(st);
  }
  return st;
}

/**
 * Initialize a brand-new FarmerOrder pipeline:
 *  - stageKey = "farmerAck"
 *  - that stage entry gets status="current"
 *  - audit "FARMER_ORDER_CREATED"
 *
 * We also keep farmerStatus="pending" for backward compatibility,
 * but dashboard "problem" should come from stages logic going forward.
 */
function initFarmerOrderStagesAndAudit(doc: any, createdBy: Types.ObjectId) {
  const now = new Date();
  const firstKey: FarmerOrderStageKey = "farmerAck";

  doc.stageKey = firstKey;

  const st = ensureFOStageEntry(doc, firstKey);
  st.status = "current";
  st.timestamp = now;
  if (!st.startedAt) st.startedAt = now;

  doc.farmerStatus = "pending"; // legacy status snapshot

  doc.addAudit(createdBy, "FARMER_ORDER_CREATED", "Farmer order created", {});
}

/**
 * STOP advancing stages if pipeline is halted (problem).
 * We now derive problem from stages, not farmerStatus.
 */
export function ensurePipelineOpen(order: any) {
  if (isFarmerOrderProblem(order)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Pipeline is halted due to a problem in current stage"];
    throw e;
  }
}

/* =============================
 * CREATE FarmerOrder (txn + FO QR)
 * ============================= */
export interface CreateFarmerOrderPayload {
  itemId?: string; // ObjectId string
  type?: string;
  variety?: string;
  pictureUrl?: string; // pictureUrl or pictureURL accepted
  pictureURL?: string;

  farmerId?: string;
  farmerName?: string;
  farmName?: string;

  shift?: Shift;
  pickUpDate?: string; // "YYYY-MM-DD"

  forcastedQuantityKg?: number;
  sumOrderedQuantityKg?: number;
}

export async function createFarmerOrderService(
  payload: CreateFarmerOrderPayload,
  user: AuthUser
) {
  // ACL: only fManager/admin
  if (!["fManager", "admin"].includes(user.role)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Only fManager or admin can create farmer orders"];
    throw e;
  }

  // Validate inputs
  const errors: string[] = [];
  const pictureUrlRaw = payload.pictureUrl ?? payload.pictureURL;

  if (!nonEmpty(payload.itemId)) errors.push("itemId is required.");
  if (!nonEmpty(payload.type)) errors.push("type is required.");
  if (!nonEmpty(payload.variety)) errors.push("variety is required.");
  if (!nonEmpty(pictureUrlRaw)) errors.push("pictureUrl is required.");
  if (!nonEmpty(payload.farmerId)) errors.push("farmerId is required.");
  if (!nonEmpty(payload.farmerName)) errors.push("farmerName is required.");
  if (!nonEmpty(payload.farmName)) errors.push("farmName is required.");
  if (!nonEmpty(payload.pickUpDate)) errors.push("pickUpDate is required.");
  if (!nonEmpty(payload.shift)) errors.push("shift is required.");

  if (payload.itemId && !isObjectId(payload.itemId))
    errors.push("itemId must be a valid ObjectId string.");
  if (payload.farmerId && !isObjectId(payload.farmerId))
    errors.push("farmerId must be a valid ObjectId string.");
  if (payload.pickUpDate && !isYMD(payload.pickUpDate))
    errors.push("pickUpDate must be 'YYYY-MM-DD'.");
  if (payload.shift && !SHIFTS.includes(payload.shift as Shift))
    errors.push(`shift must be one of: ${SHIFTS.join(", ")}.`);

  const fcast = Number(payload.forcastedQuantityKg);
  if (!Number.isFinite(fcast) || fcast < 0)
    errors.push("forcastedQuantityKg is required and must be a number >= 0.");

  if (errors.length) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = errors;
    throw e;
  }

  // Transaction
  const session = await mongoose.startSession();
  try {
    let json: any;

    await session.withTransaction(async () => {
      const createdBy = toOID(user.id);

      const doc = new FarmerOrder({
        createdBy,
        updatedBy: createdBy,

        itemId: toOID(payload.itemId!),
        type: String(payload.type),
        variety: String(payload.variety),
        pictureUrl: String(pictureUrlRaw),

        farmerId: toOID(String(payload.farmerId)),
        farmerName: String(payload.farmerName),
        farmName: String(payload.farmName),

        shift: payload.shift,
        pickUpDate: payload.pickUpDate,
        logisticCenterId: toOID(STATIC_LC_ID),

        // we'll keep farmerStatus for now, but real status is stages[]
        farmerStatus: "pending",

        sumOrderedQuantityKg:
          Number.isFinite(Number(payload.sumOrderedQuantityKg)) &&
          Number(payload.sumOrderedQuantityKg) >= 0
            ? Number(payload.sumOrderedQuantityKg)
            : 0,

        forcastedQuantityKg: fcast,

        orders: [],
        containers: [],
        stages: [],
        stageKey: undefined,
        historyAuditTrail: [],
      });

      // init pipeline & audit
      initFarmerOrderStagesAndAudit(doc, createdBy);

      await doc.validate();
      await doc.save({ session });

      // FO QR (same txn)
      const foQR = await ensureFarmerOrderToken({
        farmerOrderId: doc._id,
        createdBy,
        ttlSeconds: 24 * 60 * 60,
        session,
      });

      json = doc.toJSON();
      json.qr = {
        token: foQR.token,
        sig: foQR.sig,
        scope: foQR.scope, // "farmer-order"
        url: `/scan?token=${encodeURIComponent(
          foQR.token
        )}&sig=${encodeURIComponent(foQR.sig)}`,
      };
    });

    return json; // committed
  } finally {
    await session.endSession();
  }
}

/* =============================
 * PRINT payload (FO + its container QRs)
 * ============================= */
export async function ensureFarmerOrderPrintPayloadService(args: {
  farmerOrderId: string | Types.ObjectId;
  user: UserCtx;
  session?: mongoose.ClientSession | null;
}) {
  const { farmerOrderId, user, session = null } = args;
  const foId = new Types.ObjectId(String(farmerOrderId));

  const fo = await FarmerOrder.findById(foId).session(session).lean();
  if (!fo) throw new ApiError(404, "FarmerOrder not found");

  const isAdmin = ["admin", "fManager"].includes(user.role);
  if (!isAdmin && String(fo.farmerId) !== String(user.userId)) {
    throw new ApiError(403, "Forbidden");
  }

  // Ensure FO QR exists
  const foQR = await ensureFarmerOrderToken({
    farmerOrderId: foId,
    createdBy: user.userId,
    ttlSeconds: 24 * 60 * 60,
    usagePolicy: "multi-use",
    session,
  });

  // Container QRs linked to this FO
  const containerQrs = await QRModel.find({
    scope: "container",
    subjectType: "Container",
    "claims.farmerOrderId": String(foId),
    status: { $in: ["active", "consumed"] },
  })
    .session(session)
    .lean();

  return {
    farmerOrder: fo,
    farmerOrderQR: {
      token: foQR.token,
      sig: foQR.sig,
      scope: foQR.scope,
    },
    containerQrs: (containerQrs || []).map((q: any) => ({
      token: q.token,
      sig: q.sig,
      scope: q.scope,
      subjectType: q.subjectType,
      subjectId: String(q.subjectId),
    })),
  };
}

/* =============================
 * INIT containers (+ QR each) — txn
 * ============================= */
export async function initContainersForFarmerOrderService(args: {
  farmerOrderId: string | Types.ObjectId;
  count: number; // number of containers the farmer reports
  user: UserCtx;
}) {
  if (!Number.isInteger(args.count) || args.count <= 0 || args.count > 2000) {
    throw new ApiError(400, "count must be a positive integer (<=2000)");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const foId = new Types.ObjectId(String(args.farmerOrderId));

    const fo = await FarmerOrder.findById(foId).session(session);
    if (!fo) throw new ApiError(404, "FarmerOrder not found");

    const isAdmin = ["admin", "fManager"].includes(args.user.role);
    if (!isAdmin && String(fo.farmerId) !== String(args.user.userId)) {
      throw new ApiError(403, "Forbidden");
    }

    // Base claims shared by all container tokens (per FO)
    const baseRawClaims = {
      farmerOrderId: foId,
      farmerDeliveryId: null,
      containerId: null, // will be set per container
      containerOpsId: null,
      orderId: null,
      packageId: null,
      logisticsCenterId: fo.logisticCenterId
        ? String(fo.logisticCenterId)
        : null,
      shelfId: null,
      pickTaskId: null,
      shift: fo.shift || null,
      deliveryDate: fo.pickUpDate
        ? new Date(`${fo.pickUpDate}T00:00:00Z`)
        : null,
    };

    const newContainers: any[] = [];
    const qrDocsToInsert: any[] = [];

    const nextIndexStart = (fo.containers?.length || 0) + 1;
    for (let i = 0; i < args.count; i++) {
      const seq = nextIndexStart + i;
      const containerId = `${foId.toString()}_${seq}`;

      // push subdoc
      (fo.containers as any).push({
        containerId,
        farmerOrder: foId,
        itemId: fo.itemId,
        weightKg: 0,
        stages: [],
        warehouseSlot: {
          shelfLocation: "",
          zone: "",
          location: "unknown",
          timestamp: new Date(),
        },
      });
      newContainers.push({ containerId });

      // mint QR per container
      const claims = canonicalizeClaims({ ...baseRawClaims, containerId });
      const token = `QR-${crypto.randomUUID()}`;
      const sig = signPayload({
        token,
        scope: "container",
        subjectType: "Container",
        subjectId: containerId,
        claims,
      });

      qrDocsToInsert.push({
        token,
        sig,
        scope: "container",
        subjectType: "Container",
        subjectId: containerId,
        claims,
        status: "active",
        usagePolicy: "multi-use",
        maxScansPerHour: 240,
        createdBy: args.user.userId,
        issuer: args.user.userId,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        scans: [],
      });
    }

    fo.updatedBy = args.user.userId;
    fo.addAudit(
      args.user.userId,
      "CONTAINERS_INIT",
      `+${newContainers.length} containers`,
      {}
    );
    await fo.save({ session });

    if (qrDocsToInsert.length > 0) {
      await QRModel.insertMany(qrDocsToInsert, { session });
    }

    await session.commitTransaction();
    return {
      ok: true,
      added: newContainers.length,
      containerIds: newContainers.map((c) => c.containerId),
    };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

/* =============================
 * PATCH weights (bulk) — txn
 * ============================= */
export async function patchContainerWeightsService(args: {
  farmerOrderId: string | Types.ObjectId;
  weights: Array<{ containerId: string; weightKg: number }>;
  user: UserCtx;
}) {
  if (!Array.isArray(args.weights) || args.weights.length === 0) {
    throw new ApiError(400, "weights must be a non-empty array");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const foId = new Types.ObjectId(String(args.farmerOrderId));
    const fo = await FarmerOrder.findById(foId).session(session);
    if (!fo) throw new ApiError(404, "FarmerOrder not found");

    const isAdmin = ["admin", "fManager"].includes(args.user.role);
    if (!isAdmin && String(fo.farmerId) !== String(args.user.userId)) {
      throw new ApiError(403, "Forbidden");
    }

    const map = new Map<string, number>();
    for (const w of args.weights) {
      const n = Number(w.weightKg);
      if (!w.containerId || !Number.isFinite(n) || n < 0 || n > 2000) {
        throw new ApiError(
          400,
          `Bad weight entry for containerId=${w.containerId}`
        );
      }
      map.set(String(w.containerId), n);
    }

    let updated = 0;
    for (const c of fo.containers as any[]) {
      const newW = map.get(String(c.containerId));
      if (newW != null) {
        c.weightKg = newW;
        updated++;
      }
    }

    fo.updatedBy = args.user.userId;
    fo.addAudit(
      args.user.userId,
      "CONTAINERS_WEIGHTS_SET",
      `updated ${updated} containers`,
      {}
    );
    await fo.save({ session });

    await session.commitTransaction();
    return { ok: true, updated };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

/* =============================
 * Update farmerStatus (legacy) + stage transitions + AMS linking
 * ============================= */
interface UpdateFarmerStatusArgs {
  orderId: string;
  status: FarmerApprovalStatus;
  note?: string;
  user: AuthUser;
}

export async function updateFarmerStatusService(args: UpdateFarmerStatusArgs) {
  const { orderId, status, note, user } = args;

  if (!mongoose.isValidObjectId(orderId)) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = ["Invalid farmer order id"];
    throw e;
  }

  const order = await FarmerOrder.findById(orderId);
  if (!order) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["Farmer order not found"];
    throw e;
  }

  // Authorization
  const isOwnerFarmer =
    user.role === "farmer" && String(order.farmerId) === String(user.id);
  const isManagerOrAdmin = user.role === "fManager" || user.role === "admin";
  if (!isOwnerFarmer && !isManagerOrAdmin) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Not allowed to update this farmer order status"];
    throw e;
  }

  order.updatedBy = toOID(user.id);
  order.updatedAt = new Date();

  // keep legacy snapshot for backwards compatibility
  order.farmerStatus = status;

  if (status === "ok") {
    // farmer approved => pipeline moves forward + AMS upsert
    order.markStageOk("farmerAck", order.updatedBy as any, {
      note: note ?? "",
    });

    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", {
      newStatus: "ok",
      byRole: user.role,
    });

    const itemDoc: any = await Item.findById(order.itemId).lean();
    if (!itemDoc) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Referenced item not found"];
      throw e;
    }

    const pricePerUnit = Number(
      itemDoc?.price?.a ?? (itemDoc as any)?.priceA ?? itemDoc?.price?.kg ?? NaN
    );
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Item.price.a (per KG) is required and must be >= 0"];
      throw e;
    }

    let farmLogo: string | undefined;
    try {
      const farmerDoc = await Farmer.findById(order.farmerId, {
        farmLogo: 1,
      }).lean();
      farmLogo = farmerDoc?.farmLogo ?? (order as any)?.farmLogo ?? undefined;
    } catch {
      farmLogo = (order as any)?.farmLogo ?? undefined;
    }

    const amsDoc = await findOrCreateAvailableMarketStock({
      LCid: String(order.logisticCenterId),
      date: order.pickUpDate,
      shift: order.shift as Shift,
      createdById: order.updatedBy,
    });

    const committedKg = Math.max(
      0,
      Number(
        (order as any).forcastedQuantityKg ??
          (order as any).forecastedQuantityKg ??
          (order as any).sumOrderedQuantityKg ??
          0
      )
    );

    const displayName =
      (itemDoc?.variety
        ? `${itemDoc?.type ?? ""} ${itemDoc.variety}`.trim()
        : itemDoc?.type) ||
      (order.variety
        ? `${order.type ?? ""} ${order.variety}`.trim()
        : order.type) ||
      "Unknown Item";

    const category = (itemDoc as any)?.category ?? "unknown";
    const imageUrl = itemDoc?.imageUrl ?? (order as any).pictureUrl ?? null;

    await addItemToAvailableMarketStock({
      docId: String(amsDoc._id),
      item: {
        itemId: String(order.itemId),
        displayName,
        imageUrl,
        category,
        pricePerUnit,
        originalCommittedQuantityKg: committedKg,
        currentAvailableQuantityKg: committedKg,
        farmerOrderId: String(order._id),
        farmerID: String(order.farmerId),
        farmerName: order.farmerName,
        farmName: order.farmName,
        farmLogo,
        status: "active",
      },
    });

    order.addAudit(order.updatedBy as any, "AVAILABLE_STOCK_UPSERT", "", {
      LCid: order.logisticCenterId,
      date: order.pickUpDate,
      shift: order.shift,
      itemId: order.itemId,
      farmerId: order.farmerId,
      qtyForecast:
        (order as any).forcastedQuantityKg ??
        (order as any).forecastedQuantityKg ??
        (order as any).sumOrderedQuantityKg ??
        0,
    });

    // advance pipeline stages
    order.markStageDone("farmerAck", order.updatedBy as any, {
      note: "Farmer approved; moved to QS",
    });
    order.setStageCurrent("farmerQSrep", order.updatedBy as any, {
      note: "Quality check in progress",
    });

    // make sure stageKey now reflects farmerQSrep
    order.stageKey = "farmerQSrep";
  } else if (status === "problem") {
    // put pipeline into halted/problem state
    // demote any 'current' to pending
    for (const s of (order.stages as any[]) ?? []) {
      if (s?.status === "current") {
        s.status = "pending";
        s.timestamp = new Date();
      }
    }

    // mark farmerAck as done w/ halt note
    order.markStageDone("farmerAck", order.updatedBy as any, {
      note: note ?? "HALT: farmer reported problem",
    });

    // ensure farmerAck stage is now marked as "problem" and is current stageKey
    const st = ensureFOStageEntry(order, "farmerAck");
    st.status = "problem";
    st.timestamp = new Date();
    if (!st.startedAt) st.startedAt = new Date();
    if (note) st.note = note;
    order.stageKey = "farmerAck";

    order.addAudit(
      order.updatedBy as any,
      "PIPELINE_HALT",
      note ?? "Farmer reported problem",
      { byRole: user.role }
    );
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", {
      newStatus: "problem",
      byRole: user.role,
    });
  } else {
    // fallback -> pending
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", {
      newStatus: "pending",
      byRole: user.role,
    });
  }

  await order.save();
  return order.toJSON();
}

/* =============================
 * Stage updates (admin/fManager)
 * ============================= */
/* =============================
 * Stage updates (admin/fManager)
 * ============================= */

type StageAction = "setCurrent" | "ok" | "done" | "problem";

interface UpdateStageArgs {
  farmerOrderId: string;
  key: string; // should be FarmerOrderStageKey, but we'll accept string input
  action: StageAction;
  note?: string;
  user: AuthUser;
}

/**
 * Make sure the FarmerOrder has a stage entry for `stageKey`.
 * If missing, we create a minimal one so we can safely mark it "problem".
 * Returns the stage subdoc reference.
 */

export async function updateStageStatusService(args: UpdateStageArgs) {
  const { farmerOrderId, key, action, note, user } = args;

  // --- basic validation / ACL ---
  if (!mongoose.isValidObjectId(farmerOrderId)) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = ["Invalid farmer order id"];
    throw e;
  }

  if (!["fManager", "admin"].includes(user.role)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Only fManager or admin can update stages"];
    throw e;
  }

  // --- load order ---
  const order = await FarmerOrder.findById(farmerOrderId);
  if (!order) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["Farmer order not found"];
    throw e;
  }

  // if the farmer has flagged "problem", pipeline is halted.
  // we allow explicitly setting "problem" (to escalate/label the stage)
  // but we block forward progress ("setCurrent", "ok", "done").
  if (action !== "problem") {
    ensurePipelineOpen(order);
  }

  order.updatedBy = toOID(user.id);
  order.updatedAt = new Date();

  // Stage reference if it already exists
  const existingStage: any = (order.stages as any[])?.find(
    (s: any) => s?.key === key
  );

  // If we're not setting a stage current, and it's not "problem",
  // and there's no such stage... that's invalid.
  if (!existingStage && action !== "setCurrent" && action !== "problem") {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = [`Stage not found: ${key}`];
    throw e;
  }

  // We'll reuse this cast a few times so TS doesn't scream.
  const keyAsStageKey = key as FarmerOrderStageKey;

  switch (action) {
    case "setCurrent": {
      // move pipeline focus to this stage
      order.setStageCurrent(keyAsStageKey, order.updatedBy as any, {
        note,
      });

      // reflect active stage at top level (dashboard shortcut)
      (order as any).stageKey = keyAsStageKey;

      // audit
      order.addAudit(order.updatedBy as any, "STAGE_SET_CURRENT", note ?? "", {
        key,
        byRole: user.role,
      });
      break;
    }

    case "ok": {
      order.markStageOk(keyAsStageKey, order.updatedBy as any, { note });

      // audit
      order.addAudit(order.updatedBy as any, "STAGE_SET_OK", note ?? "", {
        key,
        byRole: user.role,
      });
      break;
    }

    case "done": {
      order.markStageDone(keyAsStageKey, order.updatedBy as any, { note });

      // audit
      order.addAudit(order.updatedBy as any, "STAGE_MARK_DONE", note ?? "", {
        key,
        byRole: user.role,
      });
      break;
    }

    case "problem": {
      // Mark/ensure the stage and flag it as "problem"
      const st = ensureFOStageEntry(order, keyAsStageKey);
      const now = new Date();

      st.status = "problem";
      st.timestamp = now;
      if (!st.startedAt) st.startedAt = now;
      if (note) st.note = note;

      // this stage is now the main focus for ops dashboards
      (order as any).stageKey = keyAsStageKey;

      // audit
      order.addAudit(order.updatedBy as any, "STAGE_SET_PROBLEM", note ?? "", {
        key,
        byRole: user.role,
      });
      break;
    }

    default: {
      throw new ApiError(400, "Unknown stage action");
    }
  }

  await order.save();
  return order.toJSON();
}

/* =============================
 * Link customer order to FO
 * ============================= */
type IdLike2 = string | Types.ObjectId;

export async function addOrderIdToFarmerOrder(
  orderId: IdLike2,
  farmerOrderId: IdLike2,
  allocatedQuantityKg?: number | null,
  opts?: { session?: mongoose.ClientSession }
) {
  const orderOID = toOID(orderId);
  const farmerOrderOID = toOID(farmerOrderId);

  if (allocatedQuantityKg != null) {
    const n = Number(allocatedQuantityKg);
    if (!Number.isFinite(n) || n < 0) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["allocatedQuantityKg must be >= 0 when provided"];
      throw e;
    }
  }

  const query = FarmerOrder.findById(farmerOrderOID);
  if (opts?.session) query.session(opts.session);
  const fo = await query;
  if (!fo) throw new ApiError(404, "FarmerOrder not found");

  fo.linkOrder(
    orderOID,
    allocatedQuantityKg == null ? null : Number(allocatedQuantityKg)
  );
  fo.updatedAt = new Date();

  await fo.save({ session: opts?.session });
  return fo.toJSON();
}

/* =============================
 * Adjust allocation delta
 * ============================= */
export async function adjustFarmerOrderAllocatedKg(
  orderId: IdLike2,
  farmerOrderId: IdLike2,
  deltaKg: number,
  opts?: { session?: mongoose.ClientSession }
) {
  const orderOID = toOID(orderId);
  const foOID = toOID(farmerOrderId);

  if (!Number.isFinite(deltaKg)) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = ["deltaKg must be a finite number (can be negative)"];
    throw e;
  }

  const query = FarmerOrder.findById(foOID);
  if (opts?.session) query.session(opts.session);
  const fo: any = await query;
  if (!fo) throw new ApiError(404, "FarmerOrder not found");

  const coll: any[] = Array.isArray(fo.orders) ? fo.orders : [];
  let current = 0;
  const entry = coll.find((o: any) => String(o.orderId) === String(orderOID));
  if (entry && Number.isFinite(entry.allocatedQuantityKg))
    current = Number(entry.allocatedQuantityKg);

  const next = Math.max(0, Math.round((current + deltaKg) * 1000) / 1000);

  fo.linkOrder(orderOID, next);
  fo.updatedAt = new Date();

  await fo.save({ session: opts?.session });
  return fo.toJSON();
}

/* =============================
 * Shift summaries & listings
 * ============================= */
type ShiftName = "morning" | "afternoon" | "evening" | "night";

type FOSummaryParams = {
  logisticCenterId: string;
  count?: number; // next N shifts after current (default 5)
};

type FOSummaryEntry = {
  date: string; // yyyy-LL-dd
  shiftName: ShiftName;
  count: number;
  problemCount: number;
  okFO: number;
  pendingFO: number;
  problemFO: number;
  okFarmers: number;
  pendingFarmers: number;
  problemFarmers: number;
};

export async function farmerOrdersSummary(params: FOSummaryParams) {
  const { logisticCenterId, count = 5 } = params;

  const anyCfg = await ShiftConfig.findOne(
    { logisticCenterId },
    { timezone: 1 }
  )
    .lean<{ timezone?: string }>()
    .exec();
  if (!anyCfg)
    throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = anyCfg.timezone || "Asia/Jerusalem";

  const currentShiftName = await getCurrentShift();
  const nextShifts = await getNextAvailableShifts({
    logisticCenterId,
    count,
  });

  // summarize helper
  const summarize = (
    docs: Array<{
      stageKey?: string;
      stages?: any[];
      farmerStatus?: string;
      farmerId?: any;
    }>
  ) => {
    const countAll = docs.length;

    // new definition of "problem": active stage.status === "problem"
    const problemDocs = docs.filter((d) => isFarmerOrderProblem(d));
    const problemCount = problemDocs.length;

    // legacy buckets (still returned so you don't break UI):
    const okDocs = docs.filter((d) => d.farmerStatus === "ok");
    const pendingDocs = docs.filter((d) => d.farmerStatus === "pending");
    const legacyProblemDocs = docs.filter((d) => d.farmerStatus === "problem");
    //stage.status if the current one is "problem" 
    const okFO = okDocs.length;
    const pendingFO = pendingDocs.length;
    const problemFO = legacyProblemDocs.length;

    const uniq = (arr: any[]) =>
      Array.from(new Set(arr.map((v) => String(v)))).length;

    return {
      count: countAll,
      problemCount, // ← NEW meaning
      okFO,
      pendingFO,
      problemFO,
      okFarmers: uniq(okDocs.map((d) => d.farmerId)),
      pendingFarmers: uniq(pendingDocs.map((d) => d.farmerId)),
      problemFarmers: uniq(legacyProblemDocs.map((d) => d.farmerId)),
    };
  };

  if (currentShiftName === "none") {
    const next = await Promise.all(
      nextShifts.map(async (s) => {
        const docs = await FarmerOrder.find(
          {
            logisticCenterId: new Types.ObjectId(logisticCenterId),
            shift: s.name,
            pickUpDate: s.date,
          },
          {
            _id: 1,
            farmerStatus: 1,
            farmerId: 1,
            stageKey: 1,
            stages: 1,
          }
        )
          .lean()
          .exec();

        const base = summarize(docs);
        return {
          date: s.date,
          shiftName: s.name as ShiftName,
          ...base,
        } as FOSummaryEntry;
      })
    );

    return { current: null, next, tz, lc: logisticCenterId };
  }

  const todayYmd = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");

  const targets: Array<{ date: string; name: ShiftName }> = [
    {
      date: todayYmd,
      name: currentShiftName as ShiftName,
    },
    ...nextShifts.map((s) => ({
      date: s.date,
      name: s.name as ShiftName,
    })),
  ];

  const results = await Promise.all(
    targets.map(async (t) => {
      const docs = await FarmerOrder.find(
        {
          logisticCenterId: new Types.ObjectId(logisticCenterId),
          shift: t.name,
          pickUpDate: t.date,
        },
        {
          _id: 1,
          farmerStatus: 1,
          farmerId: 1,
          stageKey: 1,
          stages: 1,
        }
      )
        .lean()
        .exec();

      const base = summarize(docs);
      return {
        date: t.date,
        shiftName: t.name,
        ...base,
      } as FOSummaryEntry;
    })
  );

  const [current, ...next] = results;
  return { current, next, tz, lc: logisticCenterId };
}

export async function listFarmerOrdersForShift(params: {
  logisticCenterId: string;
  date: string; // yyyy-LL-dd in LC timezone
  shiftName: ShiftName;
  farmerStatus?: "pending" | "ok" | "problem"; // legacy filter
  page?: number;
  limit?: number;
  fields?: string[];
}) {
  const {
    logisticCenterId,
    date,
    shiftName,
    farmerStatus,
    page = 1,
    limit = 50,
    fields,
  } = params;

  const cfg = await ShiftConfig.findOne({ logisticCenterId }, { timezone: 1 })
    .lean()
    .exec();
  if (!cfg)
    throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = cfg.timezone || "Asia/Jerusalem";

  const q: any = {
    logisticCenterId: new Types.ObjectId(logisticCenterId),
    shift: shiftName,
    pickUpDate: date,
  };
  if (farmerStatus) q.farmerStatus = farmerStatus; // legacy filter stays

  const projection =
    Array.isArray(fields) && fields.length
      ? fields.reduce((acc, f) => ((acc[f] = 1), acc), {} as Record<string, 1>)
      : undefined;

  const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

  // pull items for page + all docs for problemCount
  const [items, total, allForWindow] = await Promise.all([
    FarmerOrder.find(q, projection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    FarmerOrder.countDocuments(q),
    FarmerOrder.find(q, {
      _id: 1,
      stageKey: 1,
      stages: 1,
    })
      .lean()
      .exec(),
  ]);

  // NEW problemCount definition:
  const problemCount = allForWindow.filter((fo) =>
    isFarmerOrderProblem(fo)
  ).length;

  return {
    meta: {
      lc: logisticCenterId,
      date,
      shiftName,
      tz,
      page,
      limit,
      total,
      problemCount,
      pages: Math.ceil(total / Math.max(1, limit)),
    },
    items,
  };
}

/* =============================
 * LIST my FOs (farmer or admin/fManager)
 * ============================= */
export async function listMyFarmerOrdersService(
  user: UserCtx,
  opts?: {
    limit?: number;
    offset?: number;
    filters?: {
      itemId?: string;
      pickUpDate?: string;
      shift?: string;
      farmerId?: string; // allowed for admin/fManager
    };
  }
) {
  const limit = Math.min(opts?.limit ?? 50, 100);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const q: any = {};
  if (["admin", "fManager"].includes(user.role)) {
    if (opts?.filters?.farmerId)
      q.farmerId = new Types.ObjectId(opts.filters.farmerId);
  } else if (user.role === "farmer") {
    q.farmerId = user.userId;
  } else {
    q._id = null; // deny
  }

  if (opts?.filters?.itemId) q.itemId = new Types.ObjectId(opts.filters.itemId);
  if (opts?.filters?.pickUpDate) q.pickUpDate = String(opts.filters.pickUpDate);
  if (opts?.filters?.shift) q.shift = String(opts.filters.shift);

  return FarmerOrder.find(q)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
}
