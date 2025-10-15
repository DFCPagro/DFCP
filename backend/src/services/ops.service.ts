// src/services/ops.service.ts
import crypto from "crypto";
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";
import QRModel from "../models/QRModel.model";
import { FarmerOrder } from "../models/farmerOrder.model";
import { FarmerDelivery } from "../models/farmerDelivery";
import { canonicalizeClaims } from "../utils/canonicalizeClaims";

type QRScope = "farmer-order" | "container" | "farmer-delivery" | string;
const HMAC_SECRET = process.env.QR_HMAC_SECRET as string;
if (!HMAC_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("[ops.service] QR_HMAC_SECRET is empty! Sign/verify will fail.");
}

/* -----------------------------
   HMAC helpers (canonicalized)
------------------------------*/
function signPayload(p: {
  token: string;
  scope: string;
  subjectType: string;
  subjectId: string;
  claims: Record<string, any>;
}) {
  return crypto.createHmac("sha256", HMAC_SECRET).update(JSON.stringify(p)).digest("hex");
}

function computeExpectedSigFromQrDoc(qr: any) {
  const canonicalClaims = canonicalizeClaims(qr.claims || {});
  return signPayload({
    token: qr.token,
    scope: qr.scope,
    subjectType: qr.subjectType,
    subjectId: String(qr.subjectId),
    claims: canonicalClaims,
  });
}

function verifyQRSignature(qr: any) {
  const expectedSig = computeExpectedSigFromQrDoc(qr);
  if (expectedSig !== qr.sig) throw new ApiError(400, "Invalid QR signature");
}

/* -----------------------------
         QR minting
------------------------------*/
async function mintQR(args: {
  createdBy: Types.ObjectId;
  scope: QRScope;
  subjectType: string;
  subjectId: string | Types.ObjectId;
  claims?: Record<string, any>;
  usagePolicy?: "single-use" | "multi-use";
  maxUses?: number | null;
  maxScansPerHour?: number;
  ttlSeconds?: number;
  notBefore?: Date | null;
  issuer?: Types.ObjectId | null;
}) {
  const {
    createdBy,
    scope,
    subjectType,
    subjectId,
    claims = {},
    usagePolicy = "multi-use",
    maxUses = null,
    maxScansPerHour = 240,
    ttlSeconds,
    notBefore,
    issuer = null,
  } = args;

  const token = `QR-${crypto.randomUUID()}`;
  const subjectIdStr = String(subjectId);
  const canonicalClaims = canonicalizeClaims(claims);

  const sig = signPayload({
    token,
    scope,
    subjectType,
    subjectId: subjectIdStr,
    claims: canonicalizeClaims(canonicalClaims),
  });

  return QRModel.create({
    token,
    sig,
    scope,
    subjectType,
    subjectId: subjectIdStr,
    claims: canonicalClaims,
    status: "active",
    usagePolicy,
    maxUses,
    maxScansPerHour,
    createdBy,
    issuer,
    notBefore: notBefore ?? null,
    expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null,
  });
}

/* -----------------------------
   Public reads for farmer app
------------------------------*/
async function listMyOrders(farmerUserId: Types.ObjectId) {
  const orders = await FarmerOrder.find({ farmerId: farmerUserId })
    .select("_id type variety shift pickUpDate logisticCenterId containers farmerStatus")
    .lean();
  return orders;
}

