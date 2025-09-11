// models/shared/audit.schema.ts
import { Schema, Types } from "mongoose";

export const AuditEntrySchema = new Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g., "CREATE","UPDATE_STAGE","SCAN_QR","ASSIGN_DRIVER"
    note: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);
