// -----------------------
// PICKER Tasks
// -----------------------
export type StatusKeyPickerTask =
  | "total"
  | "open"
  | "ready"
  | "claimed"
  | "in_progress"
  | "problem"
  | "cancelled"
  | "done";

export const STATUS_BASE_COLOR: Record<StatusKeyPickerTask, string> = {
  total: "grey",
  open: "gray",
  ready: "green",
  claimed: "teal",
  in_progress: "purple",
  problem: "red",
  cancelled: "orange",
  done: "blue",
};

// -----------------------
// FARMER DELIVERY 
// -----------------------
export type StatusKeyFarmerDelivery =
  | "planned"
  | "in_progress"
  | "completed"
  | "canceled"
  | "problem";

export const FARMER_DELIVERY_STATUS_COLOR: Record<
  StatusKeyFarmerDelivery,
  string
> = {
  planned: "blue",
  in_progress: "purple",
  completed: "green",
  canceled: "orange",
  problem: "red",
};

// -----------------------
// Label helper
// -----------------------
export function labelOf(key: string): string {
  if (key === "in_progress") return "In progress";

  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
