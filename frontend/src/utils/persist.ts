// src/utils/persist.ts

/**
 * Tiny persistence helpers with safe JSON parse/stringify.
 * Works in browser-only contexts; guards against SSR/No-Storage environments.
 */

const NAMESPACE = "app.v1";

function hasStorage(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const t = "__test__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return true;
  } catch {
    return false;
  }
}

export function save<T>(key: string, value: T): void {
  if (!hasStorage()) return;
  try {
    const payload = JSON.stringify(value);
    window.localStorage.setItem(`${NAMESPACE}:${key}`, payload);
  } catch {
    // swallow
  }
}

export function load<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(`${NAMESPACE}:${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function clear(key: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(`${NAMESPACE}:${key}`);
  } catch {
    // swallow
  }
}
