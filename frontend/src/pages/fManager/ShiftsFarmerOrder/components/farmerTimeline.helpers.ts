import type {} from "react"; // keeps TS isolated from React; remove if unused

// --- Try to reuse your shared types if available ---

export type FarmerOrderStage =
  | "pending"
  | "assigned"
  | "accepted"
  | "checked_in"
  | "weighed"
  | "packed"
  | "ready_for_pickup"
  | "delivered"
  | "problem"
  | "cancelled"
  | (string & {});

export const FARMER_FLOW: readonly FarmerOrderStage[] = [
  "pending",
  "assigned",
  "accepted",
  "checked_in",
  "weighed",
  "packed",
  "ready_for_pickup",
  "delivered",
] as const;

/** Human-readable labels (used in step chips / tooltips). Extend as needed. */
export const FARMER_STAGE_LABEL: Partial<Record<FarmerOrderStage, string>> = {
  pending: "Pending",
  assigned: "Assigned",
  accepted: "Accepted",
  checked_in: "Checked-in",
  weighed: "Weighed",
  packed: "Packed",
  ready_for_pickup: "Ready",
  delivered: "Delivered",
  problem: "Problem",
  cancelled: "Cancelled",
};

/** Internal: index lookup for the linear rail. Unknown → -1. */
const FLOW_INDEX: Record<string, number> = FARMER_FLOW.reduce<
  Record<string, number>
>((acc, s, i) => {
  acc[s] = i;
  return acc;
}, {});

/**
 * Returns the index of a stage within the linear rail.
 * Unknown stages return -1 (consumer should treat as "current" with special color if desired).
 */
export function stageIndex(stage: FarmerOrderStage): number {
  return FLOW_INDEX[stage] ?? -1;
}

/**
 * Whether `step` is already completed given the current stage.
 * - If current is a known stage, "done" means index(step) < index(current).
 * - If current is terminal "cancelled" or "problem", nothing is “done”; the marker sits on the terminal.
 * - If current is unknown (index -1), nothing is “done”.
 */
export function isDone(
  current: FarmerOrderStage,
  step: FarmerOrderStage
): boolean {
  if (current === "cancelled" || current === "problem") return false;
  const ci = stageIndex(current);
  const si = stageIndex(step);
  if (ci < 0 || si < 0) return false;
  return si < ci;
}

/**
 * Whether `step` is the current stage.
 * - If current is a terminal ("problem" | "cancelled"), we return false for all rail steps;
 *   consumer should render a separate red marker for terminal state or apply red to the current chip.
 * - If current is unknown (not in the rail), we return false for all.
 */
export function isCurrent(
  current: FarmerOrderStage,
  step: FarmerOrderStage
): boolean {
  if (current === "cancelled" || current === "problem") return false;
  const ci = stageIndex(current);
  const si = stageIndex(step);
  return ci >= 0 && si >= 0 && ci === si;
}

/**
 * Whether `step` is upcoming (to the right of current).
 * - If current is terminal or unknown, everything is upcoming=false.
 */
export function isUpcoming(
  current: FarmerOrderStage,
  step: FarmerOrderStage
): boolean {
  if (current === "cancelled" || current === "problem") return false;
  const ci = stageIndex(current);
  const si = stageIndex(step);
  if (ci < 0 || si < 0) return false;
  return si > ci;
}

/**
 * Helper to derive a compact per-step UI state label for classnames:
 * - "done" | "current" | "upcoming"
 * - Terminals ("problem" | "cancelled") are NOT mapped here (return "upcoming" for all);
 *   let the consumer show a red marker independently when current is terminal.
 */
export function stepState(
  current: FarmerOrderStage,
  step: FarmerOrderStage
): "done" | "current" | "upcoming" {
  if (isCurrent(current, step)) return "current";
  if (isDone(current, step)) return "done";
  return "upcoming";
}

/**
 * Should the consumer render a red marker?
 * - Yes when the current stage is either a terminal ("problem" | "cancelled")
 *   OR when it’s a valid rail step (we still want a red accent on current, per requirements).
 * Consumers can use this to decide whether to paint the current chip/marker red.
 */
export function shouldMarkRed(current: FarmerOrderStage): boolean {
  if (current === "problem" || current === "cancelled") return true;
  return stageIndex(current) >= 0;
}

/**
 * Utility to get a friendly label for any stage.
 * Falls back to the raw string if not in the label map.
 */
export function labelFor(stage: FarmerOrderStage): string {
  return FARMER_STAGE_LABEL[stage] ?? stage;
}
