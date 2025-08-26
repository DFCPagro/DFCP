import { api } from "./config";
import type { AuthResponse, AuthResponseRaw, MeResponse } from "@/types/auth";

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = { name: string; email: string; password: string };

// helper: raw → unified
const toAuthResponse = (data: AuthResponseRaw): AuthResponse => {
  const token = "token" in data ? data.token : data.tokens.access;
  if (!token) throw new Error("Auth response missing token");
  return { user: data.user, token };
};

export const registerApi = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponseRaw>("/auth/register", payload);
  return toAuthResponse(data);
};

export const loginApi = async (payload: LoginPayload): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponseRaw>("/auth/login", payload);
  return toAuthResponse(data);
};

export const meApi = async (): Promise<MeResponse> => {
  const { data } = await api.get<MeResponse>("/auth/me");
  return data;
};
