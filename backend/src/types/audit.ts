import { Types } from "mongoose";

/**
 * Raw audit entry stored in MongoDB.
 * Matches the schema structure.
 */
export interface AuditEntry {
  timestamp: Date;
  userId: Types.ObjectId; // ref: User
  action: string;
  note?: string;
  meta?: Record<string, any>;
}

/**
 * When populated with user info via .populate('auditTrail.userId')
 */
export interface PopulatedAuditEntry extends Omit<AuditEntry, "userId"> {
  userId: {
    _id: Types.ObjectId;
    name?: string;
    role?: string;
  };
}
