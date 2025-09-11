import {
  FARMER_ORDER_STAGES,
  FARMER_ORDER_STAGE_KEYS,
  FARMER_ORDER_STAGE_LABELS,
  FarmerOrderStageKey,
} from "./stage.types";

export function buildFarmerOrderDefaultStages() {
  const now = new Date();
  return FARMER_ORDER_STAGES.map((s, idx) => ({
    key: s.key,
    label: s.label,
    status: idx === 0 ? "current" : "pending",
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

// Filter an array of stages by allowed keys (for role-based UIs)
export function filterStagesByKeys(stages: any[], allowed: FarmerOrderStageKey[]) {
  const set = new Set(allowed);
  return (stages || []).filter(s => set.has(s?.key));
}

// Convenience label getter
export function stageLabelFor(key: FarmerOrderStageKey) {
  return FARMER_ORDER_STAGE_LABELS[key];
}
