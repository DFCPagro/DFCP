// src/utils/audit.utils.ts
import { getContactInfoByIdService } from "../services/user.service";
// ^ adjust path to match your project
import type { Types } from "mongoose";
// src/utils/audit.utils.ts

// raw from Mongo
type RawAuditEntry = {
  timestamp: Date;
  userId: Types.ObjectId | string;
  action: string;
  note?: string;
  meta?: Record<string, any>;
};

// what frontend expects
export type AuditEvent = {
  action: string;
  note?: string;
  by:
    | string
    | {
        id: string;      // <-- we will ALWAYS provide this now
        name?: string;
        role?: string;
      };
  at: Date | string;
  meta?: Record<string, any>;
};

export async function normalizeAndEnrichAuditEntries(
  auditTrail: RawAuditEntry[]
): Promise<AuditEvent[]> {
  if (!Array.isArray(auditTrail) || auditTrail.length === 0) return [];

  // collect unique userIds (string form)
  const uniqueUserIds = Array.from(
    new Set(
      auditTrail
        .map((e) => (e.userId ? String(e.userId) : null))
        .filter(Boolean)
    )
  ) as string[];

  // build map<userId, { id, name, role }>
  const contactMap = new Map<
    string,
    { id: string; name?: string; role?: string }
  >();

  for (const uid of uniqueUserIds) {
    try {
      const info = await getContactInfoByIdService(uid);

      // info has: name, email, phone, role, maybe farmName/farmLogo
      contactMap.set(uid, {
        id: uid,          // ✅ we define id here using uid
        name: info.name,
        role: info.role,
      });
    } catch {
      // fallback if no user or service fails
      contactMap.set(uid, {
        id: uid,
      });
    }
  }

  // final normalized array
  return auditTrail.map((entry) => {
    const uidStr = entry.userId ? String(entry.userId) : "";
    const contact = uidStr ? contactMap.get(uidStr) : undefined;

    return {
      action: entry.action,
      note: entry.note || "",
      by: contact ?? "system",        // if no user, mark system
      at: entry.timestamp,
      meta: entry.meta || {},
    };
  });
}
