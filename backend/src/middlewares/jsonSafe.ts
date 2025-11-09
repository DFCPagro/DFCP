// src/middleware/jsonSafe.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

/**
 * Normalize BSON/Mongoose values to JSON-safe primitives:
 *  - ObjectId   -> 24-hex string
 *  - Date       -> ISO string
 *  - Decimal128 -> number
 *  - Buffer     -> base64 string
 *  - Set/Map    -> array / plain object
 *  - Mongoose docs/arrays -> plain objects/arrays (no proxies)
 * Guards against circular references with WeakSet.
 */

function isDecimal128(v: any): v is Types.Decimal128 {
  return v && typeof v === "object" && v._bsontype === "Decimal128";
}

function isObjectId(v: any): v is Types.ObjectId {
  return (
    v instanceof Types.ObjectId ||
    (v && typeof v === "object" && v._bsontype === "ObjectID")
  );
}

function isBuffer(v: any): v is Buffer {
  return v != null && typeof v === "object" && typeof (v as any).byteLength === "number" && typeof (v as any).copy === "function";
}

/** Heuristic: detect Mongoose-ish arrays without importing mongoose types */
function isMongooseArray(v: any): boolean {
  // Mongoose arrays often have internal markers like 'isMongooseArray' or '$populated'
  return Array.isArray(v) && (v as any).isMongooseArray !== undefined;
}

/** Prefer to treat "plain" objects as those with Object prototype or null */
function isPlainObject(v: any): v is Record<string, any> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Safely copy an array-like value to a real JS array without invoking .map on proxies */
function toPlainArray(v: any): any[] {
  // Array.from avoids the MongooseArray .map proxy path
  try {
    return Array.from(v as any);
  } catch {
    // Fallback to index copy
    const out: any[] = [];
    const len = (v && typeof v.length === "number") ? v.length : 0;
    for (let i = 0; i < len; i++) out.push(v[i]);
    return out;
  }
}

/** Safely copy an object's own enumerable keys without triggering getters too eagerly */
function entriesOf(obj: any): [string, any][] {
  const keys = Object.keys(obj);
  const out: [string, any][] = [];
  for (const k of keys) {
    // Guard each property access in case a getter throws or is recursive
    try {
      out.push([k, (obj as any)[k]]);
    } catch {
      // Skip problematic getters
    }
  }
  return out;
}

function normalizeBson<T = any>(input: T, seen = new WeakSet()): T {
  // Primitives / null / undefined
  if (input == null || typeof input !== "object") return input;

  if (seen.has(input as any)) {
    // Drop circular refs; alternatively return "[Circular]" if you prefer
    return undefined as any;
  }
  seen.add(input as any);

  // Date
  if (input instanceof Date) {
    return input.toISOString() as any;
  }

  // Decimal128
  if (isDecimal128(input)) {
    return Number((input as any).toString()) as any;
  }

  // ObjectId
  if (isObjectId(input)) {
    return (input as any).toString() as any;
  }

  // Buffer
  if (isBuffer(input)) {
    return (input as any as Buffer).toString("base64") as any;
  }

  // Set
  if (input instanceof Set) {
    const arr = Array.from(input.values());
    return arr.map((v) => normalizeBson(v, seen)) as any;
  }

  // Map
  if (input instanceof Map) {
    const out: Record<string, any> = {};
    for (const [k, v] of input.entries()) {
      out[String(k)] = normalizeBson(v, seen);
    }
    return out as any;
  }

  // Arrays (including MongooseArray proxies)
  if (Array.isArray(input)) {
    const arr = isMongooseArray(input) ? toPlainArray(input) : (input as any[]);
    const out = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      out[i] = normalizeBson(arr[i], seen);
    }
    return out as any;
  }

  // Mongoose document or plain object
  // Avoid calling toObject()/toJSON() here to prevent custom getters from re-entering Mongoose.
  const src = input as Record<string, any>;

  // If it's not a plain object (e.g., Mongoose doc, class instance), we still copy enumerable own props
  const out: Record<string, any> = {};
  for (const [k, v] of entriesOf(src)) {
    out[k] = normalizeBson(v, seen);
  }
  return out as any;
}

/**
 * Express middleware: wraps res.json so responses are JSON-safe.
 * Use once globally: app.use(jsonSafe())
 */
export function jsonSafe() {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    // @ts-ignore override res.json
    res.json = (body: any) => originalJson(normalizeBson(body));
    next();
  };
}
