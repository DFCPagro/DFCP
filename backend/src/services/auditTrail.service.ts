// src/services/auditTrail.service.ts
import { Types } from "mongoose";
import {
  normalizeAndEnrichAuditEntries,
  type AuditEvent,
} from "../utils/audit.utils";

/* ------------------------------------------------
 * Types
 * ------------------------------------------------ */

export type AuditMeta = Record<string, any>;

export type RawAuditEntry = {
  timestamp: Date;
  userId: Types.ObjectId | string;
  action: string;
  note?: string;
  meta?: AuditMeta;
};

/**
 * We keep this VERY loose so it works with:
 *  - plain POJOs with `historyAuditTrail: RawAuditEntry[]`
 *  - Mongoose docs where `historyAuditTrail` is a DocumentArray<Subdocument>
 */
export type AuditTargetLike = {
  historyAuditTrail?: any; // <-- allow Mongoose DocumentArray or plain array
} & { [key: string]: any };

export type PushAuditArgs = {
  userId: Types.ObjectId | string | null | undefined;
  action: string;
  note?: string;
  meta?: AuditMeta;
  timestamp?: Date;
};

/**
 * Shared "system" user id used when we don't have a real user
 * but still want an audit entry.
 */
export const SYSTEM_USER_ID = new Types.ObjectId("000000000000000000000000");

/* ------------------------------------------------
 * Helpers
 * ------------------------------------------------ */

/**
 * Normalize any user id input into a valid ObjectId.
 * Falls back to SYSTEM_USER_ID if invalid or missing.
 */
export function resolveUserId(input: PushAuditArgs["userId"]): Types.ObjectId {
  if (!input) return SYSTEM_USER_ID;
  if (input instanceof Types.ObjectId) return input;

  const s = String(input);
  if (Types.ObjectId.isValid(s)) {
    return new Types.ObjectId(s);
  }

  return SYSTEM_USER_ID;
}

/* ------------------------------------------------
 * Write-side helper
 * ------------------------------------------------ */

/**
 * Append a single audit entry to a document's `historyAuditTrail`.
 *
 * Works with both:
 *  - Mongoose docs (DocumentArray)
 *  - Plain JS objects (normal array)
 *
 * Usage:
 *   pushHistoryAuditTrail(orderDoc, {
 *     userId: updatedBy,
 *     action: "FARMER_STATUS_UPDATE",
 *     note: "Farmer approved",
 *     meta: { newStatus: "ok" },
 *   });
 */
export function pushHistoryAuditTrail<T extends AuditTargetLike>(
  target: T,
  args: PushAuditArgs
): T {
  const { action, note, meta, timestamp, userId } = args;

  if (!action) {
    // silently ignore invalid calls
    return target;
  }

  const entry: RawAuditEntry = {
    timestamp: timestamp ?? new Date(),
    userId: resolveUserId(userId),
    action,
    note: note ?? "",
    meta: meta ?? {},
  };

  const trail: any = target.historyAuditTrail;

  // If it's already some kind of array-like (including Mongoose DocumentArray),
  // use its .push. Otherwise, initialize as a plain array.
  if (trail && typeof trail.push === "function") {
    trail.push(entry);
  } else {
    (target as any).historyAuditTrail = [entry];
  }

  return target;
}

/* ------------------------------------------------
 * Read-side helper (optional)
 * ------------------------------------------------ */

/**
 * Convenience to get normalized + enriched audit events
 * for any model that has `historyAuditTrail`.
 *
 * This is tolerant to:
 *  - undefined / missing trail
 *  - Mongoose DocumentArray of Subdocuments
 *  - plain RawAuditEntry[]
 */
export async function getNormalizedAuditForTarget(
  target: AuditTargetLike | null | undefined
): Promise<AuditEvent[]> {
  if (!target || !target.historyAuditTrail) return [];

  const trail: any = target.historyAuditTrail;

  // If it's a Mongoose DocumentArray or array of subdocs,
  // map to plain JS objects if needed.
  let rawArray: RawAuditEntry[];

  if (Array.isArray(trail)) {
    rawArray = trail as RawAuditEntry[];
  } else if (typeof trail.toObject === "function") {
    rawArray = (trail.toObject() as RawAuditEntry[]) ?? [];
  } else {
    // Best-effort fallback
    rawArray = (trail as RawAuditEntry[]) ?? [];
  }

  return normalizeAndEnrichAuditEntries(rawArray);
}
