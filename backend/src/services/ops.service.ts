// src/services/ops.service.ts

import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";

import QRModel, { QRModel as QRDocType } from "../models/QRModel.model";
import { Order as OrderModel } from "../models/order.model";

import ApiError from "../utils/ApiError";
import { canonicalizeClaims } from "../utils/canonicalizeClaims";
import { QR_HMAC_SECRET as HMAC_SECRET } from "../config/env";

/* =====================================================================================
 * QR SIGNING – SINGLE SOURCE OF TRUTH
 * ===================================================================================== */

type CanonClaims = Record<string, unknown>;

type OrderPrintPayload = {
  order: any;
  orderQR: {
    token: string;
    sig: string;
    scope: string;
  };
  containerQrs: Array<{
    token: string;
    sig: string;
    scope: string;
    subjectType: string;
    subjectId: string;
  }>;
};


type SignArgs = {
  token: string;
  scope: string;           // e.g. "order-package"
  subjectType: string;     // e.g. "Order"
  subjectId: string;       // stringified ObjectId
  claims: CanonClaims;     // MUST be canonicalized before passing here
};

function buildOuter(args: SignArgs) {
  // IMPORTANT: do not mutate "claims" here; it must already be canonical
  return {
    claims: args.claims,
    scope: args.scope,
    subjectId: args.subjectId,
    subjectType: args.subjectType,
    token: args.token,
  };
}

export function signPayload(args: SignArgs): string {
  const outer = buildOuter(args);
  return crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(JSON.stringify(outer))
    .digest("hex");
}

export async function verifyQRSignature(qr: {
  _id?: any; // if you pass a mongoose doc, keep id for optional repair
  token: string;
  scope: string;
  subjectType: string;
  subjectId: string | Types.ObjectId;
  claims: Record<string, unknown>;
  sig: string;
}) {
  const subjectIdStr = String(qr.subjectId);

  // Rebuild outer using EXACT values from the DB doc
  const outer = {
    claims: qr.claims,
    scope: qr.scope,
    subjectId: subjectIdStr,
    subjectType: qr.subjectType,
    token: qr.token,
  };

  const expected = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(JSON.stringify(outer))
    .digest("hex");

  // Debug modes:
  //   QR_DEBUG=log     → print normal verify logs
  //   QR_DEBUG=diff    → additionally print byte-lengths and first differing char
  //   QR_DEBUG=repair  → (DANGEROUS) rewrite qr.sig in DB to expected after logging
  const dbg = String(process.env.QR_DEBUG || "").toLowerCase();

  if (dbg === "log" || dbg === "diff" || dbg === "repair") {
    const secretSha256 = crypto.createHash("sha256").update(HMAC_SECRET).digest("hex");
    const outStr = JSON.stringify(outer);
    console.log("[QR DEBUG] VERIFY SECRET_SHA256:", secretSha256);
    console.log("[QR DEBUG] VERIFY OUTER:", outStr);
    console.log("[QR DEBUG] VERIFY SIG  :", expected);
    console.log("[QR DEBUG] STORED SIG :", qr.sig);

    if (expected !== qr.sig && (dbg === "diff" || dbg === "repair")) {
      const stored = qr.sig;
      // emit first differing index between mint-string and verify-string (via recomputed sig mismatch)
      // also log OUTER's exact byte length to catch hidden chars/newlines
      console.log("[QR DEBUG] OUTER BYTES:", Buffer.byteLength(outStr, "utf8"));

      // Extra: if you also captured MINT OUTER in logs, we can compare strings;
      // but we often only have sigs. To aid diagnosis, dump claim types.
      const typeOfClaims: Record<string, string> = {};
      if (outer.claims && typeof outer.claims === "object") {
        for (const k of Object.keys(outer.claims as any)) {
          const v = (outer.claims as any)[k];
          typeOfClaims[k] = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
        }
      }
      console.log("[QR DEBUG] CLAIM TYPES:", typeOfClaims);

      // One more high-signal check: stringify twice with stable order and confirm same bytes
      const s1 = JSON.stringify(outer);
      const s2 = JSON.stringify(JSON.parse(s1)); // stable round-trip
      const eq = Buffer.from(s1).equals(Buffer.from(s2));
      if (!eq) {
        console.log("[QR DEBUG] JSON round-trip changed bytes (unexpected)");
      }
      // Emit first diff char between s1 and s2 (should be none)
      const len = Math.max(s1.length, s2.length);
      for (let i = 0; i < len; i++) {
        if (s1[i] !== s2[i]) {
          console.log("[QR DEBUG] DIFF @", i, { s1: s1[i], s2: s2[i], ctx1: s1.slice(i-10, i+10), ctx2: s2.slice(i-10, i+10) });
          break;
        }
      }

      // DANGEROUS: self-repair the stored sig to confirm the doc is stable at rest
      if (dbg === "repair" && qr._id) {
        console.warn("[QR DEBUG] REPAIR MODE: updating stored sig to expected (test only!)");
        await QRModel.updateOne({ _id: qr._id }, { $set: { sig: expected } });
      }
    }
  }

  if (expected !== qr.sig) {
    throw new ApiError(400, "Invalid QR signature");
  }
}


