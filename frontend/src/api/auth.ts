// src/api/auth.ts
import { api } from "./config";
import type { AuthResponse, AuthResponseRaw, MeResponse } from "@/types/auth";

// ---------------- Payload types ----------------

export type LoginPayload = { email: string; password: string };

/**
 * Frontend form can still pass flat fields.
 * We'll normalize into backend's required nested address object.
 */
export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  birthday?: string; // ISO date string (yyyy-mm-dd)
  address?: string;  // human-readable address string
  latitude?: number;
  longitude?: number;
};

// Backend only responds with { success: true } on registration
export type RegisterResponse = { success: true };

// ---------------- Type guards (runtime shape checks) ----------------

function isLoginBackendShape(d: any): d is {
  name: string;
  role: string;
  accessToken: string;
  refreshToken?: string;
} {
  return (
    d &&
    typeof d === "object" &&
    typeof d.name === "string" &&
    typeof d.role === "string" &&
    typeof d.accessToken === "string"
  );
}

function isTokenEnvelope(d: any): d is { user: any; tokens: { access: string } } {
  return d && typeof d === "object" && d.tokens && typeof d.tokens.access === "string";
}

function isFlatToken(d: any): d is { user: any; token: string } {
  return d && typeof d === "object" && typeof d.token === "string";
}

// ---------------- Helpers ----------------

/**
 * Normalize various backend auth response shapes into the app's { user, token }.
 * Supports:
 *  - { name, role, accessToken, refreshToken? }  (our current /auth/login backend)
 *  - { user, tokens: { access } }                (alt pattern)
 *  - { user, token }                              (legacy/other)
 */
const toAuthResponse = (data: AuthResponseRaw | any): AuthResponse => {
  // Current backend /auth/login shape
  if (isLoginBackendShape(data)) {
    const { name, role, accessToken } = data;
    return { user: { name, role } as any, token: accessToken };
  }

  // Other supported shapes (if present elsewhere)
  if (isTokenEnvelope(data)) return { user: data.user, token: data.tokens.access };
  if (isFlatToken(data)) return { user: data.user, token: data.token };

  throw new Error("Unexpected auth response shape");
};

// ---------------- API methods ----------------

/**
 * Register a new user.
 * - Always forces payload into backend's { address: { lnt, alt, address } } shape.
 * - Returns only { success: true } (no auto-login).
 */
export const registerApi = async (
  payload: RegisterPayload
): Promise<RegisterResponse> => {
  const { name, email, password, phone, birthday, address, latitude, longitude } = payload;

  // Normalize into backend Address type
  const normalized = {
    name,
    email,
    password,
    ...(phone ? { phone } : {}),
    ...(birthday ? { birthday } : {}),
    address: {
      lnt: longitude,
      alt: latitude,
      address,
    },
  };

  const { data } = await api.post<RegisterResponse>("/auth/register", normalized);
  return data;
};

/**
 * Login → backend returns { name, role, accessToken, refreshToken }
 * We reshape to { user, token } for the app/store.
 */
export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await api.post<unknown>("/auth/login", payload);
  return toAuthResponse(data);
};

/**
 * Me → fetch public user profile
 */
export const meApi = async (): Promise<MeResponse> => {
  const { data } = await api.get<MeResponse>("/auth/me");
  return data;
};
