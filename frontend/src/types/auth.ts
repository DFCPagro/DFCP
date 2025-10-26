import type { Address } from "./address";

/* -------------------------------- Roles ---------------------------------- */

export type Role =
  | "customer"
  | "admin"
  | "deliverer"
  | "farmer"
  | "csManager"
  | "tManager"
  | "fManager"
  | "opManager"   // ⬅ added (seen in your sample)
  | "picker"      // ⬅ common in app
  | "sorter"      // ⬅ common in app
  | (string & {}); // allow future roles without widening to plain string

/* -------------------------------- User ----------------------------------- */
/** Minimal User used in UI. Backend may not return full profile on login. */
export type User = {
  id?: string;           // often not returned on login
  name: string;
  role: Role;
  email?: string | null; // optional—login payload doesn’t include it
  uid?: string;
  status?: boolean;
  logisticCenterId?: string | null; // convenient mirror, may be absent on /me
  createdAt?: string;
  updatedAt?: string;
};

/* ---------------------------- Auth Responses ----------------------------- */
/** What your app uses internally after normalization */
export type AuthResponse = {
  user: User;
  token: string;                 // access token (JWT)
  refreshToken?: string | null;  // optional if you want to store it
  logisticCenterId?: string | null; // convenience copy for quick access
};

/** A common `/me` response shape */
export type MeResponse = {
  user: User;
};

/* ------------------------------- Register -------------------------------- */
export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  address: Address;
  phone?: string;
  birthday?: string; // ISO date string
};

export type RegisterResponse = { success: true };

/* --------------------------------- Login --------------------------------- */
export type LoginPayload = { email: string; password: string };

/** EXACTLY matches your sample backend response */
export type LoginResponse = {
  name: string;
  role: Role;
  logisticCenterId: string;
  accessToken: string;
  refreshToken: string;
};

/* ------------------------------ Normalizers ------------------------------ */
/**
 * Turn the backend LoginResponse into the AuthResponse your app/store expects.
 * Use this right after calling the /auth/login endpoint.
 */
export function normalizeLogin(res: LoginResponse): AuthResponse {
  return {
    user: {
      name: res.name,
      role: res.role,
      logisticCenterId: res.logisticCenterId,
    },
    token: res.accessToken,
    refreshToken: res.refreshToken,
    logisticCenterId: res.logisticCenterId,
  };
}
