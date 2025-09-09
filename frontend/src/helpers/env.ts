// Raw env vars (Vite exposes them under import.meta.env)
const rawBase = import.meta.env.VITE_API_BASE || "";
const rawPrefix = import.meta.env.VITE_API_PREFIX || "/api/v1";
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// Normalize so we don't end up with double slashes
const base = rawBase.replace(/\/+$/, "");
const prefix = rawPrefix.startsWith("/") ? rawPrefix : `/${rawPrefix}`;

export const VITE_API_BASE = base;
export const VITE_API_PREFIX = prefix;
export const VITE_API_URL = `${base}${prefix}`;