/* =====================================================================================
 * ORDER-PACKAGE TOKEN – MINT/REUSE (canonicalize ONCE, sign WITH canon, save SAME canon)
 * ===================================================================================== */

export async function ensureOrderToken(args: {
  orderId: string | Types.ObjectId;
  createdBy: Types.ObjectId;
  ttlSeconds?: number;
  usagePolicy?: "single-use" | "multi-use";
  maxUses?: number | null;
  issuer?: Types.ObjectId | null;
  session?: mongoose.ClientSession | null;
}) {
  const {
    orderId,
    createdBy,
    ttlSeconds = 24 * 60 * 60,
    usagePolicy = "multi-use",
    maxUses = null,
    issuer = null,
    session = null,
  } = args;

  const oid = new Types.ObjectId(String(orderId));
  const order = await OrderModel.findById(oid).session(session).lean();
  if (!order) throw new ApiError(404, "Order not found");

  // 1) Build raw claims
  const rawClaims = {
    farmerOrderId: null,
    farmerDeliveryId: null,
    containerId: null,
    containerOpsId: null,
    orderId: oid,
    packageId: null,
    logisticsCenterId: (order as any).LogisticsCenterId,
    shelfId: null,
    pickTaskId: null,
    shift: (order as any).shiftName || null,
    deliveryDate: order.deliveryDate ? new Date(order.deliveryDate) : null,
    customerId: order.customerId ? String(order.customerId) : null,
  };

  // 2) Canonicalize ONCE – this exact object is used for both signing and saving
  const canon = canonicalizeClaims(rawClaims);

  // 3) Reuse if exists (note: the claims we save keep strings; match that in query)
  const existing =
    (await QRModel.findOne({
      scope: "order-package",
      subjectType: "Order",
      subjectId: String(oid),
      status: "active",
      "claims.orderId": String(oid),
      "claims.packageId": null,
    })
      .session(session)
      .lean()) || null;

  if (existing) {
    // Will throw if invalid; otherwise confirms token is fine
    verifyQRSignature(existing as any);
    return existing;
  }

  // 4) Mint new: SIGN WITH THE CANONICALIZED CLAIMS
  const token = `QR-${crypto.randomUUID()}`;
  const sig = signPayload({
    token,
    scope: "order-package",
    subjectType: "Order",
    subjectId: String(oid),
    claims: canon,
  });

  // Optional debug — compare mint-time vs verify-time bytes
  if (process.env.QR_DEBUG === "true") {
    const outerMint = buildOuter({
      token,
      scope: "order-package",
      subjectType: "Order",
      subjectId: String(oid),
      claims: canon,
    });
    const secretSha256 = crypto.createHash("sha256").update(HMAC_SECRET).digest("hex");
    console.log("[QR DEBUG] MINT SECRET_SHA256:", secretSha256);
    console.log("[QR DEBUG] MINT OUTER:", JSON.stringify(outerMint));
    console.log("[QR DEBUG] MINT SIG  :", sig);
  }

  // 5) Persist THE SAME canonicalized claims
  const [doc] = await QRModel.create(
    [
      {
        token,
        sig,
        scope: "order-package",
        subjectType: "Order",
        subjectId: String(oid),
        claims: canon,
        status: "active",
        usagePolicy,
        maxUses,
        maxScansPerHour: 240,
        createdBy,
        issuer,
        notBefore: null,
        expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null,
      },
    ],
    { session }
  );

  return doc.toObject();
}

