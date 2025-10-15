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

/* ------------------------ Customer menu ------------------------ */
export const noUserMenu: MenuRegistry["noUser"] = [
  { type: "link", key: "home", label: "Home", path: "/", exact: true },
  { type: "link", key: "login", label: "Login", path: "/login" },
  { type: "link", key: "register", label: "Register", path: "/register" },
] as const;

const customerMenu: MenuRegistry["customer"] = [
  { type: "link", key: "market", label: "Market", path: "/market", exact: true },
  { type: "link", key: "JobApplication", label: "Apply for jobs", path: "/jobs" },
  { type: "link", key: "orders", label: "MyOrders", path: "/orders" },
    { type: "link", key: "profile", label: "Profile", path: "/profile" },

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
  { type: "link", key: "farmer-dashboard", label: "Dashboard", path: "/farmerDashboard" },
] as const;

const workAdmin: ReadonlyArray<MenuItem> = [
  {
    type: "group",
    key: "mgr-orders",
    label: "Orders-WIP",
    children: [
      { type: "link", key: "mgr-orders-report", label: "Orders Report", path: "/manager/orders/report" },
      { type: "link", key: "mgr-orders-active", label: "Active Orders", path: "/manager/orders/active" },
      { type: "link", key: "mgr-orders-history", label: "Order History", path: "/manager/orders/history" },
    ],
  },
  {
    type: "group",
    key: "mgr-logistics",
    label: "Logistics-WIP",
    children: [
      { type: "link", key: "mgr-containers", label: "Containers", path: "/manager/containers" },
      
    ],
  },
  {
    type: "group",
    key: "mgr-confirm",
    label: "Working Links",
    children: [
      { type: "link", key: "mgr-admin-items", label: "Manage Items", path: "/admin/items" },
      { type: "link", key: "mgr-admin-jobReview", label: "Job Application Review", path: "/admin/jobReview" },
      { type: "link", key: "mgr-expected-harvest", label: "Expected Harvest", path: "/admin/crop-harvest" },
    ],
  },

   {
    type: "group",
    key: "fManager",
    label: "FManager pages",
    children: [
      { type: "link", key: "mgr-farmer-orders", label: "farmer orders", path: "#" },
      { type: "link", key: "mgr-faramer", label: "manage farmers", path: "#" },
      { type: "link", key: "mgr-ams", label: "stcok", path: "#" },
      { type: "link", key: "mgr-dashboard", label: "Dashboard", path: "#" },
    
    ],
  },

    {
    type: "group",
    key: "tManager",
    label: "TManager pages",
    children: [
      { type: "link", key: "mgr-packages", label: "pacakages", path: "#" },
      { type: "link", key: "mgr-deliverers", label: "deliverers", path: "#" },
      { type: "link", key: "mgr-dashboard", label: "Dashboard", path: "#" },
    ],
  },
] as const;

const workDeliverer: ReadonlyArray<MenuItem> = [
  { type: "link", key: "drv-schedule", label: "Schedule", path: "/deliverer/schedule", exact: true },
  { type: "link", key: "drv-today", label: "Today", path: "/deliverer/schedule/today" },
  { type: "link", key: "drv-upcoming", label: "Upcoming", path: "/deliverer/schedule/upcoming" },
  { type: "link", key: "drv-month", label: "Month View", path: "/deliverer/schedule/month" },
] as const;

const workPicker: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "dashboard",
    label: "dashboard",
    path: "picker/dashboard",
  },
 
] as const;

const workFManager: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "dashboard",
    label: "dashboard",
    path: ""
  },
 
] as const;


const workTManager: ReadonlyArray<MenuItem> = [
  {
    type: "link",
    key: "dashboard",
    label: "dashboard",
    path: ""
  },
 
] as const;

// in your central registry file
const workCSManager: ReadonlyArray<MenuItem> = [
  { type: "link", key: "cs-dashboard", label: "Dashboard", path: "/csManager/dashboard" },
  { type: "link", key: "cs-orders", label: "All Orders", path: "/csManager/orders" },
  { type: "link", key: "cs-reports", label: "Reports Inbox", path: "/csManager/reports" },
  { type: "link", key: "cs-customers", label: "Customers", path: "/csManager/customers" },
  { type: "link", key: "cs-analytics", label: "Analytics", path: "/csManager/analytics" },
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
  noUser: "/",        // <— public landing
   work: "/dashboard", 
  customer: "/market", 
      // (or a role-specific landing if you want later)
};
