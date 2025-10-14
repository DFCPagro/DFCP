// src/services/farmerOrder.service.ts
import mongoose, { Types } from "mongoose";
import { FarmerOrder } from "../models/farmerOrder.model";
import { Item } from "../models/Item.model";
import { Farmer } from "../models/farmer.model";

import {
  addItemToAvailableMarketStock,
  getAvailableMarketStockByKey,
  findOrCreateAvailableMarketStock,
} from "../services/availableMarketStock.service";

const SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
type Shift = (typeof SHIFTS)[number];

const FARMER_APPROVAL_STATUSES = ["pending", "ok", "problem"] as const;
type FarmerApprovalStatus = (typeof FARMER_APPROVAL_STATUSES)[number];

// If this is your LC _id (hex), keep it and we'll cast to ObjectId where needed
const STATIC_LC_ID = "66e007000000000000000001";

const isObjectId = (v: unknown) => typeof v === "string" && mongoose.isValidObjectId(v);
const toOID = (v: string | Types.ObjectId) =>
  v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));
const isYMD = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const nonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;

export interface AuthUser {
  id: string; // user._id as string
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
  itemId?: string;       // ObjectId string
  type?: string;
  variety?: string;
  pictureUrl?: string;   // pictureUrl or pictureURL accepted
  pictureURL?: string;

  farmerId?: string;     // ObjectId string
  farmerName?: string;
  farmName?: string;

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

  // Requireds
  if (!nonEmpty(payload.itemId)) errors.push("itemId is required.");
  if (!nonEmpty(payload.type)) errors.push("type is required.");
  if (!nonEmpty(payload.variety)) errors.push("variety is required.");
  if (!nonEmpty(pictureUrlRaw)) errors.push("pictureUrl is required.");
  if (!nonEmpty(payload.farmerId)) errors.push("farmerId is required.");
  if (!nonEmpty(payload.farmerName)) errors.push("farmerName is required.");
  if (!nonEmpty(payload.farmName)) errors.push("farmName is required.");
  if (!nonEmpty(payload.pickUpDate)) errors.push("pickUpDate is required.");
  if (!nonEmpty(payload.shift)) errors.push("shift is required.");

  if (payload.itemId && !isObjectId(payload.itemId)) errors.push("itemId must be a valid ObjectId string.");
  if (payload.farmerId && !isObjectId(payload.farmerId)) errors.push("farmerId must be a valid ObjectId string.");
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

  const createdBy = toOID(user.id);
  const updatedBy = createdBy;

  const doc = new FarmerOrder({
    createdBy,
    updatedBy,

    // ObjectId refs per model
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

    farmerStatus: "pending",

    sumOrderedQuantityKg:
      Number.isFinite(Number(payload.sumOrderedQuantityKg)) && Number(payload.sumOrderedQuantityKg) >= 0
        ? Number(payload.sumOrderedQuantityKg)
        : 0,

    forcastedQuantityKg: fcast,

    // derived fields, arrays:
    orders: [],
    containers: [],

    historyAuditTrail: [],
  });

  doc.addAudit(createdBy, "CREATE", "Farmer order created");

  await doc.validate();
  await doc.save();

  return doc.toJSON();
}

/* =========================
 *   AMS (Available Stock)
 * ========================= */

