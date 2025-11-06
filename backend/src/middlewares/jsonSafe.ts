// src/middleware/jsonSafe.ts
import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

/**
 * Normalize BSON/Mongoose values to JSON-safe primitives:
 *  - ObjectId   -> 24-hex string
 *  - Date       -> ISO string
 *  - Decimal128 -> number
 *  - Everything else passes through
 */
function isDecimal128(v: any): v is Types.Decimal128 {
  return v && typeof v === "object" && v._bsontype === "Decimal128";
}

function isObjectId(v: any): v is Types.ObjectId {
  // matches both Mongoose's and raw BSON's object IDs
  return (
    v instanceof Types.ObjectId ||
    (v && typeof v === "object" && v._bsontype === "ObjectID")
  );
}

function normalizeBson<T = any>(obj: T): T {
  if (obj == null) return obj;

  // Date
  if (obj instanceof Date) {
    return obj.toISOString() as any;
  }

  // Decimal128
  if (isDecimal128(obj)) {
    return Number((obj as any).toString()) as any;
  }

  // ObjectId
  if (isObjectId(obj)) {
    return (obj as any).toString() as any;
  }

  // Array
  if (Array.isArray(obj)) {
    return obj.map(normalizeBson) as any;
  }

  // Plain object (including lean() results)
  if (typeof obj === "object") {
    const out: any = {};
    for (const k of Object.keys(obj as any)) {
      out[k] = normalizeBson((obj as any)[k]);
    }
    return out as T;
  }

  // primitives (string/number/boolean) or anything else
  return obj;
}

/**
 * Express middleware that wraps res.json to always emit JSON-safe payloads.
 * Use once, globally: app.use(jsonSafe());
 */
export function jsonSafe() {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    // @ts-ignore override res.json
    res.json = (body: any) => originalJson(normalizeBson(body));
    next();
  };
}
