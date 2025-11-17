// src/models/shared/stage.utils.ts
import {
  FARMER_ORDER_STAGES,
  FARMER_ORDER_STAGE_KEYS,
  FARMER_ORDER_STAGE_LABELS,
  type FarmerOrderStageKey,
  ORDER_STAGE_DEFS,
  ORDER_STAGE_KEYS,
  ORDER_STAGE_LABELS,
  type OrderStageKey,
  FARMER_DELIVERY_STAGES,
  FARMER_DELIVERY_STAGE_KEYS,
} from "./stage.types";

/* -------------------------------------------------------------------------- */
/*                            FarmerOrder helpers                              */
/* -------------------------------------------------------------------------- */

export function buildFarmerOrderDefaultStages() {
  const now = new Date();
  return FARMER_ORDER_STAGES.map((s, idx) => ({
    key: s.key,
    label: s.label,
    status: idx === 0 ? "current" : "pending", // first is current
    expectedAt: null,
    startedAt: idx === 0 ? now : null,
    completedAt: null,
    timestamp: now,
    note: "",
  }));
}

export function isFarmerOrderStageKey(k: any): k is FarmerOrderStageKey {
  return FARMER_ORDER_STAGE_KEYS.includes(k);
}

export function filterStagesByKeys(
  stages: any[],
  allowed: FarmerOrderStageKey[]
) {
  const set = new Set(allowed);
  return (stages || []).filter((s) => set.has(s?.key));
}

export function farmerOrderStageLabelFor(key: FarmerOrderStageKey) {
  return FARMER_ORDER_STAGE_LABELS[key];
}

/* -------------------------------------------------------------------------- */
/*                                Order helpers                               */
/* -------------------------------------------------------------------------- */

export function buildOrderDefaultStages() {
  const now = new Date();
  return ORDER_STAGE_DEFS.map((s, idx) => ({
    key: s.key,
    label: s.label,
    status: idx === 0 ? "current" : "pending", // first is current
    expectedAt: null,
    startedAt: idx === 0 ? now : null,
    completedAt: null,
    timestamp: now,
    note: "",
  }));
}

export function isOrderStageKey(k: any): k is OrderStageKey {
  return ORDER_STAGE_KEYS.includes(k);
}

export function orderStageLabelFor(key: OrderStageKey) {
  return ORDER_STAGE_LABELS[key];
}

/**
 * Utility: build the shape of a single stage object (matches .stages[] subdoc)
 * Used by ensureStageEntry() in the service.
 */
export function buildStageEntry(
  key: OrderStageKey,
  status: "pending" | "current" = "pending"
) {
  const now = new Date();
  return {
    key,
    label: ORDER_STAGE_LABELS[key] || key,
    status,
    expectedAt: null,
    startedAt: status === "current" ? now : null,
    completedAt: null,
    timestamp: now,
    note: "",
  };
}

/* -------------------------------------------------------------------------- */
/*                                FOrder deliveries helpers                               */
/* -------------------------------------------------------------------------- */

export function buildFarmerDeliveryDefaultStages() {
  return FARMER_DELIVERY_STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    status: s.key === "planned" ? "current" : "pending",
    expectedAt: null,
    startedAt: null,
    completedAt: null,
    timestamp: new Date(),
    note: "",
  }));
}