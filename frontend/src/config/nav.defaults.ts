// src/config/nav.defaults.ts
import type { Mode } from "@/types/menu";

export const DEFAULT_LANDINGS = {
  work: {
    admin: "/admin/dashboard",
    farmer: "/farmer/crops",
    manager: "/manager/orders/active",
    deliverer: "/deliverer/schedule",
    fManager: "/fManager/dashboard",
    tManager: "/tManager/dashboard",
    csManager: "/csManager/dashboard",
    picker: "/picker/dashboard",
  },
  customer: "/market",
} as const;

export function getDefaultLanding(mode: Mode, role?: string | null) {
  if (mode === "customer") return DEFAULT_LANDINGS.customer;
  if (role && role in DEFAULT_LANDINGS.work) {
    return DEFAULT_LANDINGS.work[role as keyof typeof DEFAULT_LANDINGS.work];
  }
  return DEFAULT_LANDINGS.customer;
}
