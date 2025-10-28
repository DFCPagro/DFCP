    // src/utils/unitPref.ts
export type UnitMode = "unit" | "kg";
const KEY = "unit"; // legacy: "true"/"false"

export function readUnit(): UnitMode {
  const v = localStorage.getItem(KEY);
  if (v === "unit" || v === "kg") return v;
  if (v === "true") return "unit";
  if (v === "false") return "kg";
  return "unit";
}
export function writeUnit(u: UnitMode) {
  localStorage.setItem(KEY, u);
}

// Optional: one-time sync from URL (?unitMode=kg|unit)
export function syncUnitFromUrl(search: string) {
  const sp = new URLSearchParams(search);
  const q = sp.get("unitMode");
  if (q === "kg" || q === "unit") writeUnit(q);
}

// Helper: ensure URL carries unit
export function withUnit(url: string): string {
  const u = readUnit();
  const sp = new URLSearchParams(url.split("?")[1] ?? "");
  sp.set("unitMode", u);
  const base = url.split("?")[0];
  return `${base}?${sp.toString()}`;
}
