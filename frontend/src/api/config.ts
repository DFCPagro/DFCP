import axios, { AxiosError } from "axios";
import type { AxiosRequestHeaders } from "axios";
import { useAuthStore } from "../store/auth";
import { VITE_API_URL } from "@/helpers/env";

export const api = axios.create({
  baseURL: VITE_API_URL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    const headers = (config.headers ?? {}) as AxiosRequestHeaders;
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      // optional: window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);
