import { Schema, model, Types, InferSchemaType, HydratedDocument } from "mongoose";
import toJSON from "../utils/toJSON";
import { QR_SCOPES } from "@/utils/constants";
import { AuditEntrySchema } from "./shared/audit.schema";

/**
 * ScanEvent = AuditEntry + scan-specific fields
 * - Unifies field names with the rest of your system (userId, action, note, meta, timestamp)
 * - Adds role + geo
 * - Keeps backward-compat alias: whoUserId -> userId
 */
const ScanEventSchema = new Schema(
  {
    // --- Base audit fields (reuse the same structure) ---
    ...((AuditEntrySchema as any).obj || {}),

    // --- Scan-specific additions ---
    whoRole: { type: String, required: true }, // 'farmer', 'deliverer', 'picker', ...
    // action is already in AuditEntrySchema; if your AuditEntrySchema doesn't include it,
    // keep this line:
    // action: { type: String, required: true }, // e.g., "scan", "load", "deliver", "stage"

    
    // geo: {
    //   lat: { type: Number, default: null },
    //   lng: { type: Number, default: null },
    //   accuracyM: { type: Number, default: null },
    // },
  },
  { _id: false }
);

// Normalize aliases pre-validate: prefer userId, map whoUserId -> userId if needed
ScanEventSchema.pre("validate", function (next) {
  // @ts-ignore
  if (!this.userId && this.whoUserId) {
    // @ts-ignore
    this.userId = this.whoUserId;
  }
  // Ensure timestamp (AuditEntrySchema usually sets it; this is a safeguard)
  // @ts-ignore
  if (!this.timestamp) this.timestamp = new Date();
  next();
});

const QrTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true }, // ULID/UUID
    sig: { type: String, required: true },
    scope: { type: String, enum: QR_SCOPES, required: true, index: true },

    // Flexible claims bag (context for routing/logic)
    claims: {
      farmerOrderId: { type: Types.ObjectId, ref: "FarmerOrder", default: null },
      farmerDeliveryId: { type: Types.ObjectId, ref: "FarmerDelivery", default: null },
      containerId: { type: String, default: null },
      orderId: { type: Types.ObjectId, ref: "Order", default: null },
      packageId: { type: Types.ObjectId, default: null },
      logisticsCenterId: { type: Types.ObjectId, ref: "LogisticCenter", default: null },
      shift: { type: String, default: null },
      deliveryDate: { type: Date, default: null },
    },

    status: { type: String, enum: ["active", "void", "consumed", "expired"], default: "active", index: true },
    usagePolicy: { type: String, enum: ["single-use", "multi-use"], default: "multi-use" },
    maxScansPerHour: { type: Number, default: 240 },

    label: { title: String, subtitle: String, hints: [String] },

    createdBy: { type: Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },

    scans: { type: [ScanEventSchema], default: [] },

  },
  { timestamps: true }
);

// Helpful indexes
QrTokenSchema.index({ "scans.timestamp": -1 });
QrTokenSchema.index({ "claims.farmerOrderId": 1, scope: 1 });
QrTokenSchema.index({ "claims.orderId": 1, scope: 1 });
QrTokenSchema.index({ "claims.packageId": 1, scope: 1 });
QrTokenSchema.index({ "claims.containerId": 1, scope: 1 });

QrTokenSchema.plugin(toJSON as any);

export type QrToken = InferSchemaType<typeof QrTokenSchema>;
export default model<QrToken>("QrToken", QrTokenSchema);
