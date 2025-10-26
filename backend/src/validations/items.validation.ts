// src/validation/items.validation.ts

/**
 * Validates the incoming packing payload (shape + basic physics).
 * Returns a list of human-readable issues. Empty array = valid.
 */
export function validatePackingInput(p: any): string[] {
  const issues: string[] = [];

  if (!p || typeof p !== "object") return ["'packing' must be an object"];

  const required = [
    "bulkDensityKgPerL",
    "litersPerKg",
    "fragility",
    "allowMixing",
    "requiresVentedBox",
    "minBoxType",
  ] as const;

  for (const key of required) {
    if (!(key in p)) issues.push(`packing.${key} is required`);
  }

  if (p.bulkDensityKgPerL != null && !(typeof p.bulkDensityKgPerL === "number" && p.bulkDensityKgPerL > 0)) {
    issues.push("packing.bulkDensityKgPerL must be a number > 0");
  }

  if (p.litersPerKg != null && !(typeof p.litersPerKg === "number" && p.litersPerKg > 0)) {
    issues.push("packing.litersPerKg must be a number > 0");
  }

  if (p.fragility != null && !["very_fragile", "fragile", "normal", "sturdy"].includes(p.fragility)) {
    issues.push("packing.fragility must be one of very_fragile|fragile|normal|sturdy");
  }

  if (p.allowMixing != null && typeof p.allowMixing !== "boolean") {
    issues.push("packing.allowMixing must be boolean");
  }

  if (p.requiresVentedBox != null && typeof p.requiresVentedBox !== "boolean") {
    issues.push("packing.requiresVentedBox must be boolean");
  }

  if (p.minBoxType != null && typeof p.minBoxType !== "string") {
    issues.push("packing.minBoxType must be a string");
  }

  if (p.maxWeightPerBoxKg != null && !(typeof p.maxWeightPerBoxKg === "number" && p.maxWeightPerBoxKg > 0)) {
    issues.push("packing.maxWeightPerBoxKg must be a number > 0 when provided");
  }

  // Physics consistency: litersPerKg ≈ 1 / bulkDensityKgPerL (±8%)
  if (
    typeof p.bulkDensityKgPerL === "number" && p.bulkDensityKgPerL > 0 &&
    typeof p.litersPerKg === "number" && p.litersPerKg > 0
  ) {
    const expected = 1 / p.bulkDensityKgPerL;
    const relErr = Math.abs(p.litersPerKg - expected) / expected;
    if (relErr > 0.08) {
      issues.push("packing.litersPerKg should be close to 1 / packing.bulkDensityKgPerL (±8%)");
    }
  }

  return issues;
}


