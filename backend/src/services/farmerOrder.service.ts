import mongoose,{Types} from "mongoose";
import { FarmerOrder } from "../models/farmerOrder.model";
import { Item } from "../models/Item.model"; // used to enrich AMS line (category/displayName/image)

// Use your existing AMS helpers:
import {
  addItemToAvailableMarketStock,
  getAvailableMarketStockByKey,
} from "../services/availableMarketStock.service";

const SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
type Shift = (typeof SHIFTS)[number];

const FARMER_APPROVAL_STATUSES = ["pending", "ok", "problem"] as const;
type FarmerApprovalStatus = (typeof FARMER_APPROVAL_STATUSES)[number];

const STATIC_LC_ID = "66e007000000000000000001";

const isObjectId = (v: unknown) => typeof v === "string" && mongoose.isValidObjectId(v);
const toObjectId = (v: string) => new mongoose.Types.ObjectId(v);
const isYMD = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const nonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export interface AuthUser {
  id: string;                                  // user._id as string
  role: "farmer" | "farmerManager" | "admin" | string;
}

/** Block any stage-advance while pipeline is halted by farmer problem */
export function ensurePipelineOpen(order: any) {
  if (order.farmerStatus === "problem") {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Pipeline is halted due to farmer-reported problem"];
    throw e;
  }
}

/* =========================
 *         CREATE
 * ========================= */

export interface CreateFarmerOrderPayload {
  itemId?: string;
  type?: string;
  variety?: string;
  pictureUrl?: string;   // pictureUrl or pictureURL accepted
  pictureURL?: string;

  farmerId?: string;     // ObjectId string
  farmerName?: string;
  farmName?: string;

  //landId?: string;       // ObjectId string
  //sectionId?: string;

  shift?: Shift;
  pickUpDate?: string;   // "YYYY-MM-DD"

  forcastedQuantityKg?: number;
  sumOrderedQuantityKg?: number;
}

export async function createFarmerOrderService(payload: CreateFarmerOrderPayload, user: AuthUser) {
  // Only managers/admin can create
  if (!["farmerManager", "admin"].includes(user.role)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Only farmerManager or admin can create farmer orders"];
    throw e;
  }

  const errors: string[] = [];
  const pictureUrlRaw = payload.pictureUrl ?? payload.pictureURL;

  // Requireds (per your story)
  if (!nonEmpty(payload.itemId)) errors.push("itemId is required.");
  if (!nonEmpty(payload.type)) errors.push("type is required.");
  if (!nonEmpty(payload.variety)) errors.push("variety is required.");
  if (!nonEmpty(pictureUrlRaw)) errors.push("pictureUrl is required.");
  if (!nonEmpty(payload.farmerId)) errors.push("farmerId is required.");
  if (!nonEmpty(payload.farmerName)) errors.push("farmerName is required.");
  if (!nonEmpty(payload.farmName)) errors.push("farmName is required.");
  //if (!nonEmpty(payload.landId)) errors.push("landId is required.");
  //if (!nonEmpty(payload.sectionId)) errors.push("sectionId is required.");
  if (!nonEmpty(payload.pickUpDate)) errors.push("pickUpDate is required.");
  if (!nonEmpty(payload.shift)) errors.push("shift is required.");

  if (payload.farmerId && !isObjectId(payload.farmerId)) errors.push("farmerId must be a valid ObjectId string.");
  //if (payload.landId && !isObjectId(payload.landId)) errors.push("landId must be a valid ObjectId string.");
  if (payload.pickUpDate && !isYMD(payload.pickUpDate)) errors.push("pickUpDate must be 'YYYY-MM-DD'.");
  if (payload.shift && !SHIFTS.includes(payload.shift as Shift)) {
    errors.push(`shift must be one of: ${SHIFTS.join(", ")}.`);
  }

  const fcast = Number(payload.forcastedQuantityKg);
  if (!Number.isFinite(fcast) || fcast < 0) {
    errors.push("forcastedQuantityKg is required and must be a number >= 0.");
  }

  if (errors.length) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = errors;
    throw e;
  }

  const createdBy = toObjectId(user.id);
  const updatedBy = createdBy;

  const doc = new FarmerOrder({
    createdBy,
    updatedBy,

    itemId: String(payload.itemId),
    type: String(payload.type),
    variety: String(payload.variety),
    pictureUrl: String(pictureUrlRaw),

    farmerId: toObjectId(String(payload.farmerId)),
    farmerName: String(payload.farmerName),
    farmName: String(payload.farmName),

    shift: payload.shift,
    pickUpDate: payload.pickUpDate,
    logisticCenterId: STATIC_LC_ID,      // forced static LC id

    farmerStatus: "pending",

    sumOrderedQuantityKg:
      Number.isFinite(Number(payload.sumOrderedQuantityKg)) && Number(payload.sumOrderedQuantityKg) >= 0
        ? Number(payload.sumOrderedQuantityKg)
        : 0,

    forcastedQuantityKg: fcast,
    finalQuantityKg: null,                // recalculated by pre('validate')

    orders: [],
    containers: [],

    historyAuditTrail: [],
  });

  // If you want all stages default "pending", ensure your buildFarmerOrderDefaultStages() returns that.
  doc.addAudit(createdBy, "CREATE", "Farmer order created");

  await doc.validate();
  await doc.save();

  return doc.toJSON();
}

