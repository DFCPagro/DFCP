// src/models/shared/stage.types.ts

// -------- Stage status values (shared across entities) --------
export const STAGE_STATUSES = ["pending", "ok", "current", "done", "problem"] as const;
/**
 * pending  = not started yet
 * ok       = acknowledged / no problem
 * current  = actively in progress now
 * done     = completed, move to next
 * problem  = flagged / needs attention
 */
export type StageStatus = (typeof STAGE_STATUSES)[number];

// -------- FarmerOrder stages (keys + labels + order) --------
export const FARMER_ORDER_STAGES = [
  { key: "farmerAck",     label: "Farmer Acknowledged" }, // 1
  { key: "farmerQSrep",   label: "Quality Check" },       // 2
  { key: "loadedToTruck", label: "Loaded to Truck" },     // 3
  { key: "inTransit",     label: "In-Transit" },          // 4
  { key: "recieved",      label: "Received in LC" },      // 5
  { key: "inspection",    label: "Inspection" },          // 6
  { key: "sorting",       label: "Sorting" },             // 7
  { key: "atWarehouse",   label: "Warehouse" },           // 8
] as const;

export type FarmerOrderStageKey = (typeof FARMER_ORDER_STAGES)[number]["key"];

export const FARMER_ORDER_STAGE_KEYS = FARMER_ORDER_STAGES.map(
  (s) => s.key
) as ReadonlyArray<FarmerOrderStageKey>;

export const FARMER_ORDER_STAGE_LABELS: Record<FarmerOrderStageKey, string> =
  Object.fromEntries(FARMER_ORDER_STAGES.map((s) => [s.key, s.label])) as any;

// -------- FarmerOrder role groupings for UI --------
export const FARMER_ORDER_STAGES_ADMIN: FarmerOrderStageKey[] = [
  "farmerAck",
  "farmerQSrep",
  "loadedToTruck",
  "inTransit",
  "recieved",
  "inspection",
  "atWarehouse",
];

export const FARMER_ORDER_STAGES_OPM: FarmerOrderStageKey[] = [
  "recieved",
  "inspection",
  "sorting",
  "atWarehouse",
];

// -------- Customer Order stages (the pipeline of the whole order) --------
// this replaces your ORDER_STAGES_KEYS / ORDER_STAGES array
export const ORDER_STAGE_DEFS = [
  { key: "pending",            label: "Pending" },
  { key: "confirmed",          label: "Confirmed" },
  { key: "farmer",             label: "Farmer Sourcing" },
  { key: "in-transit",         label: "In Transit to LC" },
  { key: "packing",            label: "Packing" },
  { key: "ready_for_pickUp",   label: "Ready for Pickup" },
  { key: "out_for_delivery",   label: "Out for Delivery" },
  { key: "delivered",          label: "Delivered" },
  { key: "received",           label: "Received by Customer" },
  { key: "canceled",           label: "Canceled" },
] as const;

export type OrderStageKey = (typeof ORDER_STAGE_DEFS)[number]["key"];

export const ORDER_STAGE_KEYS = ORDER_STAGE_DEFS.map(
  (s) => s.key
) as ReadonlyArray<OrderStageKey>;

export const ORDER_STAGE_LABELS: Record<OrderStageKey, string> =
  Object.fromEntries(ORDER_STAGE_DEFS.map((s) => [s.key, s.label])) as any;