// (Optional / currently unused) Ensure an AMS doc exists (string API kept for compatibility)
async function ensureAMSAndGetId(params: { LCid: string; date: string; shift: Shift }) {
  const { LCid, date, shift } = params;
  let doc = await getAvailableMarketStockByKey({ LCid, date, shift });
  if (!doc) {
    const { AvailableMarketStockModel } = await import("../models/availableMarketStock.model");
    doc = await AvailableMarketStockModel.create({
      LCid: toOID(LCid),
      availableDate: new Date(date + "T00:00:00.000Z"),
      availableShift: shift,
      items: [],
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
 *  2) upsert item into AMS bucket (LC + date + shift) with pricePerUnit (Item.price.a)
 *  3) mark farmerAck -> done; set farmerQSrep current
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

  // Authorization
  const isOwnerFarmer = user.role === "farmer" && String(order.farmerId) === String(user.id);
  const isManagerOrAdmin = user.role === "farmerManager" || user.role === "admin"; // ✅ fixed
  if (!isOwnerFarmer && !isManagerOrAdmin) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Not allowed to update this farmer order status"];
    throw e;
  }

  order.updatedBy = toOID(user.id);
  order.updatedAt = new Date();
  order.farmerStatus = status;

  if (status === "ok") {
    // 1) mark farmer stage ok
    order.markStageOk("farmerAck", order.updatedBy as any, { note: note ?? "" });
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", { newStatus: "ok" });

    // 2) Prepare AMS item
    const itemDoc: any = await Item.findById(order.itemId).lean();
    if (!itemDoc) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Referenced item not found"];
      throw e;
    }

    // price per KG (required by AMS)
    const pricePerUnit = Number(itemDoc?.price?.a ?? itemDoc?.priceA ?? itemDoc?.price?.kg ?? NaN);
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Item.price.a (per KG) is required and must be >= 0"];
      throw e;
    }

    // farm logo (optional)
    let farmLogo: string | undefined;
    try {
      const farmerDoc = await Farmer.findById(order.farmerId, { farmLogo: 1 }).lean();
      farmLogo = farmerDoc?.farmLogo ?? (order as any)?.farmLogo ?? undefined;
    } catch {
      farmLogo = (order as any)?.farmLogo ?? undefined;
    }

    // 3) Get or create AMS doc for LC + date + shift
    const amsDoc = await findOrCreateAvailableMarketStock({
      LCid: String(order.logisticCenterId), // service expects string key
      date: order.pickUpDate,
      shift: order.shift as Shift,
      createdById: order.updatedBy, // ObjectId is fine
    });
    const amsDocId = String(amsDoc._id);

    // committed kg (use forecast by default)
    const committedKg = Math.max(
      0,
      Number(
        (order as any).forcastedQuantityKg ??
          (order as any).forecastedQuantityKg ??
          (order as any).sumOrderedQuantityKg ??
          0
      )
    );

    // display name
    const displayName =
      (itemDoc?.variety ? `${itemDoc?.type ?? ""} ${itemDoc.variety}`.trim() : itemDoc?.type) ||
      (order.variety ? `${order.type ?? ""} ${order.variety}`.trim() : order.type) ||
      "Unknown Item";

    // category + image
    const category = (itemDoc as any)?.category ?? "unknown";
    const imageUrl = itemDoc?.imageUrl ?? (order as any).pictureUrl ?? null;

    // 4) Push to AMS stock (schema-aligned)
    await addItemToAvailableMarketStock({
      docId: amsDocId,
      item: {
        itemId: String(order.itemId), // service can cast to ObjectId internally
        displayName,
        imageUrl,
        category,

        pricePerUnit, // ✅ required by AMS

        originalCommittedQuantityKg: committedKg,
        currentAvailableQuantityKg: committedKg,

        farmerOrderId: String(order._id),
        farmerID: String(order.farmerId),
        farmerName: order.farmerName,
        farmName: order.farmName,
        farmLogo, // ✅ new

        // optional; AMS defaults to 'kg'
        // unitMode: "kg",
        // estimates: { avgWeightPerUnitKg: undefined },
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

    // 5) advance pipeline
    order.markStageDone("farmerAck", order.updatedBy as any, {
      note: "Farmer approved; moved to QS",
    });
    order.setStageCurrent("farmerQSrep", order.updatedBy as any, {
      note: "Quality check in progress",
    });
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
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", {
      newStatus: "problem",
    });
  } else {
    // revert to pending (optional)
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", {
      newStatus: "pending",
    });
  }

  await order.save();
  return order.toJSON();
}

/* =========================
 *   UPDATE stage status
 * ========================= */

type StageAction = "setCurrent" | "ok" | "done" | "problem";

interface UpdateStageArgs {
  farmerOrderId: string;
  key: string; // FarmerOrderStageKey
  action: StageAction;
  note?: string;
  user: AuthUser;
}

export async function updateStageStatusService(args: UpdateStageArgs) {
  const { farmerOrderId, key, action, note, user } = args;

  if (!mongoose.isValidObjectId(farmerOrderId)) {
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

  const order = await FarmerOrder.findById(farmerOrderId);
  if (!order) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["Farmer order not found"];
    throw e;
  }

  // deny changes if pipeline halted, unless we're explicitly marking problem
  if (action !== "problem") ensurePipelineOpen(order);

  order.updatedBy = toOID(user.id);
  order.updatedAt = new Date();

  // Validate stage key presence (model will also validate)
  const stage = (order.stages as any[])?.find((s) => s?.key === key);
  if (!stage && action !== "setCurrent") {
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
      const s: any = stage || {};
      s.status = "problem";
      s.timestamp = new Date();
      if (!s.startedAt) s.startedAt = new Date();
      if (note) s.note = note;
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


/**
 * Adjust the allocated kg for a SPECIFIC order inside a FarmerOrder by deltaKg.
 * If the order link does not exist, it will be created with max(0, deltaKg).
 */
export async function adjustFarmerOrderAllocatedKg(
  orderId: IdLike,
  farmerOrderId: IdLike,
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
  if (!fo) {
    const e: any = new Error("NotFound");
    e.name = "NotFound";
    e.details = ["FarmerOrder not found"];
    throw e;
  }

  // find current allocation for this order
  const coll: any[] = Array.isArray(fo.orders) ? fo.orders : [];
  let current = 0;
  let entry = coll.find((o: any) => String(o.orderId) === String(orderOID));
  if (entry && Number.isFinite(entry.allocatedQuantityKg)) {
    current = Number(entry.allocatedQuantityKg);
  }

  const next = Math.max(0, Math.round((current + deltaKg) * 1000) / 1000);

  // use your model method (absolute setter) to keep hooks in play
  fo.linkOrder(orderOID, next);
  fo.updatedAt = new Date();

  await fo.save({ session: opts?.session });
  return fo.toJSON();
}


