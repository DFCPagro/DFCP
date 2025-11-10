// auth.service.ts
import ApiError from "../utils/ApiError";
import { createUser, findUserByEmail } from "./user.service";
import * as tokenService from "./token.service";
import { Address } from "../models/user.model";
import {getMDCoins} from "./user.service";

/**
 * Register (create-only)
 * - NO implicit login
 * - NO tokens here
 * - Returns only { success: true } or throws an ApiError
 */
export async function register(input: {
  name: string;
  email: string;
  password: string;
  address: Address;      // client-provided address (optional lcId)
  phone?: string;
  birthday?: Date | string;
}) {
  const { name, email, password, address, phone, birthday } = input;

  // 1) Duplicate email check
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new ApiError(409, "Email already registered");
  }

  // 2) Normalize address to what createUser currently expects (lcId: string)
  const addressForCreate: {
    lnt: number;
    alt: number;
    address: string;
    logisticCenterId: string;
  } = {
    lnt: address.lnt,
    alt: address.alt,
    address: address.address,
    // If your createUser typing requires a string, satisfy it here.
    // (If you later widen createUser to accept null/undefined, change this to `?? null`.)
    logisticCenterId: address.logisticCenterId ?? "66e007000000000000000001",
  };

  // 3) Create user (force role = 'customer' for self-registration)
  await createUser({
    name,
    email,
    password,
    phone,
    role: "customer" as const,
    address: addressForCreate,
    ...(birthday ? { birthday } : {}),
  });

  // 4) Success (no user info in response)
  return { success: true as const };
}

/**
 * Login
 * - Returns only: { name, role, accessToken, refreshToken }
 * - No ids, no email
 */
export async function login({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const user = await findUserByEmail(email);
  if (!user) throw new ApiError(401, "Invalid credentials");

  if (user.activeStatus === false) {
    throw new ApiError(403, "Account is not active");
  }

  const ok = await (user as any).isPasswordMatch(password);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  const userId = String((user as any).id ?? (user as any)._id);
  const logisticCenterId = String((user as any).logisticCenterId);
  const mdCoins = await getMDCoins(userId);
  const accessToken = tokenService.signAccessToken(userId, logisticCenterId);
  const refreshToken = tokenService.signRefreshToken(userId, logisticCenterId);

  return {
    name: user.name,
    role: user.role,
    logisticCenterId,
    accessToken,
    refreshToken,
    mdCoins,
  };
}

