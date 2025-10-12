// models/QRModel.model.ts
//
// A flexible QR token model to support a variety of logistics workflows.
// This model supersedes the limited QrToken implementation by introducing
// stronger typing for scopes, signature management, expiry handling and
// subject metadata.  It is intentionally designed as a top-level
// entity instead of a subdocument so that it can be queried and
// indexed efficiently on claims and lifecycle fields.  Each instance
// represents a single token that may be scanned multiple times (per
// `usagePolicy`) and maintains its own audit trail of `ScanEvent` records.

import {
  Schema,
  model,
  Types,
  InferSchemaType,
  HydratedDocument,
  Model,
} from "mongoose";
import toJSON from "../utils/toJSON";
import { AuditEntrySchema } from "./shared/audit.schema";

/**
 * Enumeration of all supported QR scopes.  Each scope
 * identifies a discrete action or domain within the logistics
 * process.  Use these values to control which state transitions
 * are permitted when a QR token is scanned.  See the README for
 * the full lifecycle and allowed transitions per scope.
 */
export const QR_SCOPES = [
  // Pre‑existing scopes
  "farmer-order",
  "farmer-delivery",
  "container",
  "order-package",
  // New scopes for logistics centre operations
  "container-intake",      // scanning of containers at LC intake
  "container-cleaning",    // cleaning station scanning
  "container-weighing",    // weighing station scanning
  "container-sorting",     // sorting station scanning
  "container-shelving",    // moving container onto shelf/warehouse
  "pick-task",             // pick instructions / picking progress
  "package-handoff",       // handing off packages to industrial deliverer
  "inventory-audit",       // ad‑hoc stock audits
] as const;
export type QrScope = (typeof QR_SCOPES)[number];

/**
 * Status of a QR token.  Once voided or consumed the token
 * should not accept new scans.  A token automatically
 * transitions to `expired` when `expiresAt` is in the past.
 */
export const QR_STATUSES = ["active", "void", "consumed", "expired"] as const;
export type QrStatus = (typeof QR_STATUSES)[number];

/**
 * Usage policies determine how many times a token may be used.
 * - single-use: the token is consumed on the first successful scan.
 * - multi-use: the token may be scanned repeatedly until it expires or is
 *   explicitly voided.  Rate‑limiting still applies via `maxScansPerHour`.
 */
export const QR_USAGE_POLICIES = ["single-use", "multi-use"] as const;
export type QrUsagePolicy = (typeof QR_USAGE_POLICIES)[number];

/**
 * Subdocument capturing the details of each scan.  This embeds
 * fields from `AuditEntrySchema` (userId, action, note, meta,
 * timestamp) and extends it with the actor's role and optional
 * geospatial metadata.  The `_id` is suppressed on this
 * subdocument because scan entries never need to be referenced
 * outside of the parent token.
 */
const ScanEventSchema = new Schema(
  {
    // Reuse the core audit fields (userId, action, note, meta, timestamp)
    ...((AuditEntrySchema as any).obj || {}),
    /**
     * Role of the actor who performed the scan (e.g., farmer,
     * sorter, picker, deliverer, opManager).  Roles are free
     * strings so that new roles may be introduced without
     * requiring schema migrations.  Controllers should normalise
     * these values to a finite set of allowed roles.
     */
    role: { type: String, required: true },
    /**
     * Optionally record the location of the scan.  Many devices
     * provide GPS information which can be used to audit routes or
     * detect unusual behaviour.  Accuracy is stored in metres.
     */
    geo: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracyM: { type: Number, default: null },
    },
  },
  { _id: false }
);

// Normalise aliases pre‑validate.  Some legacy callers pass
// `whoUserId` instead of `userId` to maintain compatibility with
// older audit models.  If `userId` is absent the alias is used.
ScanEventSchema.pre("validate", function (next) {
  // @ts-ignore – dynamic this
  if (!this.userId && this.whoUserId) {
    // @ts-ignore
    this.userId = this.whoUserId;
  }
  // Ensure a timestamp exists
  // @ts-ignore
  if (!this.timestamp) this.timestamp = new Date();
  next();
});

/**
 * Flexible claims bag.  Tokens may carry claims for a variety of
 * entity identifiers.  For example a container QR will set
 * `containerId` and optionally link back to its farmerOrder.  A
 * package QR will set `packageId` and `orderId`.  Additional
 * claims can be added without schema migrations because the
 * subdocument is not strict.
 */
const ClaimsSchema = new Schema(
  {
    farmerOrderId: { type: Types.ObjectId, ref: "FarmerOrder", default: null },
    farmerDeliveryId: { type: Types.ObjectId, ref: "FarmerDelivery", default: null },
    containerId: { type: String, default: null },
    containerOpsId: { type: Types.ObjectId, ref: "ContainerOps", default: null },
    orderId: { type: Types.ObjectId, ref: "Order", default: null },
    packageId: { type: Types.ObjectId, default: null },
    logisticsCenterId: { type: Types.ObjectId, ref: "LogisticsCenter", default: null },
    shelfId: { type: Types.ObjectId, ref: "Shelf", default: null },
    pickTaskId: { type: Types.ObjectId, ref: "PickTask", default: null },
    shift: { type: String, default: null },
    deliveryDate: { type: Date, default: null },
  },
  { _id: false, strict: false }
);

/**
 * Main QR token schema.  A token encapsulates a random identifier
 * (`token`), a signature (`sig`) computed by the backend, a
 * specific `scope` and arbitrary `claims` to support routing and
 * authorisation decisions.  Tokens may expire (`expiresAt`),
 * become active only after a certain time (`notBefore`) and may
 * restrict the number of scans via `maxScansPerHour` and
 * `maxUses`.  Every scan is appended to the `scans` array in
 * chronological order.
 */
const QrSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    sig: { type: String, required: true },
    scope: { type: String, enum: QR_SCOPES, required: true, index: true },
    subjectType: { type: String, required: true },
    subjectId: { type: String, required: true },
    claims: { type: ClaimsSchema, default: {} },
    status: { type: String, enum: QR_STATUSES, default: "active", index: true },
    usagePolicy: { type: String, enum: QR_USAGE_POLICIES, default: "multi-use" },
    maxUses: { type: Number, default: null },
    maxScansPerHour: { type: Number, default: 240 },
    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    issuer: { type: Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, default: Date.now },
    notBefore: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    scans: { type: [ScanEventSchema], default: [] },
  },
  { timestamps: true }
);

// Indexes to support efficient lookups by claim
QrSchema.index({ "claims.containerId": 1, scope: 1 });
QrSchema.index({ "claims.orderId": 1, scope: 1 });
QrSchema.index({ "claims.packageId": 1, scope: 1 });
QrSchema.index({ "claims.farmerOrderId": 1, scope: 1 });
QrSchema.index({ "claims.pickTaskId": 1, scope: 1 });

// Expire tokens automatically in MongoDB once expiredAt is in the past
// (null values are ignored).  The TTL index will run in the
// background and remove expired documents.  Note that TTL granularity
// is approximate (up to 1 minute).
QrSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Attach the toJSON plugin so that document instances serialize
// friendly fields (e.g., converting _id to id and removing __v).
QrSchema.plugin(toJSON as any);

// Types generated from the schema
export type QRModel = InferSchemaType<typeof QrSchema>;
export type QRModelDoc = HydratedDocument<QRModel>;
export type QRModelModel = Model<QRModel>;

// Export the model
export const QRModel = model<QRModel, QRModelModel>("QRModel", QrSchema);
export default QRModel;