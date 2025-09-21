import mongoose from "mongoose";
import ApiError from "../utils/ApiError";
import { PackageSize } from "../models/PackageSize"; // adjust path if needed

const isObjectId = (v: string) => /^[a-f\d]{24}$/i.test(v);

export interface ListQuery {
  page?: number;
  limit?: number;
  sort?: string;    // e.g. "-createdAt" or "key"
  q?: string;       // search on name/key
}

export async function listPackageSizes(query: ListQuery = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const sort = query.sort || "key";

  const filter: Record<string, any> = {};
  if (query.q) {
    const rx = new RegExp(query.q, "i");
    filter.$or = [{ name: rx }, { key: rx }];
  }

  const [items, total] = await Promise.all([
    PackageSize.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    PackageSize.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export async function getPackageSizeByIdOrKey(idOrKey: string) {
  const doc = isObjectId(idOrKey)
    ? await PackageSize.findById(idOrKey)
    : await PackageSize.findOne({ key: idOrKey });

  if (!doc) throw new ApiError(404, "PackageSize not found");
  return doc;
}

export async function createPackageSize(payload: any) {
  // Mongoose validators (including usableLiters tolerance) will run
  const existing = await PackageSize.findOne({ key: payload.key });
  if (existing) throw new ApiError(409, `PackageSize with key "${payload.key}" already exists`);
  const doc = await PackageSize.create(payload);
  return doc;
}

export async function updatePackageSize(idOrKey: string, payload: any) {
  const filter = isObjectId(idOrKey) ? { _id: new mongoose.Types.ObjectId(idOrKey) } : { key: idOrKey };

  // Prevent key collision on updates
  if (payload?.key) {
    const conflict = await PackageSize.findOne({ key: payload.key, ...("_id" in filter ? { _id: { $ne: filter._id } } : {}) });
    if (conflict) throw new ApiError(409, `PackageSize with key "${payload.key}" already exists`);
  }

  const updated = await PackageSize.findOneAndUpdate(filter, payload, {
    new: true,
    runValidators: true,
    context: "query",
  });

  if (!updated) throw new ApiError(404, "PackageSize not found");
  return updated;
}

export async function deletePackageSize(idOrKey: string) {
  const filter = isObjectId(idOrKey) ? { _id: new mongoose.Types.ObjectId(idOrKey) } : { key: idOrKey };
  const res = await PackageSize.findOneAndDelete(filter);
  if (!res) throw new ApiError(404, "PackageSize not found");
}
