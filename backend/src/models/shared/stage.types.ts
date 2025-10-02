// -------- Statuses (shared) --------
export const STAGE_STATUSES = ["pending", "ok", "current", "done", "problem"] as const;
/**
 * pending  = not started yet
 * ok       = approved/acknowledged (farmer or user)
 * current  = actively in this stage now
 * done     = completed; move to next
 */
export type StageStatus = (typeof STAGE_STATUSES)[number];

// -------- FarmerOrder stages (keys + labels + order) --------
export const FARMER_ORDER_STAGES = [
  { key: "farmerAck",      label: "Farmer Acknowledged" }, // stage 1
  { key: "farmerQSrep",    label: "Quality Check" },       // stage 2
  { key: "loadedToTruck",  label: "Loaded to Truck" },     // stage 3
  { key: "inTransit",      label: "In-Transit" },          // stage 4
  { key: "received",        label: "Received in LC" },      // stage 5 (spelling per your note)
  { key: "inspection",     label: "Inspection" },          // stage 6
  { key: "sorting",        label: "Sorting" },             // stage 7
  { key: "atWarehouse",    label: "Warehouse" },           // stage 8
] as const;

export type FarmerOrderStageKey = (typeof FARMER_ORDER_STAGES)[number]["key"];

// Quick lookup maps
export const FARMER_ORDER_STAGE_KEYS = FARMER_ORDER_STAGES.map(s => s.key) as ReadonlyArray<FarmerOrderStageKey>;
export const FARMER_ORDER_STAGE_LABELS: Record<FarmerOrderStageKey, string> =
  Object.fromEntries(FARMER_ORDER_STAGES.map(s => [s.key, s.label])) as any;

// -------- Role-based visibility groupings (for UI) --------
// admin: farm (stages 1-3), in-transit (4), received (5), inspection (6), warehouse (8)
export const FARMER_ORDER_STAGES_ADMIN: FarmerOrderStageKey[] = [
  "farmerAck", "farmerQSrep", "loadedToTruck", "inTransit", "received", "inspection", "atWarehouse",
];

// opManager: arrived(received), inspection, sorting, warehouse
export const FARMER_ORDER_STAGES_OPM: FarmerOrderStageKey[] = [
  "received", "inspection", "sorting", "atWarehouse",
];
