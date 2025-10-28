/**
 * Central menu registry (single source of truth).
 * Edit this file to change grouping/labels/paths; components render from here.
 *
 * Conventions:
 * - Keys are unique across ALL items/groups.
 * - Group labels become section titles in the side drawer.
 * - Paths are plain strings to avoid tight coupling; you can swap to route constants later.
 */

import type { MenuRegistry, MenuItem, Mode } from "@/types/menu";
import { focusManager } from "@tanstack/react-query";
import { PATHS as P } from "@/routes/paths";

/* ------------------------ Customer menu ------------------------ */
export const noUserMenu: MenuRegistry["noUser"] = [
  { type: "link", key: "home", label: "Home", path: P.home, exact: true },
  { type: "link", key: "login", label: "Login", path: P.login },
  { type: "link", key: "register", label: "Register", path: P.register },
] as const;

// Reusable "market pages" group for all WORKER roles
export const WORKER_MARKET_GROUP = {
  type: "group",
  key: "market",
  label: "view market",
  children: [
    {
      type: "link",
      key: "market",
      label: "Market",
      path: P.market,
      exact: true,
    },
    { type: "link", key: "orders", label: "MyOrders", path: P.orders },
    { type: "link", key: "profile", label: "Profile", path: P.profile },
  ],
} as const;

const customerMenu: MenuRegistry["customer"] = [
  {
    type: "link",
    key: "market",
    label: "Market",
    path: P.market,
    exact: true,
  },
  {
    type: "link",
    key: "JobApplication",
    label: "Apply for jobs",
    path: P.jobs,
  },
  { type: "link", key: "orders", label: "MyOrders", path: P.orders },
  { type: "link", key: "profile", label: "Profile", path: P.profile },
] as const;

/* ------------------------ Work menus by role ------------------------ */

const workFarmer: ReadonlyArray<MenuItem> = [
  { type: "link", key: "farmer-crops", label: "Crops", path: "/farmer/crops" },
  {
    type: "link",
    key: "farmer-upcoming",
    label: "Upcoming Deliveries",
    path: "/farmer/deliveries/upcoming",
  },
  {
    type: "link",
    key: "farmer-reports",
    label: "Delivery Reports",
    path: "/farmer/deliveries/reports",
  },
  {
    type: "link",
    key: "farmer-dashboard",
    label: "Dashboard",
    path: "/farmerDashboard",
  },

  WORKER_MARKET_GROUP,
] as const;

const workAdmin: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "admin-dashboard",
    label: "Dashboard",
    path: P.adminDashboard,
  },
  {
    type: "group",
    key: "CSManager", // Customer Service Manager
    label: "CS Manager",
    children: [
      {
        type: "link",
        key: "CS-M-dashboard",
        label: "CS-M Dashboard",
        path: P.csManagerDashboard,
      },
      {
        type: "link",
        key: "CS-M-orders",
        label: "CS-M Orders",
        path: P.csManagerOrders,
      },
      {
        type: "link",
        key: "CS-M-shift-orders",
        label: "CS-M Shift Orders",
        path: P.csManagerShiftOrders,
      },
    ],
  },
  {
    type: "group",
    key: "FManager", // Farmer Manager
    label: "FManager pages",
    children: [
      {
        type: "link",
        key: "F-M-dashboard",
        label: "F-M Dashboard",
        path: P.fManagerDashboard,
      },
      {
        type: "link",
        key: "F-M-create-stock",
        label: "F-M Create Stock",
        path: P.fManagerCreateStock,
      },
      {
        type: "link",
        key: "F-M-item-management",
        label: "F-M Item Management",
        path: P.fManagerItemManagement,
      },
    ],
  },

  // just for admin role
  {
    type: "group",
    key: "admin-working-links",
    label: "Working Links",
    children: [
      {
        type: "link",
        key: "admin-items-management",
        label: "Manage Items",
        path: P.ItemsManagment,
      },
      {
        type: "link",
        key: "admin-job-review",
        label: "Job Application Review",
        path: P.JobAppReview,
      },
      {
        type: "link",
        key: "admin-expected-harvest",
        label: "Expected Harvest",
        path: P.cropHarvest,
      },
      {
        type: "link",
        key: "admin-package-sizes",
        label: "Package Sizes",
        path: P.PackageSizes,
      },
    ],
  },

  {
    type: "group",
    key: "TManager",
    label: "T Manager WIP",
    children: [
      { type: "link", key: "mgr-packages", label: "packages", path: "#" },
      { type: "link", key: "mgr-deliverers", label: "deliverers", path: "#" },
      { type: "link", key: "mgr-dashboard", label: "Dashboard", path: "#" },
    ],
  },

  WORKER_MARKET_GROUP,
] as const;

const workFManager: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "dashboard",
    label: "Dashboard",
    path: P.fManagerDashboard,
  },
  {
    type: "link",
    key: "item-management",
    label: "Item Management",
    path: P.fManagerItemManagement,
  },

  WORKER_MARKET_GROUP,
] as const;

const workTManager: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "dashboard",
    label: "dashboard",
    path: "",
  },

  WORKER_MARKET_GROUP,
] as const;

const workCSManager: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "cs-dashboard",
    label: "Dashboard",
    path: "/csManager/dashboard",
  },
  {
    type: "link",
    key: "cs-orders",
    label: "All Orders",
    path: "/csManager/orders",
  },
  {
    type: "link",
    key: "cs-reports",
    label: "Reports Inbox",
    path: "/csManager/reports",
  },
  {
    type: "link",
    key: "cs-customers",
    label: "Customers",
    path: "/csManager/customers",
  },
  {
    type: "link",
    key: "cs-analytics",
    label: "Analytics",
    path: "/csManager/analytics",
  },

  WORKER_MARKET_GROUP,
] as const;

const workDeliverer: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "drv-schedule",
    label: "Schedule",
    path: "#",
    exact: true,
  },
  {
    type: "link",
    key: "drv-today",
    label: "Today",
    path: "#",
  },
  {
    type: "link",
    key: "drv-upcoming",
    label: "Upcoming",
    path: "#",
  },
  {
    type: "link",
    key: "drv-month",
    label: "Month View",
    path: "#",
  },

  WORKER_MARKET_GROUP,
] as const;

const workPicker: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "dashboard",
    label: "dashboard",
    path: "picker/dashboard",
  },

  WORKER_MARKET_GROUP,

  { type: "link", key: "profile", label: "profile", path: "workerProfile" },
] as const;

/* ------------------------ Registry export ------------------------ */

export const MENUS: MenuRegistry = {
  noUser: noUserMenu,
  customer: customerMenu,
  work: {
    admin: workAdmin,
    farmer: workFarmer,
    manager: workAdmin,
    deliverer: workDeliverer,
    industrialDeliverer: workDeliverer,
    picker: workPicker,
    fManager: workFManager,
    tManager: workTManager,
    csManager: workCSManager,
    // You can add more roles at runtime:
    // supervisor: [...],
  },
} as const;

/* ------------------------ Tiny helper for consumers ------------------------ */

/**
 * Returns the correct menu list for the given mode/role.
 * If a work role has no menu defined, returns an empty array.
 */
export function getMenuFor(mode: Mode, role?: string | null) {
  if (mode === "noUser") return MENUS.noUser;
  if (mode === "customer") return MENUS.customer;
  return (role && MENUS.work[role]) || [];
}

export const DEFAULT_LANDINGS: Record<Mode, string> = {
  noUser: "/", // <— public landing
  work: "/dashboard",
  customer: "/market",
  // (or a role-specific landing if you want later)
};
