// src/services/farmerOrder.service.ts
import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";
import { normalizeAndEnrichAuditEntries, type AuditEvent } from "../utils/audit.utils";

import { FarmerOrder } from "../models/farmerOrder.model";
import { Item } from "../models/Item.model";
import { Farmer } from "../models/farmer.model";
import ShiftConfig from "../models/shiftConfig.model";
import QRModel from "../models/QRModel.model";

import { DateTime } from "luxon";
import { getCurrentShift, getNextAvailableShifts, getShiftConfigByKey } from "./shiftConfig.service";

import {
  addItemToAvailableMarketStock,
  findOrCreateAvailableMarketStock,
} from "./availableMarketStock.service";

import { ensureFarmerOrderToken, signPayload } from "./ops.service";
import ApiError from "../utils/ApiError";
import { canonicalizeClaims } from "../utils/canonicalizeClaims";

import {
  FARMER_ORDER_STAGE_KEYS,
  FARMER_ORDER_STAGE_LABELS,
  FarmerOrderStageKey,
} from "../models/shared/stage.types";

// Stage helpers
import {
  isFarmerOrderProblem,
  ensureFOStageEntry,
  initFarmerOrderStagesAndAudit,
  ensurePipelineOpen,
} from "./farmerOrderStages.service";

import type { AuthUser } from "./farmerOrderStages.service";
import { getContactInfoByIdService } from ".//user.service";
import { get } from "node:http";

/* =============================
 * DTO and shaper (NEW)
 * ============================= */
export type FarmerOrderDTO = {
  id: string;
  _id: string; // keep both for FE compatibility
  // ...rest of FO fields are passed through
  audit?: AuditEvent[]; // normalized + enriched for FE
};

async function shapeFarmerOrderDTO(raw: any, opts?: { includeAudit?: boolean }): Promise<FarmerOrderDTO> {
  const includeAudit = !!opts?.includeAudit;

  const id = String(raw._id ?? raw.id);
  const dto: any = { ...raw, id, _id: id };

  if (includeAudit) {
    const rawTrail =
      (raw.historyAuditTrail as any[]) ??
      (raw.audit as any[]) ??
      (raw.auditTrail as any[]) ??
      [];
    dto.audit = await normalizeAndEnrichAuditEntries(Array.isArray(rawTrail) ? rawTrail : []);
    // If you want to hide raw trail from FE:
    // delete dto.historyAuditTrail;
  }

  return dto as FarmerOrderDTO;
}

/* =============================
 * Constants / helpers
 * ============================= */
const SHIFTS = ["morning", "afternoon", "evening", "night"] as const;
type Shift = (typeof SHIFTS)[number];

const FARMER_APPROVAL_STATUSES = ["pending", "ok", "problem"] as const;
type FarmerApprovalStatus = (typeof FARMER_APPROVAL_STATUSES)[number];

const STATIC_LC_ID = "66e007000000000000000001";

const isObjectId = (v: unknown) => typeof v === "string" && mongoose.isValidObjectId(v);
const toOID = (v: string | Types.ObjectId) =>
  v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v));
const isYMD = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const nonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;

type UserCtx = { userId: Types.ObjectId; role: string; LogisticCenterId?: Types.ObjectId };
export type ContactInfo = {
  name: string;
  email: string;
  phone: string | null;
  role: string;
  logisticCenterId: Types.ObjectId;
  // added only for farmer role
  farmName?: string | "Freshy Fresh";
  farmLogo?: string;
};

// helper to resolve farmLogo
async function resolveFarmLogo(farmerId: string, payloadLogo?: string | null) {
  if (payloadLogo) return payloadLogo;

  // try Farmer collection
  try {
    const farmerDoc = await Farmer.findById(farmerId, { farmLogo: 1 }).lean();
    if (farmerDoc?.farmLogo) return farmerDoc.farmLogo;
  } catch { /* ignore */ }

  // try contact info service
  try {
    const ci = await getContactInfoByIdService(String(farmerId));
    if (ci?.farmLogo) return ci.farmLogo;
  } catch { /* ignore */ }

  return null;
}

/* =============================
 * CREATE FarmerOrder (txn + FO QR)
 * ============================= */