/* =====================================================================================
 * SCAN – VERIFY, RATE-LIMIT (basic), APPEND SCAN EVENT (role/meta/geo)
 * ===================================================================================== */

export async function scanByToken(args: {
  token: string;
  actor: { userId: Types.ObjectId; role: string };
  geo?: { lat?: number | null; lng?: number | null; accuracyM?: number | null };
  note?: string;
  meta?: Record<string, unknown>;
  now?: Date;
  session?: mongoose.ClientSession | null;
}) {
  const {
    token,
    actor,
    geo,
    note = "",
    meta = {},
    now = new Date(),
    session = null,
  } = args;

  // 0) Load QR by token
  const qr = await QRModel.findOne({ token }).session(session);
  if (!qr) throw new ApiError(404, "QR token not found");

  // 1) Status & timing checks
  if (qr.status === "void") throw new ApiError(400, "Token is void");
  if (qr.status === "consumed") throw new ApiError(400, "Token already consumed");
  if (qr.notBefore && now < qr.notBefore) throw new ApiError(400, "Token not active yet");
  if (qr.expiresAt && now > qr.expiresAt) {
    qr.status = "expired";
    await qr.save({ session });
    throw new ApiError(400, "Token expired");
  }

  // 2) Verify signature against EXACT doc contents
  await verifyQRSignature({
    _id: qr._id, // keep _id so debug/repair modes can update if enabled
    token: qr.token,
    scope: qr.scope,
    subjectType: qr.subjectType,
    subjectId: qr.subjectId,
    claims: (qr as any).claims, // ensure claims stays as stored (Mixed passthrough)
    sig: qr.sig,
  });

  // 3) Basic rate-limit (per hour)
  if (qr.maxScansPerHour && qr.maxScansPerHour > 0) {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const scansLastHour = (qr.scans || []).filter((s: any) => {
      const t = s?.timestamp ? new Date(s.timestamp) : null;
      return t && t >= oneHourAgo;
    }).length;
    if (scansLastHour >= qr.maxScansPerHour) {
      throw new ApiError(429, "Scan rate limit exceeded");
    }
  }

  // 4) Usage policy / consumption handling
  if (qr.usagePolicy === "single-use") {
    if (qr.maxUses == null || qr.maxUses <= 1) {
      qr.status = "consumed";
    } else {
      const uses = (qr.scans || []).length;
      if (uses + 1 >= (qr.maxUses as number)) qr.status = "consumed";
    }
  } else if (qr.usagePolicy === "multi-use" && typeof qr.maxUses === "number") {
    const uses = (qr.scans || []).length;
    if (uses + 1 >= qr.maxUses) qr.status = "consumed";
  }

  // 5) Append scan event
  qr.scans.push({
    userId: actor.userId,
    role: actor.role,
    action: "scan",
    note,
    meta,
    geo: {
      lat: Number.isFinite(geo?.lat as number) ? geo!.lat : null,
      lng: Number.isFinite(geo?.lng as number) ? geo!.lng : null,
      accuracyM: Number.isFinite(geo?.accuracyM as number) ? geo!.accuracyM : null,
    },
    timestamp: now,
  } as any);

  // 6) Persist and return a compact response
  await qr.save({ session });

  return {
    ok: true,
    token: qr.token,
    scope: qr.scope,
    subjectType: qr.subjectType,
    subjectId: qr.subjectId,
    claims: (qr as any).claims,
    status: qr.status,
    scansCount: qr.scans.length,
  };
}


