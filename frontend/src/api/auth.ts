import { api } from "./config";
import type { AuthResponse, MeResponse } from "../types/auth";

export type LoginPayload = { email: string; password: string };
export type RegisterPayload = { name: string; email: string; password: string };

export const registerApi = async (payload: RegisterPayload) => {
  const { data } = await api.post<AuthResponse>("/api/auth/register", payload);
  return data;
};

export const loginApi = async (payload: LoginPayload) => {
  const { data } = await api.post<AuthResponse>("/api/auth/login", payload);
  return data;
};

export const meApi = async () => {
  const { data } = await api.get<MeResponse>("/api/auth/me");
  return data;
};
