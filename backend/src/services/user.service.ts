import { User } from "../models"; // or: import { User } from "../models/user.model";
import generateId from "../utils/generateId";
import ApiError from "../utils/ApiError";
import { Role, roles } from "../utils/constants";
// Use the Address type from the model to stay in sync with the schema
import type { Address } from "../models/user.model";

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
  birthday?: Date | string;
  role?: Role; // optional; validated but NOT used to switch models
}) {
  const role: Role = (data.role ?? "customer") as Role;

  if (!roles.includes(role)) {
    throw new ApiError(400, `Invalid role: ${role}`);
  }

  const uid = generateId("u_");

  const addresses: Address[] =
    (Array.isArray(data.addresses) && data.addresses.length > 0)
      ? data.addresses
      : (data.address ? [data.address] : []);

  const payload: any = {
    uid,
    name: data.name,
    email: String(data.email).trim().toLowerCase(),
    password: data.password, // hashed by pre('save') hook
    role,
    addresses,               // <-- align with schema
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
  return User.findOne({ email: String(email).trim().toLowerCase() }).select("+password");
}

/** Strict lookup by id with a 404 if missing. */
export async function getUserById(id: string) {
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");
  return user;
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
  const user = await getUserById(id);
  return toPublicUser(user);
}