/* =========================
 *   AMS (Available Stock)
 * ========================= */

/** Ensure an AMS doc exists for (LC, date, shift); return its _id as string. */
async function ensureAMSAndGetId(params: { LCid: string; date: string; shift: Shift }) {
  const { LCid, date, shift } = params;
  let doc = await getAvailableMarketStockByKey({ LCid, date, shift });
  if (!doc) {
    // If your AMS model requires other fields, add them here
    const { AvailableMarketStockModel } = await import("../models/availableMarketStock.model");
    doc = await AvailableMarketStockModel.create({
      LCid,
      availableDate: new Date(date + "T00:00:00.000Z"),
      availableShift: shift,
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return String(doc._id);
}

/* =========================
 *   UPDATE farmerStatus
 * ========================= */

interface UpdateFarmerStatusArgs {
  orderId: string;
  status: FarmerApprovalStatus; // "ok" | "problem" | "pending"
  note?: string;
  user: AuthUser;
}

/**
 * Roles:
 * - farmer: allowed iff user.id === order.farmerId
 * - farmerManager/admin: allowed for any order
 *
 * When status === "ok":
 *  1) mark farmerAck -> ok
 *  2) upsert item into AMS bucket (LC + date + shift)
 *  3) mark farmerAck -> done
 *  4) set farmerQSrep -> current
 *  5) audit everything
 *
 * When status === "problem": halt pipeline, clear any "current", mark farmerAck done with HALT note, audit.
 */
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

  // auth per your rule
  const isOwnerFarmer = user.role === "farmer" && String(order.farmerId) === String(user.id);
  const isManagerOrAdmin = user.role === "fManager" || user.role === "admin";
  if (!isOwnerFarmer && !isManagerOrAdmin) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Not allowed to update this farmer order status"];
    throw e;
  }

  order.updatedBy = toObjectId(user.id);
  order.updatedAt = new Date();
  order.farmerStatus = status;

  if (status === "ok") {
    // 1) farmerAck -> ok
    order.markStageOk("farmerAck", order.updatedBy as any, { note: note ?? "" });
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", { newStatus: "ok" });

    // 2) AMS upsert
    const itemDoc = await Item.findById(order.itemId).lean();
    if (!itemDoc) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Referenced item not found"];
      throw e;
    }

    const amsDocId = await ensureAMSAndGetId({
      LCid: order.logisticCenterId,
      date: order.pickUpDate,
      shift: order.shift as Shift,
    });

    await addItemToAvailableMarketStock({
      docId: amsDocId,
      item: {
        itemId: String(order.itemId),
        displayName: itemDoc.type ?? itemDoc.variety ?? `${order.type} ${order.variety}`.trim(),
        imageUrl: itemDoc.imageUrl ?? order.pictureUrl ?? null,
        category: itemDoc.category ?? "unknown",
        // pricePerUnit: (omit to let helper compute via computePriceFromItem)
        originalCommittedQuantityKg: Number(order.forcastedQuantityKg) || 0,
        currentAvailableQuantityKg: Number(order.forcastedQuantityKg) || 0,
        farmerOrderId: String(order._id),
        farmerID: String(order.farmerId),
        farmerName: order.farmerName,
        farmName: order.farmName,
        status: "active",
      },
    });

    order.addAudit(order.updatedBy as any, "AVAILABLE_STOCK_UPSERT", "", {
      LCid: order.logisticCenterId,
      date: order.pickUpDate,
      shift: order.shift,
      itemId: order.itemId,
      farmerId: order.farmerId,
      qtyForecast: order.forcastedQuantityKg,
    });

    // 3) farmerAck -> done; 4) quality check current
    order.markStageDone("farmerAck", order.updatedBy as any, { note: "Farmer approved; moved to QS" });
    order.setStageCurrent("farmerQSrep", order.updatedBy as any, { note: "Quality check in progress" });

  } else if (status === "problem") {
    // Halt pipeline: clear any "current"
    for (const s of (order.stages as any[]) ?? []) {
      if (s?.status === "current") {
        s.status = "pending";
        s.timestamp = new Date();
      }
    }
    order.markStageDone("farmerAck", order.updatedBy as any, {
      note: note ?? "HALT: farmer reported problem",
    });
    order.addAudit(order.updatedBy as any, "PIPELINE_HALT", note ?? "Farmer reported problem");
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", { newStatus: "problem" });

  } else {
    // Allow revert to pending (optional)
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", { newStatus: "pending" });
  }

  await order.save();
  return order.toJSON();
}

