import { api } from "./config";
import type {
  AuthResponse,
  MeResponse,
  RegisterPayload,
  RegisterResponse,
  LoginPayload,
  LoginResponse,
} from "@/types/auth";
import { useAuthStore } from "@/store/auth";

/**
 * Register a new user.
 * Backend expects: { name, email, password, address: { lnt, alt, address }, phone?, birthday? }
 * Returns only { success: true } (no auto-login).
 */
export const registerApi = async (
  payload: RegisterPayload
): Promise<RegisterResponse> => {
  const { data } = await api.post<RegisterResponse>("/auth/register", payload);
  return data;
};

/**
 * Login → backend returns:
 * {
 *   name, role, logisticCenterId, accessToken, refreshToken
 * }
 *
 * We normalize this into AuthResponse and update Zustand auth store
 * so components like App.tsx can access `logisticCenterId` right away.
 */
export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await api.post<LoginResponse>("/auth/login", payload);

  // ✅ Build minimal user object
  const user = {
    id: "unknown", // backend doesn’t send ID
    email: payload.email,
    name: data.name,
    role: data.role,
    logisticCenterId: data.logisticCenterId ?? null, // <-- KEY FIX
  };

  // ✅ Normalize to your app shape
  const response: AuthResponse = {
    user,
    token: data.accessToken,
    // You could also store refresh token if you plan to use it later
    logisticCenterId: data.logisticCenterId ?? null,
    mdCoins: data.mdCoins ?? 0,
  };

  // ✅ Immediately sync into Zustand auth store
  useAuthStore
    .getState()
    .setAuth({
      user,
      token: data.accessToken,
      logisticCenterId: data.logisticCenterId ?? null,
      mdCoins: data.mdCoins ?? 0,
    });

  return response;
};

/**
 * Me → fetch authenticated user profile.
 * Requires Authorization header already set on axios instance.
 */
export const meApi = async (): Promise<MeResponse> => {
  const { data } = await api.get<MeResponse>("/auth/me");
  return data;
};
