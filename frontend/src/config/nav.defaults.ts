// src/config/nav.defaults.ts
import { PATHS as P } from "@/routes/paths";

export const DEFAULT_LANDINGS = {
  admin: P.adminDashboard,
  farmer: P.FarmerDashboard,
  fManager: P.fManagerDashboard,
  csManager: P.csManagerDashboard,
  picker: P.pickerDashboard,
  deliverer: P.delivererDashboard,
  tManager: "/tManager/dashboard", //WIP

  customer: P.market,
} as const;

export function getDefaultLanding(role?: string | null) {
  //console.log("........................Entering");
  console.log("Role:", role);
  if (role === "customer") {
    console.log(".....After customer check", DEFAULT_LANDINGS.customer);
    return DEFAULT_LANDINGS.customer;
  }
  if (role && role in DEFAULT_LANDINGS) {
    return DEFAULT_LANDINGS[role as keyof typeof DEFAULT_LANDINGS];
  }
}