/* Ensure order print payload (order QR + container QRs) */
async function ensureOrderPrintPayload(args: {
  orderId: string;
  userId: Types.ObjectId;
  ttlSeconds?: number;
}) {
  const { orderId, userId, ttlSeconds = 60 * 60 } = args;

  if (!Types.ObjectId.isValid(orderId)) throw new ApiError(400, "Invalid order id");
  const oid = new Types.ObjectId(orderId);

  const order: any = await FarmerOrder.findById(oid).lean();
  if (!order) throw new ApiError(404, "Farmer order not found");

  const containers: any[] = Array.isArray(order.containers) ? order.containers : [];
  if (!containers.length) throw new ApiError(400, "Order has no containers to mint QR codes for");

  // Order QR
  const orderClaims = canonicalizeClaims({
    farmerOrderId: order._id,
    logisticsCenterId: order.logisticCenterId,
    shift: order.shift ?? null,
    deliveryDate: order.pickUpDate ? new Date(order.pickUpDate + "T00:00:00.000Z") : null,
  });

  let orderQR =
    (await QRModel.findOne({
      scope: "farmer-order",
      subjectType: "FarmerOrder",
      subjectId: String(order._id),
      status: "active",
    }).lean()) ||
    (await mintQR({
      createdBy: userId,
      scope: "farmer-order",
      subjectType: "FarmerOrder",
      subjectId: String(order._id),
      claims: orderClaims,
      ttlSeconds,
    })).toObject();

  // Container QRs
  const containerQrs: Record<string, string> = {};
  for (const c of containers) {
    const cid = String(c.containerId);
    if (!cid) continue;
    const claims = canonicalizeClaims({
      farmerOrderId: order._id,
      containerId: cid,
      logisticsCenterId: order.logisticCenterId,
      farmerDeliveryId: null,
      containerOpsId: null,
      orderId: null,
      packageId: null,
      shelfId: null,
      pickTaskId: null,
      shift: null,
      deliveryDate: null,
    });

    let qr =
      (await QRModel.findOne({
        scope: "container",
        subjectType: "FarmerOrderContainer",
        subjectId: String(order._id),
        "claims.containerId": cid,
        status: "active",
      }).lean()) ||
      (await mintQR({
        createdBy: userId,
        scope: "container",
        subjectType: "FarmerOrderContainer",
        subjectId: String(order._id),
        claims,
        ttlSeconds,
      })).toObject();

    containerQrs[cid] = qr.token;
  }

  return { order, orderQR, containerQrs };
}

/* -----------------------------
   Delivery creation + stages
------------------------------*/
function buildDefaultDeliveryStages() {
  return [
    { key: "route_planned", label: "Route Planned", status: "done", startedAt: new Date(), completedAt: new Date(), timestamp: new Date(), note: "" },
    { key: "pickup_in_progress", label: "Pickup In Progress", status: "pending", timestamp: new Date(), note: "" },
    { key: "pickup_completed", label: "Pickup Completed", status: "pending", timestamp: new Date(), note: "" },
  ];
}

async function createDeliveryRun(args: {
  delivererId: Types.ObjectId;
  date: string; // "YYYY-MM-DD"
  shift: "morning" | "afternoon" | "evening" | "night";
  logisticsCenterId: string | Types.ObjectId;
  pickupStops: Array<{
    label: string;
    address: { address: string; alt: number; lnt: number; note?: string };
    plannedAt: string; // ISO
  }>;
}) {
  const { delivererId, date, shift, logisticsCenterId, pickupStops } = args;

  const stops = (pickupStops || []).map((s) => ({
    type: "pickup",
    label: s.label || "",
    address: {
      address: s.address.address,
      alt: s.address.alt,
      lnt: s.address.lnt,
      note: s.address.note || "",
      logisticCenterId: null,
    },
    plannedAt: new Date(s.plannedAt),
    arrivedAt: null,
    departedAt: null,
    scans: [],
  }));

  const delivery = await FarmerDelivery.create({
    delivererId,
    date,
    shift,
    logisticCenterId: typeof logisticsCenterId === "string" ? logisticsCenterId : String(logisticsCenterId),
    stops,
    status: "planned",
    stages: buildDefaultDeliveryStages(),
    historyAuditTrail: [],
  });

  // Optionally mint a delivery QR (useful later at LC gate)
  const deliveryQR = await mintQR({
    createdBy: delivererId,
    scope: "farmer-delivery",
    subjectType: "FarmerDelivery",
    subjectId: String(delivery._id),
    claims: canonicalizeClaims({
      farmerDeliveryId: delivery._id,
      logisticsCenterId,
      shift,
      deliveryDate: new Date(date + "T00:00:00.000Z"),
    }),
    ttlSeconds: 60 * 60, // 1h
  });

  return { delivery: delivery.toObject(), deliveryQR: deliveryQR.toObject() };
}

