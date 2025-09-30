// src/helpers/activeMatch.ts
import type { MenuLink } from "@/types/menu";

/** Normalize to avoid "/path" vs "/path/" mismatches */
const normalize = (s: string) => (s.endsWith("/") && s !== "/" ? s.slice(0, -1) : s);

export function linkIsActive(pathname: string, link: MenuLink) {
  const curr = normalize(pathname);
  const base = normalize(link.path);
  if (link.exact) return curr === base;
  return curr === base || curr.startsWith(base + "/");
}
