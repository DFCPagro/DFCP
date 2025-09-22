// frontend/src/api/auth.ts



import { api } from "./config";
import type {
  AuthResponse,
  AuthResponseRaw,
  MeResponse,
  RegisterPayload,
  RegisterResponse,
  LoginPayload,
  LoginResponse,
} from "@/types/auth";

/**
 * Register a new user.
 * Backend expects: { name, email, password, address: { lnt, alt, address }, phone?, birthday? }
 * Returns only { success: true } (no auto-login).
 */
export const registerApi = async (
  payload: RegisterPayload
): Promise<RegisterResponse> => {
  // payload.address already matches backend Address type
  const { data } = await api.post<RegisterResponse>("/auth/register", payload);
  return data;
};

/**
 * Login → backend returns LoginResponse: { name, role, accessToken, refreshToken }
 * Map to your app's AuthResponse: { user, token }.
 * (email/id aren't provided by /auth/login — fetch via /auth/me after storing token)
 */
export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await api.post<LoginResponse>("/auth/login", payload);

  // Map to your app shape. We only have name/role here.
  // id/email come from /auth/me after you set Authorization with accessToken.
  return {
    user: {
      // you'll hydrate id/email later from /auth/me
      id: "" as unknown as string,
      email: "" as unknown as string,
      name: data.name,
      role: data.role,
    },
    token: data.accessToken,
  };
};

/**
 * Me → fetch public user profile (requires Authorization header to be set on api instance)
 */
export const meApi = async (): Promise<MeResponse> => {
  const { data } = await api.get<MeResponse>("/auth/me");
  return data;
};
