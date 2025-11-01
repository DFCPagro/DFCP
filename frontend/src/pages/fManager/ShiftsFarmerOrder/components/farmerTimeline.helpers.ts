// src/pages/ShiftFarmerOrder/helpers/farmerTimeline.helpers.ts

import {
  FARMER_ORDER_STAGE_KEYS,
  FARMER_ORDER_STAGE_LABELS,
  type FarmerOrderStageKey,
} from "@/types/farmerOrders";

/** UI state for a timeline step */
export type StepState = "done" | "current" | "upcoming";

/** Minimal shape of BE stage record (we keep it permissive to match current Zod `unknown`) */
export type RawStage =
  | {
      key?: string | null;
      label?: string | null;
      status?: "pending" | "current" | "done" | string | null;
      expectedAt?: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
      timestamp?: string | null;
      note?: string | null;
    }
  | Record<string, unknown>;

/** Normalized stage that the timeline consumes */
export type NormalizedStage = {
  key: FarmerOrderStageKey;
  label: string;
  status: "pending" | "current" | "done";
  expectedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  timestamp: string | null;
  note: string | null;
  /** the original raw object (useful for debugging / extra fields) */
  _raw?: RawStage;
};

/** A lightweight record as used by the row/timeline to resolve current stage */
export type StageCarrier = {
  stages?: RawStage[] | null;
  stageKey?: string | null; // BE sometimes sends this
};

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ensure we always return all 8 stages in BE order.
 * - If a BE stage exists, we normalize & take its label/status/timestamps.
 * - If a BE stage is missing (BE said it won’t, but we’re defensive), we synthesize a pending placeholder.
 */
export function normalizeStages(
  rawStages?: RawStage[] | null
): NormalizedStage[] {
  const byKey = new Map<string, RawStage>();
  for (const s of rawStages ?? []) {
    const k = (s as any)?.key;
    if (typeof k === "string" && k) byKey.set(k, s);
  }

  return FARMER_ORDER_STAGE_KEYS.map((key): NormalizedStage => {
    const raw = byKey.get(key);
    const rawStatus = (raw as any)?.status ?? "pending";
    const status = normalizeStatus(rawStatus);

    const label =
      ((raw as any)?.label as string | undefined) ??
      FARMER_ORDER_STAGE_LABELS[key];

    return {
      key,
      label,
      status,
      expectedAt: coerceNullableString((raw as any)?.expectedAt),
      startedAt: coerceNullableString((raw as any)?.startedAt),
      completedAt: coerceNullableString((raw as any)?.completedAt),
      timestamp: coerceNullableString((raw as any)?.timestamp),
      note: coerceNullableString((raw as any)?.note),
      _raw: raw,
    };
  });
}

/**
 * Decide which stage is "current".
 * Priority:
 *   1) Any normalized stage with status === "current"
 *   2) Provided `fallbackStageKey` (BE `stageKey`)
 *   3) The last stage that has `completedAt`
 *   4) The first stage that has `startedAt`
 *   5) The first stage in the flow
 */
export function deriveCurrentKey(
  normalized: NormalizedStage[],
  fallbackStageKey?: string | null
): FarmerOrderStageKey {
  // 1) explicit current
  const explicit = normalized.find((s) => s.status === "current");
  if (explicit) return explicit.key;

  // 2) BE stageKey
  if (fallbackStageKey) {
    const k = toStageKeyOrNull(fallbackStageKey);
    if (k) return k;
  }

  // 3) last completed
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (normalized[i].completedAt) return normalized[i].key;
  }

  // 4) first started
  const started = normalized.find((s) => s.startedAt);
  if (started) return started.key;

  // 5) default first
  return FARMER_ORDER_STAGE_KEYS[0];
}

/** Map current vs step to UI state */
export function stepState(
  currentKey: FarmerOrderStageKey,
  stepKey: FarmerOrderStageKey
): StepState {
  const ci = FARMER_ORDER_STAGE_KEYS.indexOf(currentKey);
  const si = FARMER_ORDER_STAGE_KEYS.indexOf(stepKey);
  if (si < 0 || ci < 0) return "upcoming";
  if (si < ci) return "done";
  if (si === ci) return "current";
  return "upcoming";
}

/** Label resolution: prefer normalized stage label, else fallback table */
export function labelFor(
  key: FarmerOrderStageKey,
  normalized?: NormalizedStage[]
): string {
  const fromList = normalized?.find((s) => s.key === key)?.label;
  return fromList ?? FARMER_ORDER_STAGE_LABELS[key] ?? key;
}

/** Next stage key or null if already the last stage */
export function nextStageKey(
  currentKey: FarmerOrderStageKey
): FarmerOrderStageKey | null {
  const idx = FARMER_ORDER_STAGE_KEYS.indexOf(currentKey);
  if (idx < 0 || idx >= FARMER_ORDER_STAGE_KEYS.length - 1) return null;
  return FARMER_ORDER_STAGE_KEYS[idx + 1];
}

/**
 * High-level helper the Timeline can call with a row:
 *  - normalizes stages
 *  - figures out current based on rules
 *  - returns everything needed to render & advance
 */
export function prepareTimelineModel(row: StageCarrier): {
  normalized: NormalizedStage[];
  currentKey: FarmerOrderStageKey;
  nextKey: FarmerOrderStageKey | null;
} {
  const normalized = normalizeStages(row.stages);
  const currentKey = deriveCurrentKey(normalized, row.stageKey);
  const nextKey = nextStageKey(currentKey);
  return { normalized, currentKey, nextKey };
}

/* -------------------------------------------------------------------------- */
/*                                  Internals                                 */
/* -------------------------------------------------------------------------- */

function normalizeStatus(
  raw: string | null | undefined
): "pending" | "current" | "done" {
  const v = (raw ?? "").toLowerCase();
  if (v === "current") return "current";
  if (v === "done" || v === "completed") return "done";
  // treat anything else (including unknowns) as pending
  return "pending";
}

function coerceNullableString(v: unknown): string | null {
  if (v == null) return null;
  return typeof v === "string" ? v : String(v);
}

function toStageKeyOrNull(v: unknown): FarmerOrderStageKey | null {
  if (typeof v !== "string") return null;
  return FARMER_ORDER_STAGE_KEYS.includes(v as FarmerOrderStageKey)
    ? (v as FarmerOrderStageKey)
    : null;
}
