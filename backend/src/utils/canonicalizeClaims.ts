// src/utils/canonicalizeClaims.ts
export function canonicalizeClaims(input: Record<string, any> = {}) {
  // 1) shallow-clone and coerce ObjectIds / Dates to strings
  const norm: Record<string, any> = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (v == null) {
      norm[k] = null;
    } else if (typeof v === "object" && v !== null) {
      // stringify ObjectId-like
      if (typeof (v as any).toHexString === "function") {
        norm[k] = (v as any).toHexString();
      } else if (v instanceof Date) {
        norm[k] = new Date(v).toISOString();
      } else {
        norm[k] = v; // keep as-is (we only shallow canon)
      }
    } else {
      norm[k] = v;
    }
  }
  // 2) stable-key sort for HMAC determinism
  const sortedKeys = Object.keys(norm).sort();
  const out: Record<string, any> = {};
  for (const k of sortedKeys) out[k] = norm[k];
  return out;
}
