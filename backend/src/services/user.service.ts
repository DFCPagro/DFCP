import { User } from "../models"; // or: import { User } from "../models/user.model";
import generateId from "../utils/generateId";
import ApiError from "../utils/ApiError";
import { Role, roles } from "../utils/constants";
// Use the Address type from the model to stay in sync with the schema
import type { Address } from "../models/user.model";
import { Farmer } from "../models/farmer.model"; // or: import { User } from "../models/user.model";
import type { FlattenMaps, Require_id } from "mongoose";

export const DEFAULT_LC_ID = "66e007000000000000000001";

export type LeanUser = Require_id<FlattenMaps<User>>;

/**
 * Create a user document in the base User collection.
 * - Model expects `addresses: Address[]`.
 * - Allows callers to pass either a single `address` or an `addresses` array for convenience.
 */
export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  // Accept a single address for convenience…
  address?: Address;
  // …or an array that maps 1:1 to the schema.
  addresses?: Address[];
  logisticCenterId?: string | null;
  birthday?: Date | string;
  role?: Role; // optional; validated but NOT used to switch models
}) {
  const role: Role = (data.role ?? "customer") as Role;

  if (!roles.includes(role)) {
    throw new ApiError(400, `Invalid role: ${role}`);
  }

  const uid = generateId("u_");

  const addresses: Address[] =
    Array.isArray(data.addresses) && data.addresses.length > 0
      ? data.addresses
      : data.address
      ? [data.address]
      : [];

  const payload: any = {
    uid,
    name: data.name,
    email: String(data.email).trim().toLowerCase(),
    password: data.password, // hashed by pre('save') hook
    role,
    addresses, // <-- align with schema
  };

  if (data.phone) payload.phone = data.phone;
  if (data.birthday) payload.birthday = data.birthday;

  try {
    const doc = await User.create(payload);
    return doc;
  } catch (err: any) {
    // Surface duplicate email more nicely
    if (err?.code === 11000 && err?.keyPattern?.email) {
      throw new ApiError(409, "Email is already registered");
    }
    throw err;
  }
}

/**
 * Look up a user by email for login.
 * `password` is select:false in the schema, so we must opt it in here.
 * Return a hydrated document (no `.lean()`), so instance methods work.
 */
export async function findUserByEmail(email: string) {
  return User.findOne({ email: String(email).trim().toLowerCase() }).select(
    "+password"
  );
}

/** Strict lookup by id with a 404 if missing. */
export async function getUserById(id: string): Promise<LeanUser | null> {
  return User.findById(id).lean().exec();
}

/** ---------- Public projection helpers (used by /auth/me) ---------- **/

export type PublicUser = {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: Role | string;
  activeStatus: boolean;
  phone?: string;
  birthday?: Date;
  // Align with model: plural addresses
  addresses: Address[];
  createdAt?: Date;
  updatedAt?: Date;
  mdCoins?: number;
};

export function toPublicUser(u: any): PublicUser {
  return {
    id: String(u._id ?? u.id),
    uid: u.uid,
    name: u.name,
    email: u.email,
    role: u.role,
    activeStatus: Boolean(u.activeStatus),
    phone: u.phone,
    birthday: u.birthday,
    addresses: Array.isArray(u.addresses) ? u.addresses : [],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function getPublicUserById(id: string): Promise<PublicUser> {
  const u = await getUserById(id);
  if (!u) throw new ApiError(404, "User not found");
  return toPublicUser(u); // u is plain/lean
}

// ====== (user personal info ) ======
import { Types } from "mongoose";
import { get } from "../controllers/deliverer.controller";

// For now, always pin LC to this id regardless of what the client sends.

export type NewAddressInput = {
  lat: number; // longitude (kept as 'lnt' per your schema)
  lng: number; // latitude  (kept as 'alt' per your schema)
  address: string;
  // logisticCenterId?: string; // intentionally ignored for now
};

export type UpdateContactInput = {
  email?: string;
  phone?: string;
};

function asObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error("Invalid user id");
  return new Types.ObjectId(id);
}

/**
 * Get all addresses for a user.
 */
export async function getUserAddresses(userId: string) {
  const user = await User.findById(asObjectId(userId), { addresses: 1 }).lean();
  if (!user) throw new Error("User not found");
  return user.addresses ?? [];
}

/**
 * Add a new address to the user.
 * NOTE: For now, we always set logisticCenterId = DEFAULT_LC_ID, ignoring any incoming LC id.
 * TODO: later compute the closest LC from (alt, lnt) and assign it here.
 */
export async function addUserAddress(userId: string, payload: NewAddressInput) {
  if (typeof payload?.lat !== "number" || !isFinite(payload.lat)) {
    throw new Error("lat (longitude) must be a finite number");
  }
  if (typeof payload?.lng !== "number" || !isFinite(payload.lng)) {
    throw new Error("alt (latitude) must be a finite number");
  }
  if (typeof payload?.address !== "string" || !payload.address.trim()) {
    throw new Error("address is required");
  }

  const addressDoc = {
    lnt: payload.lat,
    alt: payload.lng,
    address: payload.address.trim(),
    logisticCenterId: DEFAULT_LC_ID, // pinned LC for now
  };

  const updated = await User.findByIdAndUpdate(
    asObjectId(userId),
    { $push: { addresses: addressDoc } },
    { new: true, projection: { addresses: 1 } }
  ).lean();

  if (!updated) throw new Error("User not found");
  return updated.addresses ?? [];
}

/**
 * Fetch just the user's name.
 */
export async function getUserName(userId: string) {
  const user = await User.findById(asObjectId(userId), { name: 1 }).lean();
  if (!user) throw new Error("User not found");
  return { name: user.name };
}

/**
 * Update email and/or phone (either field is optional).
 * - Email is normalized to lowercase.
 * - Basic format checks included (schema validators still apply).
 * - Duplicate email will surface a Mongo duplicate key error to the caller.
 */
export async function updateUserContact(
  userId: string,
  updates: UpdateContactInput
) {
  const $set: Record<string, any> = {};

  if (typeof updates.email === "string") {
    const normalized = updates.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("Invalid email format");
    }
    $set.email = normalized;
  }

  if (typeof updates.phone === "string") {
    const phone = updates.phone.trim();
    // light sanity: allow +, digits, spaces, (), and dashes
    if (!/^[+\d\s\-()]{7,20}$/.test(phone)) {
      throw new Error("Invalid phone format");
    }
    $set.phone = phone;
  }

  if (Object.keys($set).length === 0) {
    throw new Error("No updatable fields provided (email or phone)");
  }

  const updated = await User.findByIdAndUpdate(
    asObjectId(userId),
    { $set },
    { new: true, projection: { name: 1, email: 1, phone: 1, birthday: 1 } }
  ).lean();

  if (!updated) throw new Error("User not found");

  return {
    name: updated.name,
    email: updated.email,
    phone: updated.phone ?? null,
    birthday: updated.birthday ?? null,
  };
}

function assertObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid user id");
  }
}

export type ContactInfo = {
  name: string;
  email: string;
  phone: string | null;
  role: Role | string;
  logisticCenterId: Types.ObjectId;
  // added only for farmer role
  farmName?: string | "Freshy Fresh";
  farmLogo?: string;
};

/**
 * Fetch contact info (name, email, phone, birthday).
 * if any type of manager or role we will get more if needeed
 */
export async function getContactInfoByIdService(
  userId: string
): Promise<ContactInfo> {
  assertObjectId(userId);

  const user = await User.findById(userId, {
    name: 1,
    email: 1,
    phone: 1,
    role: 1,
  }).lean();
  if (!user) throw new ApiError(404, "User not found");

  const base: ContactInfo = {
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    logisticCenterId: user.logisticCenterId,
  };

  if (String(user.role) === "farmer") {
    // Only for farmers, enrich with farmName from Farmer collection
    const farmer = await Farmer.findOne(
      { user: userId },
      { farmName: 1, farmLogo: 1 }
    ).lean();
    base.farmName = farmer?.farmName ?? "freshy fresh";
    base.farmLogo = farmer?.farmLogo ?? undefined;
  }

  return base;
}

export async function removeAddress(
  userId: string,
  addr: Pick<Address, "lnt" | "alt" | "address">
) {
  if (typeof addr?.lnt !== "number" || !isFinite(addr.lnt)) {
    throw new Error("lnt (longitude) must be a finite number");
  }
  if (typeof addr?.alt !== "number" || !isFinite(addr.alt)) {
    throw new Error("alt (latitude) must be a finite number");
  }
  if (typeof addr?.address !== "string" || !addr.address.trim()) {
    throw new Error("address is required");
  }

  // Fetch current addresses to detect if anything was actually removed
  const existing = await User.findById(asObjectId(userId), {
    addresses: 1,
  }).lean();
  if (!existing) throw new Error("User not found");

  const beforeLen = Array.isArray(existing.addresses)
    ? existing.addresses.length
    : 0;

  const criteria = {
    lnt: addr.lnt,
    alt: addr.alt,
    address: addr.address.trim(),
    // NOTE: Do NOT include logisticCenterId in the match so it still removes
    // even if LC changed or is null/omitted in the payload.
  };

  const updated = await User.findByIdAndUpdate(
    asObjectId(userId),
    { $pull: { addresses: criteria } },
    { new: true, projection: { addresses: 1 } }
  ).lean();

  if (!updated) throw new Error("User not found");

  const afterLen = Array.isArray(updated.addresses)
    ? updated.addresses.length
    : 0;
  if (afterLen === beforeLen) {
    throw new ApiError(404, "Address not found");
  }

  return updated.addresses ?? [];
}

export async function getMDCoins(userId: string): Promise<number> {
  const user = await User.findById(asObjectId(userId)).select("mdCoins").lean();
  if (!user) throw new Error("User not found");
  return user.mdCoins ?? 0;
}

import mongoose from "mongoose";

export async function updateMDCoins(
  userId: string,
  amount: number
): Promise<number> {
  // Validate inputs
  if (!mongoose.isValidObjectId(userId)) {
    throw new Error("Invalid user ID");
  }
  if (typeof amount !== "number" || !isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }

  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Calculate new mdCoins value (prevent going below zero)
  const newMDCoins = Math.max(0, (user.mdCoins ?? 0) + amount);

  // Only update if it actually changes
  user.mdCoins = newMDCoins;
  await user.save();

  return newMDCoins;
}
