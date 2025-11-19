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
import { AiTwotoneShop } from "react-icons/ai";

/* ------------------------ Customer menu ------------------------ */
export const noUserMenu: MenuRegistry["noUser"] = [
  { type: "link", key: "login", label: "Login", path: P.login },
  { type: "link", key: "register", label: "Register", path: P.register },
] as const;

// Reusable "market pages" group for all WORKER roles
export const WORKER_MARKET_GROUP = {
  type: "group",
  key: "market",
  label: "View Market",
  icon: AiTwotoneShop,
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
  { type: "link", key: "market", label: "Market", path: P.market, exact: true },
  { type: "link", key: "orders", label: "My Orders", path: P.orders },
  { type: "link", key: "profile", label: "Profile", path: P.profile },
  {
    type: "link",
    key: "JobApplication",
    label: "Apply for jobs",
    path: P.jobs,
  },
] as const;

/* ------------------------ Work menus by role ------------------------ */

const workFarmer: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "farmer-dashboard",
    label: "Dashboard",
    path: P.FarmerDashboard,
  },

  {
    type: "link",
    key: "farmer-reports",
    label: "Delivery Reports",
    path: P.FarmerOrderReport,
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

  // CS Manager first-class operations
  {
    type: "group",
    key: "CSManager",
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
    ],
  },

  // Farmer Manager operations
  {
    type: "group",
    key: "FManager",
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
        key: "F-M-item-management",
        label: "F-M Item Management",
        path: P.fManagerItemManagement,
      },
      {
        type: "link",
        key: "F-M-create-stock",
        label: "F-M Create Stock",
        path: P.fManagerCreateStock,
      },
    ],
  },
  // Transport Manager placeholder
  {
    type: "group",
    key: "OpManager",
    label: "Op Manager",
    children: [
      //{ type: "link", key: "mgr-dashboard", label: "Dashboard", path: "#" },
      {
        type: "link",
        key: "pickerTasks",
        label: "picker tasks",
        path: P.PickerTasksPage,
      },
      //{ type: "link", key: "mgr-packages", label: "Packages", path: "#" },
    ],
  },

  // Transport Manager placeholder
  {
    type: "group",
    key: "TManager",
    label: "T Manager WIP",
    children: [
      {
        type: "link",
        key: "t-manager-dashboard",
        label: "T-M Dashboard",
        path: P.TManagerDashboard,
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
    type: "link",
    key: "admin-jobApplication",
    label: "Job Application Review",
    path: P.JobAppReview,
  },
  {
    type: "link",
    key: "statistics-analytics",
    label: "Statistics & Analytics",
    path: P.StatisticsAnalytics,
  },

  // Admin utilities

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
  {
    type: "link",
    key: "create-stock",
    label: "Create Stock",
    path: P.fManagerCreateStock,
  },
  {
    type: "link",
    key: "admin-job-review",
    label: "Job Application",
    path: P.JobAppReview,
  },
  {
    type: "link",
    key: "view-farmer-orders",
    label: "View Farmer Orders",
    path: P.fManagerViewFarmerOrders,
  },
  {
    type: "link",
    key: "view-farmer-list",
    label: "View Farmer List",
    path: P.fManagerViewFarmerList,
  },
  WORKER_MARKET_GROUP,
] as const;

const workTManager: ReadonlyArray<MenuItem> = [
  {
        type: "link",
        key: "t-manager-dashboard",
        label: "Dashboard",
        path: P.TManagerDashboard,
      },
      {
        type: "link",
        key: "admin-package-sizes",
        label: "Package Sizes",
        path: P.PackageSizes,
      },
      {
        type: "group",
    key: "manage-deliverers",
    label: "Manage Deliverers" ,
    children: [{

      type: "link",
        key: "deliverers-management",
        label: "manage deliverers",
        path: P.PackageSizes,//reconnect 
    },
{
    type: "link",
        key: "job-application",
        label: "Job applications",
        path: P.PackageSizes,//reconnect
    },


  ]   
      },


  WORKER_MARKET_GROUP,
] as const;

const workCSManager: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "cs-dashboard",
    label: "Dashboard",
    path: P.csManagerDashboard,
  },
  {
    type: "link",
    key: "cs-orders",
    label: "All Orders",
    path: P.csManagerOrders,
  },
  {
    type: "link",
    key: "cs-customers",
    label: "Customers",
    path: P.csManagerCustomers,
  },
  {
    type: "link",
    key: "cs-reports",
    label: "Reports Inbox",
    path: P.csManagerReportsInbox,
  },
  {
    type: "link",
    key: "cs-analytics",
    label: "Analytics",
    path: P.csManagerAnalytics,
  },
  WORKER_MARKET_GROUP,
] as const;

const workDeliverer: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "dlvr-dashboard",
    label: "Dashboard",
    path: P.delivererDashboard,
    exact: true,
  },
  {
    type: "link",
    key: "dlvr-schedule",
    label: "Schedule",
    path: P.delivererSchedule,
    exact: true,
  },

  WORKER_MARKET_GROUP,
] as const;

const workPicker: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "dashboard",
    label: "Dashboard",
    path: P.pickerDashboard,
  },
  {
    type: "link",
    key: "picker-schedule",
    label: "Schedule",
    path: P.pickerSchedule,
  },
  { type: "link", key: "profile", label: "Profile", path: P.workerProfile },
  WORKER_MARKET_GROUP,
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
  noUser: P.login, // <— public landing
  work: "/dashboard",
  customer: P.market,
  // (or a role-specific landing if you want later)
};
