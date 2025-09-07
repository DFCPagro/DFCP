// src/services/user.service.ts

import {User} from "../models"; // If you use a barrel, change to: import { User } from "../models";
import generateId from "../utils/generateId";
import ApiError from "../utils/ApiError";
import { Role, roles } from "../utils/constants";
import { Address } from "../types/address";

/**
 * Create a user document in the base User collection.
 * - No discriminators are used here; every doc is a plain User with a role field.
 * - For self-registration, the caller (auth.service.register) should force role="customer".
 */
export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address: Address;                 // { lnt: number; alt: number; address: string }
  birthday?: Date | string;
  role?: Role;                      // optional; validated but NOT used to switch models
}) {
  const role: Role = (data.role ?? "customer") as Role;

  // Defensive validation so admin/seed flows can't inject unknown roles
  if (!roles.includes(role)) {
    throw new ApiError(400, `Invalid role: ${role}`);
  }

  const uid = generateId("u_");

  const payload: any = {
    uid,
    name: data.name,
    email: data.email,
    password: data.password, // hashed by pre('save') hook on the model
    role,
    address: data.address,
  };

  if (data.phone) payload.phone = data.phone;
  if (data.birthday) payload.birthday = data.birthday;

  const doc = await User.create(payload);
  return doc;
}

/**
 * Look up a user by email. Used by login.
 * Note: password is included by default in your schema. If you ever mark it select:false,
 *       change this to: return User.findOne({ email }).select("+password");
 */
export async function findUserByEmail(email: string) {
  return User.findOne({ email });
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
  address: Address;
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
    address: u.address,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function getPublicUserById(id: string): Promise<PublicUser> {
  const user = await getUserById(id);
  return toPublicUser(user);
}