/* =========================
 *   UPDATE stage status
 * ========================= */

type StageAction = "setCurrent" | "ok" | "done" | "problem";

interface UpdateStageArgs {
  orderId: string;
  key: string;        // FarmerOrderStageKey (validated at runtime)
  action: StageAction;
  note?: string;
  user: AuthUser;
}

/**
 * Rules:
 * - Only farmerManager/admin can change stage statuses (farmer uses farmerStatus endpoint).
 * - Blocks when pipeline halted (farmerStatus === "problem"), except allowing action === "problem" to mark the stage.
 * - Uses model instance methods for 'current'/'ok'/'done'. For 'problem' we set the stage status directly.
 */
export async function updateStageStatusService(args: UpdateStageArgs) {
  const { orderId, key, action, note, user } = args;

  if (!mongoose.isValidObjectId(orderId)) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = ["Invalid farmer order id"];
    throw e;
  }
  if (!["farmerManager", "admin"].includes(user.role)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Only farmerManager or admin can update stages"];
    throw e;
  }

  const order = await FarmerOrder.findById(orderId);
  if (!order) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["Farmer order not found"];
    throw e;
  }

  // deny changes if pipeline halted, unless we're explicitly marking problem
  if (action !== "problem") ensurePipelineOpen(order);

  order.updatedBy = toObjectId(user.id);
  order.updatedAt = new Date();

  // Validate stage key against your list
  // We rely on model's method throwing if invalid; but let's fail early if missing:
  const stage = (order.stages as any[])?.find(s => s?.key === key);
  if (!stage) {
    const e: any = new Error("BadRequest");
    e.name = "BadRequest";
    e.details = [`Stage not found: ${key}`];
    throw e;
  }

  switch (action) {
    case "setCurrent":
      order.setStageCurrent(key as any, order.updatedBy as any, { note });
      break;
    case "ok":
      order.markStageOk(key as any, order.updatedBy as any, { note });
      break;
    case "done":
      order.markStageDone(key as any, order.updatedBy as any, { note });
      break;
    case "problem":
      // Mark the stage itself as problem; keep timestamps coherent
      stage.status = "problem";
      stage.timestamp = new Date();
      if (!stage.startedAt) stage.startedAt = new Date();
      if (note) stage.note = note;
      order.addAudit(order.updatedBy as any, "STAGE_SET_PROBLEM", note ?? "", { key });
      break;
    default: {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Unknown stage action"];
      throw e;
    }
  }

  if (action !== "problem") {
    order.addAudit(order.updatedBy as any, "STAGE_UPDATE", note ?? "", { key, action });
  }

  await order.save();
  return order.toJSON();
}

/* =========================
 *   ADD orderId to FarmerOrder
 * ========================= */

type IdLike = string | Types.ObjectId;
const toOID = (v: IdLike) => (v instanceof Types.ObjectId ? v : new Types.ObjectId(v));

export async function addOrderIdToFarmerOrder(
  orderId: IdLike,
  farmerOrderId: IdLike,
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
  if (!fo) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["FarmerOrder not found"];
    throw e;
  }

  const alloc = allocatedQuantityKg == null ? null : Number(allocatedQuantityKg);

  // use model method (idempotent for this orderId)
  fo.linkOrder(orderOID, alloc);
  fo.updatedAt = new Date();

  // no audit per your request
  await fo.save({ session: opts?.session }); // pre('validate') keeps sums/final in sync
  return fo.toJSON();
}