export interface CreateFarmerOrderPayload {
  itemId?: string;
  type?: string;
  variety?: string;
  pictureUrl?: string;
  pictureURL?: string;

  farmerId?: string;
  farmerName?: string;
  farmName?: string;
  farmLogo?: string

  shift?: Shift;
  pickUpDate?: string; // "YYYY-MM-DD"

  forcastedQuantityKg?: number;
  sumOrderedQuantityKg?: number;
}

async function computePickUpTimeISO(args: {
  logisticCenterId: string;
  shift: "morning" | "afternoon" | "evening" | "night";
  pickUpDate: string;
}): Promise<Date> {
  const { logisticCenterId, shift, pickUpDate } = args;
  const cfg = await getShiftConfigByKey({ logisticCenterId, name: shift });
  const tz = cfg.timezone || "Asia/Jerusalem";
  const startMin = cfg.generalStartMin ?? 0;
  const pickupMin = startMin + 90;

  const base = DateTime.fromFormat(pickUpDate, "yyyy-LL-dd", { zone: tz }).startOf("day");
  const dt = base.plus({ minutes: pickupMin });
  return dt.toJSDate();
}

const EXCLUDED_FARMER_IDS = [
  "66f2aa00000000000000002a",
  "66f2aa000000000000000008",
] as const;

async function autoOkOrdersForShiftViaService(opts: {
  lcId: Types.ObjectId;
  date: string;
  shift: "morning" | "afternoon" | "evening" | "night";
  excludedFarmerIds: readonly string[];
}) {
  const { lcId, date, shift, excludedFarmerIds } = opts;
  const excludedOids = excludedFarmerIds.map((id) => toOID(id));

  const orders = await FarmerOrder.find(
    {
      logisticCenterId: toOID(lcId),
      pickUpDate: date,
      shift,
      farmerId: { $nin: excludedOids },
    },
    { _id: 1, farmerId: 1 }
  ).lean();

  for (const o of orders) {
    const actingUser = { id: String(o.farmerId), role: "farmer" } as any;
    try {
      await updateFarmerStatusService({
        orderId: String(o._id),
        status: "ok",
        note: "Auto OK (bulk after create)",
        user: actingUser,
      });
    } catch (err) {
      console.error("Auto OK failed for order", o._id, err);
    }
  }
}

