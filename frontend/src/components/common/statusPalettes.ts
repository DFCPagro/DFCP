// src/components/statusPalettes.ts
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

// Label helper (keeps consistent human-friendly names)
export function labelOf(key: string): string {
  if (key === "in_progress") return "In progress";
  return key.charAt(0).toUpperCase() + key.slice(1);
}
