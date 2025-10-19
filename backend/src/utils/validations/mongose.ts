import mongoose, { Types } from "mongoose";

// ---------- Primitive checks ----------

/** Non-empty string quick check (useful before deeper validation) */
export const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

/** Valid ObjectId string (non-empty + mongoose.isValidObjectId) */
export const isObjId = (v: unknown): v is string =>
  isNonEmptyString(v) && mongoose.isValidObjectId(v);

/** Allow string | Types.ObjectId and ensure it's a valid ObjectId value */
export const isObjIdLike = (v: unknown): v is string | Types.ObjectId =>
  (typeof v === "string" && mongoose.isValidObjectId(v)) || v instanceof Types.ObjectId;

// ---------- Parsers / Normalizers ----------

/** Parse to Types.ObjectId or return null (never throws) */
export const parseObjectId = (v: unknown): Types.ObjectId | null => {
  if (v instanceof Types.ObjectId) return v;
  if (typeof v === "string" && mongoose.isValidObjectId(v)) return new Types.ObjectId(v);
  return null;
};

/** Normalize to string _id or null */
export const toIdString = (v: unknown): string | null => {
  if (v instanceof Types.ObjectId) return v.toHexString();
  if (typeof v === "string" && mongoose.isValidObjectId(v)) return v;
  return null;
};

// ---------- Asserts (throw on invalid) ----------

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Throw if not a valid ObjectId string */
export const assertObjectIdString: (v: unknown, label?: string) => asserts v is string = (
  v,
  label = "id"
) => {
  if (!isObjId(v)) {
    throw new ValidationError(`Invalid ${label}`);
  }
};


/** Throw if not string|ObjectId convertible to ObjectId */
export const assertObjectIdLike = (v: unknown, label = "id"): asserts v is string | Types.ObjectId => {
  if (!isObjIdLike(v)) throw new ValidationError(`Invalid ${label}`);
};

/** Convert or throw (handy inside services) */
export const toObjectIdOrThrow = (v: unknown, label = "id"): Types.ObjectId => {
  const parsed = parseObjectId(v);
  if (!parsed) throw new ValidationError(`Invalid ${label}`);
  return parsed;
};

// ---------- Express helpers (optional) ----------

/**
 * Quick guard you can call in controllers before touching Mongoose.
 * Returns a clean 400 JSON if invalid.
 */
export const ensureValidIdParam =
  (paramName: string) =>
  (req: any, res: any, next: any) => {
    try {
      assertObjectIdString(req.params?.[paramName], paramName);
      next();
    } catch (e: any) {
      res.status(400).json({ ok: false, message: e?.message ?? "Invalid id" });
    }
  };

/** Example body guard: ensure req.body[field] is a valid ObjectId string */
export const ensureValidIdBody =
  (field: string) =>
  (req: any, res: any, next: any) => {
    try {
      assertObjectIdString(req.body?.[field], field);
      next();
    } catch (e: any) {
      res.status(400).json({ ok: false, message: e?.message ?? `Invalid ${field}` });
    }
  };