export async function createFarmerOrderService(payload: CreateFarmerOrderPayload, user: AuthUser) {
  if (!["fManager", "admin"].includes(user.role)) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = ["Only fManager or admin can create farmer orders"];
    throw e;
  }

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

  const pickUpTime: Date = await computePickUpTimeISO({
    logisticCenterId: user.logisticCenterId ? String(user.logisticCenterId) : STATIC_LC_ID,
    shift: payload.shift as "morning" | "afternoon" | "evening" | "night",
    pickUpDate: payload.pickUpDate!,
  });
  const farmLogo = await resolveFarmLogo(String(payload.farmerId!), payload.farmLogo ?? null); // <-- await

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
        farmLogo,

        shift: payload.shift,
        pickUpDate: payload.pickUpDate,
        pickUpTime: pickUpTime,
        logisticCenterId: toOID(user.logisticCenterId ? String(user.logisticCenterId) : STATIC_LC_ID),

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

      initFarmerOrderStagesAndAudit(doc, createdBy);

      await doc.validate();
      await doc.save({ session });

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
        scope: foQR.scope,
      };
    });

    await autoOkOrdersForShiftViaService({
      lcId: toOID(user.logisticCenterId ? String(user.logisticCenterId) : STATIC_LC_ID),
      date: payload.pickUpDate!,
      shift: payload.shift as "morning" | "afternoon" | "evening" | "night",
      excludedFarmerIds: EXCLUDED_FARMER_IDS,
    });

    // Return shaped DTO with audit
    return await shapeFarmerOrderDTO(json, { includeAudit: true });
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

  const foQR = await ensureFarmerOrderToken({
    farmerOrderId: foId,
    createdBy: user.userId,
    ttlSeconds: 24 * 60 * 60,
    usagePolicy: "multi-use",
    session,
  });

  const containerQrs = await QRModel.find({
    scope: "container",
    subjectType: "Container",
    "claims.farmerOrderId": String(foId),
    status: { $in: ["active", "consumed"] },
  })
    .session(session)
    .lean();

  return {
    farmerOrder: fo, // caller can shape if needed
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
  count: number;
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

    const baseRawClaims = {
      farmerOrderId: foId,
      farmerDeliveryId: null,
      containerId: null,
      containerOpsId: null,
      orderId: null,
      packageId: null,
      logisticsCenterId: fo.logisticCenterId ? String(fo.logisticCenterId) : null,
      shelfId: null,
      pickTaskId: null,
      shift: fo.shift || null,
      deliveryDate: fo.pickUpDate ? new Date(`${fo.pickUpDate}T00:00:00Z`) : null,
    };

    const newContainers: any[] = [];
    const qrDocsToInsert: any[] = [];

    const nextIndexStart = (fo.containers?.length || 0) + 1;
    for (let i = 0; i < args.count; i++) {
      const seq = nextIndexStart + i;
      const containerId = `${foId.toString()}_${seq}`;

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
    fo.addAudit(args.user.userId, "CONTAINERS_INIT", `+${newContainers.length} containers`, {});
    await fo.save({ session });

    if (qrDocsToInsert.length > 0) {
      await QRModel.insertMany(qrDocsToInsert, { session });
    }

    await session.commitTransaction();
    return { ok: true, added: newContainers.length, containerIds: newContainers.map((c) => c.containerId) };
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
}

/* =============================
 * Update farmerStatus + pipeline + AMS
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

  const role = String(user.role).toLowerCase();
  const isFarmer = role === "farmer";
  const isManagerOrAdmin = role === "fmanager" || role === "admin";
  const isOwnerFarmer = isFarmer && String(order.farmerId) === String(user.id);

  if (!isOwnerFarmer && !isManagerOrAdmin) {
    const e: any = new Error("Forbidden");
    e.name = "Forbidden";
    e.details = [
      `Not allowed to update farmer order`,
      { role: user.role, userId: user.id, orderFarmerId: order.farmerId },
    ];
    throw e;
  }

  order.updatedBy = toOID(user.id);
  order.updatedAt = new Date();
  order.farmerStatus = status;

  if (status === "ok") {
    order.markStageOk("farmerAck", order.updatedBy as any, { note: note ?? "" });
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", {
      newStatus: "ok",
      byRole: role,
    });

    const itemDoc: any = await Item.findById(order.itemId).lean();
    if (!itemDoc) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Referenced item not found"];
      throw e;
    }

    const pricePerUnit = Number(itemDoc?.price?.a ?? (itemDoc as any)?.priceA ?? itemDoc?.price?.kg ?? NaN);
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
      const e: any = new Error("BadRequest");
      e.name = "BadRequest";
      e.details = ["Item.price.a (per KG) is required and must be >= 0"];
      throw e;
    }

    let farmLogo: string | undefined;
    try {
      const farmerDoc = await Farmer.findById(order.farmerId, { farmLogo: 1 }).lean();
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
      (order.variety ? `${order.type ?? ""} ${order.variety}`.trim() : order.type) ||
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

    order.markStageDone("farmerAck", order.updatedBy as any, {
      note: "Farmer approved; moved to QS",
    });
    order.setStageCurrent("farmerQSrep", order.updatedBy as any, {
      note: "Quality check in progress",
    });
    order.stageKey = "farmerQSrep";
  } else if (status === "problem") {
    for (const s of (order.stages as any[]) ?? []) {
      if (s?.status === "current") {
        s.status = "pending";
        s.timestamp = new Date();
      }
    }
    order.markStageDone("farmerAck", order.updatedBy as any, {
      note: note ?? "HALT: farmer reported problem",
    });

    const st = ensureFOStageEntry(order, "farmerAck");
    const now = new Date();
    st.status = "problem";
    st.timestamp = now;
    if (!st.startedAt) st.startedAt = now;
    if (note) st.note = note;

    order.stageKey = "farmerAck";
    order.addAudit(order.updatedBy as any, "PIPELINE_HALT", note ?? "Farmer reported problem", {
      byRole: role,
    });
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", {
      newStatus: "problem",
      byRole: role,
    });
  } else {
    order.addAudit(order.updatedBy as any, "FARMER_STATUS_UPDATE", note ?? "", {
      newStatus: "pending",
      byRole: role,
    });
  }

  await order.save();
  const json = order.toJSON();
  return await shapeFarmerOrderDTO(json, { includeAudit: true });
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

  fo.linkOrder(orderOID, allocatedQuantityKg == null ? null : Number(allocatedQuantityKg));
  fo.updatedAt = new Date();

  await fo.save({ session: opts?.session });
  // lightweight: no audit enrichment by default
  return (fo.toJSON() as any) as FarmerOrderDTO;
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
  // lightweight: no audit enrichment by default
  return (fo.toJSON() as any) as FarmerOrderDTO;
}

/* =============================
 * Shift summaries & listings
 * ============================= */
type ShiftName = "morning" | "afternoon" | "evening" | "night";

type FOSummaryParams = {
  logisticCenterId: string;
  count?: number;
};

type FOSummaryEntry = {
  date: string;
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

  const anyCfg = await ShiftConfig.findOne({ logisticCenterId }, { timezone: 1 })
    .lean<{ timezone?: string }>()
    .exec();
  if (!anyCfg) throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = anyCfg.timezone || "Asia/Jerusalem";

  const currentShiftName = await getCurrentShift();
  const nextShifts = await getNextAvailableShifts({ logisticCenterId, count });

  const summarize = (
    docs: Array<{ stageKey?: string; stages?: any[]; farmerStatus?: string; farmerId?: any }>
  ) => {
    const countAll = docs.length;
    const problemDocs = docs.filter((d) => isFarmerOrderProblem(d));
    const problemCount = problemDocs.length;

    const okDocs = docs.filter((d) => d.farmerStatus === "ok");
    const pendingDocs = docs.filter((d) => d.farmerStatus === "pending");
    const legacyProblemDocs = docs.filter((d) => d.farmerStatus === "problem");

    const okFO = okDocs.length;
    const pendingFO = pendingDocs.length;
    const problemFO = legacyProblemDocs.length;

    const uniq = (arr: any[]) => Array.from(new Set(arr.map((v) => String(v)))).length;

    return {
      count: countAll,
      problemCount,
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
          { _id: 1, farmerStatus: 1, farmerId: 1, stageKey: 1, stages: 1 }
        )
          .lean()
          .exec();

        const base = summarize(docs);
        return { date: s.date, shiftName: s.name as ShiftName, ...base } as FOSummaryEntry;
      })
    );

    return { current: null, next, tz, lc: logisticCenterId };
  }

  const todayYmd = DateTime.now().setZone(tz).toFormat("yyyy-LL-dd");

  const targets: Array<{ date: string; name: ShiftName }> = [
    { date: todayYmd, name: currentShiftName as ShiftName },
    ...nextShifts.map((s) => ({ date: s.date, name: s.name as ShiftName })),
  ];

  const results = await Promise.all(
    targets.map(async (t) => {
      const docs = await FarmerOrder.find(
        {
          logisticCenterId: new Types.ObjectId(logisticCenterId),
          shift: t.name,
          pickUpDate: t.date,
        },
        { _id: 1, farmerStatus: 1, farmerId: 1, stageKey: 1, stages: 1 }
      )
        .lean()
        .exec();

      const base = summarize(docs);
      return { date: t.date, shiftName: t.name, ...base } as FOSummaryEntry;
    })
  );

  const [current, ...next] = results;
  return { current, next, tz, lc: logisticCenterId };
}

