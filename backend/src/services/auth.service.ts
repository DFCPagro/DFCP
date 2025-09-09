// auth.service.ts
import ApiError from "../utils/ApiError";
import { createUser, findUserByEmail } from "./user.service";
import * as tokenService from "./token.service";
import { Address } from "../types/address";

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
  address: Address;             // { lnt: number; alt: number; address: string }
  phone?: string;
  birthday?: Date | string;
  // any other fields from client are ignored/validated upstream
}) {
  const { name, email, password, address, phone, birthday } = input;

  // 1) Duplicate email check
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new ApiError(409, "Email already registered");
  }

  // 2) Create user (force role = 'customer' for self-registration)
  await createUser({
    name,
    email,
    password,
    phone: phone ?? undefined,
    address,
    role: "customer" as any,
    ...(birthday ? { birthday } : {}),
  });

  // 3) Success (no user info in response)
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
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  // Optional gate: block inactive accounts (recommended)
  if (user.activeStatus === false) {
    throw new ApiError(403, "Account is not active");
  }

  const ok = await (user as any).isPasswordMatch(password);
  if (!ok) {
    throw new ApiError(401, "Invalid credentials");
  }

  const userId = String((user as any).id ?? (user as any)._id);
  const accessToken = tokenService.signAccessToken(userId);
  const refreshToken = tokenService.signRefreshToken(userId);

  return {
    name: user.name,
    role: user.role,
    accessToken,
    refreshToken,
  };
}