/* -----------------------------
   Append scan to stop:
   - write StopScan
   - flip status planned→in_progress
   - append ScanEvent into QRModel.scans[]
   - progress stages
------------------------------*/
async function appendContainerScanToStop(args: {
  farmerDeliveryId: string;
  stopIndex: number;
  containerId: string;
  containerQrToken: string;
  farmerOrderId: string;
  weightKg?: number;
  userId: Types.ObjectId;
  geo?: { lat?: number; lng?: number; accuracyM?: number };
}) {
  const { farmerDeliveryId, stopIndex, containerId, containerQrToken, farmerOrderId, weightKg = 0, userId, geo } = args;

  if (!Types.ObjectId.isValid(farmerDeliveryId)) throw new ApiError(400, "Bad delivery id");
  if (!Types.ObjectId.isValid(farmerOrderId)) throw new ApiError(400, "Bad farmerOrderId");

  // 1) Resolve the QR we are scanning (by token)
  const qr = await QRModel.findOne({ token: containerQrToken }).lean();
  if (!qr) throw new ApiError(404, "QR not found");
  if (qr.scope !== "container") throw new ApiError(400, "Wrong QR scope");
  verifyQRSignature(qr);

  // Ensure claims match
  if (String(qr.claims?.farmerOrderId) !== String(farmerOrderId)) {
    throw new ApiError(400, "QR farmerOrderId mismatch");
  }
  if (String(qr.claims?.containerId) !== String(containerId)) {
    throw new ApiError(400, "QR containerId mismatch");
  }

  // 2) Load delivery + stop
  const del = await FarmerDelivery.findById(farmerDeliveryId);
  if (!del) throw new ApiError(404, "Delivery not found");
  const stop = del.stops?.[stopIndex];
  if (!stop) throw new ApiError(404, "Stop not found");

  // 3) Idempotent upsert inside stop.scans (same containerId)
  const now = new Date();
  const qrUrl = `${process.env.PUBLIC_API_BASE_URL || "http://localhost:5173"}/api/v1/scan/${encodeURIComponent(containerQrToken)}`;

  const idx = (stop.scans || []).findIndex((s: any) => s.containerId === containerId);
  if (idx >= 0) {
    stop.scans[idx].weightKg = Number(weightKg) || 0;
    stop.scans[idx].timestamp = now;
    stop.scans[idx].qrUrl = qrUrl;
  } else {
    stop.scans.push({
      containerId,
      farmerOrderId: new Types.ObjectId(farmerOrderId),
      qrUrl,
      weightKg: Number(weightKg) || 0,
      timestamp: now,
      note: "",
    } as any);
  }

  // 4) Flip status & stages if first scan
  if (del.status === "planned") {
    del.status = "in_progress";
    // start 'pickup_in_progress' stage if present
    const s = (del.stages || []).find((x: any) => x.key === "pickup_in_progress");
    if (s && s.status === "pending") {
      s.status = "current";
      s.startedAt = now;
      s.timestamp = now;
    }
  }

  await del.save();

  // 5) Append ScanEvent into QRModel.scans[]
  await QRModel.updateOne(
    { _id: qr._id },
    {
      $push: {
        scans: {
          userId,
          role: "industrialDeliverer",
          action: "SCAN_OK",
          note: `pickup stop ${stopIndex}`,
          meta: { farmerDeliveryId, stopIndex, weightKg },
          timestamp: now,
          geo: {
            lat: geo?.lat ?? null,
            lng: geo?.lng ?? null,
            accuracyM: geo?.accuracyM ?? null,
          },
        },
      },
    }
  );

  return del.toObject();
}

/* -----------------------------
   (Optional) Generic scan API
   - If you call /scan/:token this also writes QRModel.scans[]
------------------------------*/
async function scanByToken(args: {
  token: string;
  user: any; // from req.user
  geo?: { lat?: number; lng?: number; accuracyM?: number };
}) {
  const { token, user, geo } = args;
  const qr = await QRModel.findOne({ token, status: "active" });
  if (!qr) throw new ApiError(404, "QR not found");
  verifyQRSignature(qr);

  // simple rate guard (optional): omitted here for brevity

  // register scan event
  const now = new Date();
  await QRModel.updateOne(
    { _id: qr._id },
    {
      $push: {
        scans: {
          userId: user?._id || null,
          role: user?.role || "unknown",
          action: "SCAN_OK",
          note: "generic /scan",
          meta: {},
          timestamp: now,
          geo: {
            lat: geo?.lat ?? null,
            lng: geo?.lng ?? null,
            accuracyM: geo?.accuracyM ?? null,
          },
        },
      },
    }
  );

  return { ok: true, scope: qr.scope, subjectType: qr.subjectType, subjectId: qr.subjectId, claims: qr.claims };
}

export const OpsService = {
  listMyOrders,
  ensureOrderPrintPayload,
  createDeliveryRun,
  appendContainerScanToStop,
  scanByToken,
};

export default OpsService;
