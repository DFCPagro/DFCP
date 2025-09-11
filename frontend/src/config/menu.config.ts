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
] as const;

const workAdmin: ReadonlyArray<MenuItem> = [
  {
    type: "group",
    key: "mgr-orders",
    label: "Orders",
    children: [
      { type: "link", key: "mgr-orders-report", label: "Orders Report", path: "/manager/orders/report" },
      { type: "link", key: "mgr-orders-active", label: "Active Orders", path: "/manager/orders/active" },
      { type: "link", key: "mgr-orders-history", label: "Order History", path: "/manager/orders/history" },
    ],
  },
  {
    type: "group",
    key: "mgr-logistics",
    label: "Logistics",
    children: [
      { type: "link", key: "mgr-containers", label: "Containers", path: "/manager/containers" },
      { type: "link", key: "mgr-shipments", label: "Shipments", path: "/manager/shipments" },
      { type: "link", key: "mgr-aggregations", label: "Aggregations", path: "/manager/aggregations" },
    ],
  },
  {
    type: "group",
    key: "mgr-confirm",
    label: "Confirmations",
    children: [
      { type: "link", key: "mgr-arrival-confirm", label: "Arrival Confirm", path: "/manager/confirm/arrival" },
      { type: "link", key: "mgr-customer-confirm", label: "Customer Confirm", path: "/manager/confirm/customer" },
    ],
  },
] as const;

const workDeliverer: ReadonlyArray<MenuItem> = [
  { type: "link", key: "drv-schedule", label: "Schedule", path: "/deliverer/schedule", exact: true },
  { type: "link", key: "drv-today", label: "Today", path: "/deliverer/schedule/today" },
  { type: "link", key: "drv-upcoming", label: "Upcoming", path: "/deliverer/schedule/upcoming" },
  { type: "link", key: "drv-month", label: "Month View", path: "/deliverer/schedule/month" },
] as const;

/* ------------------------ Registry export ------------------------ */

export const MENUS: MenuRegistry = {
  noUser: noUserMenu,
  customer: customerMenu,
  work: {
    farmer: workFarmer,
    manager: workAdmin,
    deliverer: workDeliverer,
    industrialDeliverer: workDeliverer,
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
  customer: "/market", 
  work: "/work",      // (or a role-specific landing if you want later)
};
