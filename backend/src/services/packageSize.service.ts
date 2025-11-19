import mongoose from "mongoose";
import ApiError from "../utils/ApiError";
import { PackageSize, Container } from "../models/PackageSize"; // Container exported from same file

type PackageSizeLean = {
  _id: mongoose.Types.ObjectId;
  key: "Small" | "Medium" | "Large";
  vented: boolean;
};

type ContainerLean = {
  _id: mongoose.Types.ObjectId;
  key: string;
  vented: boolean;
};

const isObjectId = (v: string) => /^[a-f\d]{24}$/i.test(v);

export interface ListQuery {
  page?: number;
  limit?: number;
  sort?: string; // e.g. "-createdAt" or "key"
  q?: string; // search on name/key
}

/* -------------------------------------------------------------------------- */
/*                             PACKAGE SIZE SERVICE                           */
/* -------------------------------------------------------------------------- */

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
    PackageSize.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
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
  // Respect unique index on { key, vented }
  const existing = await PackageSize.findOne({
    key: payload.key,
    vented: payload.vented,
  });

  if (existing) {
    throw new ApiError(
      409,
      `PackageSize with key "${payload.key}" and vented "${payload.vented}" already exists`
    );
  }

  const doc = await PackageSize.create(payload);
  return doc;
}

export async function updatePackageSize(idOrKey: string, payload: any) {
  // 1) Resolve the current document first (by id or key)
  const baseFilter = isObjectId(idOrKey)
    ? { _id: new mongoose.Types.ObjectId(idOrKey) }
    : { key: idOrKey as PackageSizeLean["key"] };

  const current = await PackageSize.findOne(baseFilter)
    .select("_id key vented")
    .lean<PackageSizeLean | null>();

  if (!current) throw new ApiError(404, "PackageSize not found");

  // 2) Compute the target unique fields after update (unique index is on { key, vented })
  const nextKey: PackageSizeLean["key"] = (payload?.key ?? current.key) as PackageSizeLean["key"];
  const nextVented: boolean =
    typeof payload?.vented === "boolean" ? payload.vented : current.vented;

  // 3) Prevent collision with any OTHER document (exclude self by _id)
  const conflict = await PackageSize.findOne({
    key: nextKey,
    vented: nextVented,
    _id: { $ne: current._id },
  })
    .select("_id")
    .lean();

  if (conflict) {
    throw new ApiError(
      409,
      `PackageSize with key "${nextKey}" and vented "${nextVented}" already exists`
    );
  }

  // 4) Update by _id to avoid re-matching the same doc by key
  const updated = await PackageSize.findOneAndUpdate(
    { _id: current._id },
    payload,
    {
      new: true,
      runValidators: true,
      context: "query",
    }
  );

  if (!updated) throw new ApiError(404, "PackageSize not found");
  return updated;
}

export async function deletePackageSize(idOrKey: string) {
  const filter = isObjectId(idOrKey)
    ? { _id: new mongoose.Types.ObjectId(idOrKey) }
    : { key: idOrKey };

  const res = await PackageSize.findOneAndDelete(filter);
  if (!res) throw new ApiError(404, "PackageSize not found");
}

/* -------------------------------------------------------------------------- */
/*                               CONTAINER SERVICE                            */
/* -------------------------------------------------------------------------- */

export async function listContainers(query: ListQuery = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const sort = query.sort || "key";

  const filter: Record<string, any> = {};
  if (query.q) {
    const rx = new RegExp(query.q, "i");
    filter.$or = [{ name: rx }, { key: rx }];
  }

  const [items, total] = await Promise.all([
    Container.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Container.countDocuments(filter),
  ]);

  return { items, total, page, limit };
}

export async function getContainerByIdOrKey(idOrKey: string) {
  const doc = isObjectId(idOrKey)
    ? await Container.findById(idOrKey)
    : await Container.findOne({ key: idOrKey });

  if (!doc) throw new ApiError(404, "Container not found");
  return doc;
}

export async function createContainer(payload: any) {
  // Unique index on { key, vented } in ContainerSchema
  const existing = await Container.findOne({
    key: payload.key,
    vented: payload.vented,
  });

  if (existing) {
    throw new ApiError(
      409,
      `Container with key "${payload.key}" and vented "${payload.vented}" already exists`
    );
  }

  const doc = await Container.create(payload);
  return doc;
}

export async function updateContainer(idOrKey: string, payload: any) {
  // 1) Resolve the current document first (by id or key)
  const baseFilter = isObjectId(idOrKey)
    ? { _id: new mongoose.Types.ObjectId(idOrKey) }
    : { key: idOrKey }; // container key is generic string

  const current = await Container.findOne(baseFilter)
    .select("_id key vented")
    .lean<ContainerLean | null>();

  if (!current) throw new ApiError(404, "Container not found");

  // 2) Compute the target unique fields after update (unique index is on { key, vented })
  const nextKey: string = (payload?.key ?? current.key) as string;
  const nextVented: boolean =
    typeof payload?.vented === "boolean" ? payload.vented : current.vented;

  // 3) Prevent collision with any OTHER document (exclude self by _id)
  const conflict = await Container.findOne({
    key: nextKey,
    vented: nextVented,
    _id: { $ne: current._id },
  })
    .select("_id")
    .lean();

  if (conflict) {
    throw new ApiError(
      409,
      `Container with key "${nextKey}" and vented "${nextVented}" already exists`
    );
  }

  // 4) Update by _id to avoid re-matching the same doc by key
  const updated = await Container.findOneAndUpdate(
    { _id: current._id },
    payload,
    {
      new: true,
      runValidators: true,
      context: "query",
    }
  );

  if (!updated) throw new ApiError(404, "Container not found");
  return updated;
}

export async function deleteContainer(idOrKey: string) {
  const filter = isObjectId(idOrKey)
    ? { _id: new mongoose.Types.ObjectId(idOrKey) }
    : { key: idOrKey };

  const res = await Container.findOneAndDelete(filter);
  if (!res) throw new ApiError(404, "Container not found");
}