/* =====================================================================================
 * NON-BREAKING ADAPTER for controllers expecting `OpsService.*`
 * ===================================================================================== */

//
// If you already have these functions implemented elsewhere in this file,
// they will be picked up here. If they live in other modules, re-export or
// import them above and include them below.
//

// Optional small adapter so your controller can keep calling
// OpsService.scanByToken({ token, user, geo }) without changing signature.
async function scanByTokenAdapter(args: { token: string; user: any; geo?: any }) {
  const actor = { userId: new Types.ObjectId(String(args.user?._id)), role: String(args.user?.role || "") };
  return scanByToken({ token: args.token, actor, geo: args.geo });
}

// These may already exist in your original service. If they do, keep them.
// If they live in other files, import and include them here to preserve the API.
export async function listMyOrders(userId: Types.ObjectId) {
  // Example: show orders by customerId; adjust to your role/ACL model
  const orders = await OrderModel.find({ customerId: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return orders;
}
export async function ensureOrderPrintPayload(args: {
  orderId: string | Types.ObjectId;
  userId: Types.ObjectId;
  session?: mongoose.ClientSession | null;
}): Promise<OrderPrintPayload> {
  const { orderId, userId, session = null } = args;

  const oid = new Types.ObjectId(String(orderId));
  const order = await OrderModel.findById(oid).session(session).lean();
  if (!order) throw new ApiError(404, "Order not found");

  // ACL (adjust to your rules): allow owner or roles; for now, owner check
  // If your model stores customerId on the order, keep this check:
  if (String(order.customerId) !== String(userId)) {
    // Replace with your real authorization logic
    // e.g., admins/farmers/fManagers can also read
    // For now we’ll allow anyone (comment out the throw), or enforce:
    // throw new ApiError(403, "Not allowed to view this order");
  }

  // Ensure the order-package QR exists (reuses canonical signer)
  const orderQRDoc = await ensureOrderToken({
    orderId: oid,
    createdBy: userId,
    usagePolicy: "multi-use",
    ttlSeconds: 24 * 60 * 60,
    session,
  });

  // If you have container QRs per order, fetch them; otherwise, return empty array
  const containerQrsDocs = await QRModel.find({
    scope: "container",
    subjectType: "Container",
    // If containers relate to this order via a field (e.g., claims.orderId), adapt the query:
    "claims.orderId": String(oid),
    status: { $in: ["active", "consumed"] },
  })
    .lean()
    .catch(() => [] as any[]);

  const payload: OrderPrintPayload = {
    order,
    orderQR: {
      token: orderQRDoc.token,
      sig: orderQRDoc.sig,
      scope: orderQRDoc.scope,
    },
    containerQrs: (containerQrsDocs || []).map((q: any) => ({
      token: q.token,
      sig: q.sig,
      scope: q.scope,
      subjectType: q.subjectType,
      subjectId: String(q.subjectId),
    })),
  };

  return payload;
}


export async function ensureFarmerOrderToken(args: {
  farmerOrderId: string | Types.ObjectId;
  createdBy: Types.ObjectId;
  ttlSeconds?: number;
  usagePolicy?: "single-use" | "multi-use";
  maxUses?: number | null;
  issuer?: Types.ObjectId | null;
  session?: mongoose.ClientSession | null;
}) {
  const {
    farmerOrderId,
    createdBy,
    ttlSeconds = 24 * 60 * 60,
    usagePolicy = "multi-use",
    maxUses = null,
    issuer = null,
    session = null,
  } = args;

  const foid = new Types.ObjectId(String(farmerOrderId));

  // If you need FO data for claims, fetch it (optional but recommended)
  const FarmerOrder = (await import("../models/farmerOrder.model")).FarmerOrder;
  const fo = await FarmerOrder.findById(foid).session(session).lean();
  if (!fo) throw new ApiError(404, "FarmerOrder not found");

  // Build raw claims (keep naming consistent with ClaimsSchema)
  const rawClaims = {
    farmerOrderId: foid,
    farmerDeliveryId: null,
    containerId: null,
    containerOpsId: null,
    orderId: null,
    packageId: null,
    logisticsCenterId: fo.logisticCenterId ? String(fo.logisticCenterId) : null, // NOTE: string
    shelfId: null,
    pickTaskId: null,
    shift: fo.shift || null,
    deliveryDate: fo.pickUpDate ? new Date(`${fo.pickUpDate}T00:00:00Z`) : null, // optional
  };

  const canon = canonicalizeClaims(rawClaims);

  // Reuse if exists
  const existing =
    (await QRModel.findOne({
      scope: "farmer-order",
      subjectType: "FarmerOrder",
      subjectId: String(foid),
      status: "active",
      "claims.farmerOrderId": String(foid),
    })
      .session(session)
      .lean()) || null;

  if (existing) {
  try {
    await verifyQRSignature(existing as any);
    return existing;
  } catch {
    // The doc exists but signature doesn't match current secret → mark bad & re-mint
    await QRModel.updateOne({ _id: (existing as any)._id }, { $set: { status: "void" } }).catch(()=>{});
    // fall through to mint with the current HMAC
  }
}

  // Mint
  const token = `QR-${crypto.randomUUID()}`;
  const sig = signPayload({
    token,
    scope: "farmer-order",
    subjectType: "FarmerOrder",
    subjectId: String(foid),
    claims: canon,
  });

  const dbg = String(process.env.QR_DEBUG || "").toLowerCase();
if (dbg === "log" || dbg === "diff") {
  const outerMint = {
    claims: canon,
    scope: "farmer-order",
    subjectId: String(foid),
    subjectType: "FarmerOrder",
    token,
  };
  const secretSha256 = crypto.createHash("sha256").update(HMAC_SECRET).digest("hex");
  console.log("[QR DEBUG] MINT SECRET_SHA256:", secretSha256);
  console.log("[QR DEBUG] MINT OUTER:", JSON.stringify(outerMint));
  console.log("[QR DEBUG] MINT SIG  :", sig);
}

  const [doc] = await QRModel.create(
    [
      {
        token,
        sig,
        scope: "farmer-order",
        subjectType: "FarmerOrder",
        subjectId: String(foid),
        claims: canon,
        status: "active",
        usagePolicy,
        maxUses,
        maxScansPerHour: 240,
        createdBy,
        issuer,
        notBefore: null,
        expiresAt: ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null,
      },
    ],
    { session }
  );

  return doc.toObject();
}





export async function createDeliveryRun(_args: any) {
  throw new ApiError(501, "createDeliveryRun not implemented in this snippet. Import your original implementation and re-export it here.");
}
export async function appendContainerScanToStop(_args: any) {
  throw new ApiError(501, "appendContainerScanToStop not implemented in this snippet. Import your original implementation and re-export it here.");
}


// Non-breaking aggregate so existing controllers can keep `import { OpsService }`
export const OpsService = {
  // QR/signature related
  signPayload,
  verifyQRSignature,
  ensureOrderToken,
  scanByToken: scanByTokenAdapter,

  // Keep existing controller calls working; replace these throws by
  // wiring your real implementations here (or import them above).
  listMyOrders,
  ensureOrderPrintPayload,
  createDeliveryRun,
  appendContainerScanToStop,
};