type BaseParams = {
  logisticCenterId: string;
  date: string;
  shiftName: ShiftName;
  farmerStatus?: "pending" | "ok" | "problem";
  page?: number;
  limit?: number;
  fields?: string[];
  farmerId?: string;
  includeAudit?: boolean; // NEW: opt-in enrichment
};

export async function listFarmerOrdersForShift(
  params: BaseParams & { forFarmerView?: boolean }
) {
  const {
    logisticCenterId,
    date,
    shiftName,
    farmerStatus,
    page = 1,
    limit = 50,
    fields,
    farmerId,
    forFarmerView = false,
    includeAudit = false, // NEW default false
  } = params;

  const cfg = await ShiftConfig.findOne(
    { logisticCenterId },
    { timezone: 1 }
  )
    .lean()
    .exec();
  if (!cfg) throw new Error(`No ShiftConfig found for lc='${logisticCenterId}'`);
  const tz = cfg.timezone || "Asia/Jerusalem";

  const q: any = {
    logisticCenterId: new Types.ObjectId(logisticCenterId),
    shift: shiftName,
    pickUpDate: date,
  };
  if (farmerStatus) q.farmerStatus = farmerStatus;
  if (farmerId && Types.ObjectId.isValid(farmerId)) {
    q.farmerId = new Types.ObjectId(farmerId);
  }

  const farmerProjection: Record<string, 1> = {
    _id: 1,
    itemId: 1,
    type: 1,
    variety: 1,
    pictureUrl: 1,

    farmerName: 1,
    farmName: 1,
    farmLogo: 1,

    shift: 1,
    pickUpDate: 1,
    pickUpTime: 1,
    logisticCenterId: 1,

    farmerStatus: 1,
    sumOrderedQuantityKg: 1,
    forcastedQuantityKg: 1,
    finalQuantityKg: 1,

    containers: 1,
    containerSnapshots: 1,

    stageKey: 1,

    farmersQSreport: 1,
    inspectionQSreport: 1,
    visualInspection: 1,
    inspectionStatus: 1,

    createdAt: 1,
    updatedAt: 1,
    // NOTE: no audit in farmer view listing by default
    // category will be added via populate+flatten below
  };

  const projection =
    forFarmerView
      ? farmerProjection
      : Array.isArray(fields) && fields.length
      ? (fields.reduce(
          (acc, f) => ((acc[f] = 1), acc),
          {} as Record<string, 1>
        ) as any)
      : undefined;

  const safeLimit = Math.max(1, limit);
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * safeLimit;

  // --- Fetch: populate Item.category and then flatten onto docs ---
  const [rawDocs, total, allForWindow] = await Promise.all([
    FarmerOrder.find(q, projection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate({
        path: "itemId",
        select: "category", // only what we need
        options: { lean: true },
      })
      .lean()
      .exec(),
    FarmerOrder.countDocuments(q).exec(),
    FarmerOrder.find(q, { _id: 1, stageKey: 1, stages: 1 }).lean().exec(),
  ]);

  const problemCount = allForWindow.filter((fo) => isFarmerOrderProblem(fo)).length;

  // Flatten item.category -> doc.category, and normalize itemId back to ObjectId if you prefer
  const docs = (rawDocs as any[]).map((d) => ({
    ...d,
    category: d.category ?? d?.itemId?.category ?? null,
    itemId: d?.itemId?._id ?? d.itemId, // keep as ObjectId value (not populated object)
  }));

  // Farmer view: keep current mapping (fast), but provide itemCategory from flattened category
  if (forFarmerView) {
    const itemsBase = docs.map((d: any) => ({
      id: String(d._id),
      itemId: String(d.itemId),
      type: d.type || "",
      itemCategory: d.category ?? null, // <-- now filled from Item.category
      variety: d.variety || "",
      imageUrl: d.pictureUrl || "",
      farmerName: d.farmerName,
      farmName: d.farmName,
      farmLogo: d.farmLogo ?? null,
      shift: d.shift,
      pickUpDate: d.pickUpDate,
      pickUpTime: d.pickUpTime || null,
      logisticCenterId: String(d.logisticCenterId),
      farmerStatus: d.farmerStatus,
      orderedQuantityKg: d.sumOrderedQuantityKg ?? 0,
      forcastedQuantityKg: d.forcastedQuantityKg ?? 0,
      finalQuantityKg: d.finalQuantityKg ?? null,
      containers: d.containers || [],
      containerSnapshots: d.containerSnapshots || [],
      stageKey: d.stageKey ?? null,
      farmersQSreport: d.farmersQSreport,
      inspectionQSreport: d.inspectionQSreport,
      visualInspection: d.visualInspection,
      inspectionStatus: d.inspectionStatus,
    }));

    if (!includeAudit) {
      return {
        meta: {
          lc: logisticCenterId,
          date,
          shiftName,
          tz,
          page: safePage,
          limit: safeLimit,
          total,
          problemCount,
          pages: Math.ceil(total / safeLimit),
          scopedToFarmer: Boolean(farmerId),
          forFarmerView,
        },
        items: itemsBase,
      };
    }

    // includeAudit path for farmer view
    const items = await Promise.all(
      itemsBase.map(async (x, idx) => {
        const raw = rawDocs[idx] as any; // use raw to pull audit from selection if present
        const audit = await normalizeAndEnrichAuditEntries(
          (raw?.historyAuditTrail ?? raw?.audit ?? raw?.auditTrail ?? []) as any[]
        );
        return { ...x, audit };
      })
    );

    return {
      meta: {
        lc: logisticCenterId,
        date,
        shiftName,
        tz,
        page: safePage,
        limit: safeLimit,
        total,
        problemCount,
        pages: Math.ceil(total / safeLimit),
        scopedToFarmer: Boolean(farmerId),
        forFarmerView,
      },
      items,
    };
  }

  // Manager/admin listing path
  if (!includeAudit) {
    return {
      meta: {
        lc: logisticCenterId,
        date,
        shiftName,
        tz,
        page: safePage,
        limit: safeLimit,
        total,
        problemCount,
        pages: Math.ceil(total / safeLimit),
        scopedToFarmer: Boolean(farmerId),
        forFarmerView,
      },
      items: docs, // raw with category flattened
    };
  }

  // includeAudit for manager/admin
  const items = await Promise.all(
    docs.map((d: any) => shapeFarmerOrderDTO(d, { includeAudit: true }))
  );

  return {
    meta: {
      lc: logisticCenterId,
      date,
      shiftName,
      tz,
      page: safePage,
      limit: safeLimit,
      total,
      problemCount,
      pages: Math.ceil(total / safeLimit),
      scopedToFarmer: Boolean(farmerId),
      forFarmerView,
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
      farmerStatus?: "pending" | "ok" | "problem";
      itemId?: string;
      shift?: string;
      from?: string;
      to?: string;
      fields?: string[];
    };
  }
) {
  const limit = Math.min(opts?.limit ?? 50, 100);
  const offset = Math.max(opts?.offset ?? 0, 0);

  const q: any = {};

  if (["admin", "fManager"].includes(user.role)) {
    if (!user.LogisticCenterId) {
      q._id = null;
    } else {
      q.logisticCenterId = user.LogisticCenterId;
    }
  } else if (user.role === "farmer") {
    q.farmerId = user.userId;
  } else {
    q._id = null;
  }

  if (opts?.filters?.farmerStatus) q.farmerStatus = opts.filters.farmerStatus;
  if (opts?.filters?.itemId) q.itemId = toOID(opts.filters.itemId);
  if (opts?.filters?.shift) q.shift = String(opts.filters.shift);

  if (opts?.filters?.from || opts?.filters?.to) {
    q.pickUpDate = {};
    if (opts.filters.from) q.pickUpDate.$gte = String(opts.filters.from);
    if (opts.filters.to) q.pickUpDate.$lte = String(opts.filters.to);
  }

  let projection: Record<string, 1> | undefined;
  if (Array.isArray(opts?.filters?.fields) && opts.filters!.fields.length) {
    const base = new Set<string>(["_id", "pickUpDate", "shift"]);
    for (const f of opts.filters!.fields) base.add(f);
    projection = Array.from(base).reduce((acc, f) => ((acc[f] = 1), acc), {} as Record<string, 1>);
  }

  const branches = (SHIFTS as readonly string[]).map((name, idx) => ({
    case: { $eq: ["$shift", name] },
    then: idx,
  }));

  const pipeline: any[] = [
    { $match: q },
    ...(projection ? [{ $project: projection }] : []),
    {
      $addFields: {
        __shiftOrd: {
          $switch: {
            branches,
            default: (SHIFTS as readonly string[]).length + 1,
          },
        },
      },
    },
    { $sort: { pickUpDate: 1, __shiftOrd: 1, _id: 1 } },
    { $skip: offset },
    { $limit: limit },
  ];

  const docs = await FarmerOrder.aggregate(pipeline).allowDiskUse(true);

  return docs.map((d: any) => {
    const id = String(d._id);
    const { __shiftOrd, _id, ...rest } = d;
    return { id, _id: id, ...rest } as FarmerOrderDTO;
  });
}
