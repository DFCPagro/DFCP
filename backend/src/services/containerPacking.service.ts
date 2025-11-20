// src/services/containerPacking.service.ts
// Stateless container capacity engine — uses the same classification/density
// philosophy as packing.service, but focused on container capacity and
// "how many containers do we need for X kg?".

import type { ItemLite, ItemPackingOverride } from "./packing.service";

/* -------------------------------------------------------------------------- */
/*                                 Public types                               */
/* -------------------------------------------------------------------------- */

// Minimal view of ContainerSize for this stateless helper
export type ContainerSizeLite = {
  key: string;          // e.g. "CRATE_40x30x25"
  usableLiters: number; // ContainerSize.usableLiters
  maxWeightKg: number;  // ContainerSize.maxWeightKg
  name?: string;        // optional label for UI
  vented?: boolean;
};

// Farmer-order-style line: one item with an estimated/committed kg
export type FarmerOrderLineLite = {
  itemId: string;
  estimatedKg?: number | null; // planned/estimated kg
  committedKg?: number | null; // confirmed kg
};

export type ContainerCapacitySummary = {
  containerKey: string;
  containerName?: string;

  usableLiters: number;
  densityKgPerL: number;

  maxKgByVolume: number;       // liters * density
  maxKgByWeightLimit: number;  // container maxWeightKg
  limitingKg: number;          // min(volume-based, weight-based)
  limitingFactor: "weight" | "volume";

  approxMaxUnits?: number;     // if avgWeightPerUnitGr or unit-volume known
};

export type ContainerPlanLine = {
  itemId: string;
  itemName?: string;

  totalKg: number;                 // total kg in this farmer-order line
  containerKey: string;
  containerName?: string;

  capacityKgPerContainer: number;  // limitingKg for chosen container
  containersNeeded: number;
  limitingFactor: "weight" | "volume";
};

export type ContainerPlanForOrder = {
  lines: ContainerPlanLine[];
  totalContainers: number;
  warnings: string[];
};

// Convenience type when you just have "one item + one quantity"
export type ContainerEstimateForQuantity = {
  itemId: string;
  itemName?: string;
  quantityKg: number;

  containerKey: string;
  containerName?: string;
  containersNeeded: number;

  capacityKgPerContainer: number;
  limitingFactor: "weight" | "volume";
  approxMaxUnits?: number;
};

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ---------------------- Buckets & density (mirror packing) ---------------- */

// density by bucket (kg/L)
const DENSITY: Record<string, number> = {
  leafy: 0.15,
  herbs: 0.15,
  berries: 0.35,
  tomatoes: 0.6,
  cucumbers: 0.6,
  peppers: 0.6,
  apples: 0.65,
  citrus: 0.7,
  roots: 0.8,
  bundled: 0.5,
  generic: 0.5,
};

// fallback liters per single unit when we don't know avgWeightPerUnitGr
const UNIT_VOL_FALLBACK: Record<string, number> = {
  berries: 0.06,
  apples: 0.12,
  citrus: 0.12,
  tomatoes: 0.1,
  cucumbers: 0.1,
  peppers: 0.1,
  generic: 0.1,
};

function bucket(item: ItemLite): string {
  const t = (item.type || "").toLowerCase();
  const v = (item.variety || "").toLowerCase();
  const c = (item.category || "").toLowerCase();

  if (
    c.includes("leaf") ||
    ["lettuce", "spinach", "kale", "chard", "arugula"].some((x) =>
      t.includes(x)
    )
  )
    return "leafy";
  if (t.includes("herb")) return "herbs";

  if (
    t.includes("strawberry") ||
    t.includes("blueberry") ||
    v.includes("berry")
  )
    return "berries";

  if (t.includes("tomato")) return "tomatoes";
  if (t.includes("cucumber")) return "cucumbers";
  if (t.includes("pepper")) return "peppers";
  if (t.includes("apple")) return "apples";

  if (t.includes("orange") || t.includes("mandarin") || c.includes("citrus"))
    return "citrus";

  if (
    ["carrot", "potato", "beet", "root"].some(
      (x) => t.includes(x) || c.includes(x)
    )
  )
    return "roots";

  if (["egg", "bread", "milk"].some((x) => t.includes(x))) return "bundled";

  return "generic";
}

/* ------------------ Capacity for (item, container) pair ------------------ */

/**
 * For a given item + container, estimate how much of that item
 * can be put into that container, based on usable liters and density.
 */
export function estimateContainerCapacityForItem(
  item: ItemLite,
  container: ContainerSizeLite,
  overrides?: ItemPackingOverride
): ContainerCapacitySummary {
  const b = bucket(item);
  const densityKgPerL =
    overrides?.densityKgPerL ?? DENSITY[b] ?? DENSITY.generic;

  const usableLiters = container.usableLiters;
  const maxKgByVolume = round2(usableLiters * densityKgPerL);
  const maxKgByWeightLimit = container.maxWeightKg;

  const limitingKg = round2(
    Math.min(maxKgByVolume, maxKgByWeightLimit)
  );

  const limitingFactor: "weight" | "volume" =
    maxKgByWeightLimit < maxKgByVolume ? "weight" : "volume";

  // ---- approx max units (if item is unit-based) ----
  let approxMaxUnits: number | undefined;

  if (item.avgWeightPerUnitGr && item.avgWeightPerUnitGr > 0) {
    const kgPerUnit = item.avgWeightPerUnitGr / 1000;
    approxMaxUnits = Math.floor(limitingKg / kgPerUnit);
  } else {
    const bucketKey = b;
    const litersPerUnit =
      overrides?.unitVolLiters ??
      UNIT_VOL_FALLBACK[bucketKey] ??
      UNIT_VOL_FALLBACK.generic;

    if (litersPerUnit > 0) {
      approxMaxUnits = Math.floor(usableLiters / litersPerUnit);
    }
  }

  return {
    containerKey: container.key,
    containerName: container.name,
    usableLiters,
    densityKgPerL,
    maxKgByVolume,
    maxKgByWeightLimit,
    limitingKg,
    limitingFactor,
    approxMaxUnits,
  };
}

/**
 * Convenience: compute capacities for an item across multiple containers.
 */
export function estimateContainerCapacitiesForItem(
  item: ItemLite,
  containers: ContainerSizeLite[],
  overrides?: ItemPackingOverride
): ContainerCapacitySummary[] {
  return containers.map((c) =>
    estimateContainerCapacityForItem(item, c, overrides)
  );
}

/* -------------------- Planning for a FarmerOrder-like ------------------- */

/**
 * Pick a "best" container for a given item and totalKg.
 * Heuristic:
 *  - Filter capacities with limitingKg > 0
 *  - Prefer the smallest container that can hold the entire totalKg in one
 *    crate; if none, pick the container with largest capacity.
 */
function pickBestContainerForItem(
  capacities: ContainerCapacitySummary[],
  totalKg: number
): ContainerCapacitySummary | null {
  const viable = capacities.filter((c) => c.limitingKg > 0);
  if (!viable.length) return null;

  // Sort by capacity ascending
  viable.sort((a, b) => a.limitingKg - b.limitingKg);

  // First, try smallest container that fits all in one
  const singleFit = viable.find((c) => c.limitingKg >= totalKg);
  if (singleFit) return singleFit;

  // Otherwise, use the largest (we'll need multiple containers)
  return viable[viable.length - 1];
}

/**
 * Core: given multiple farmer-order-like lines, return containers per item.
 * This is useful if you ever aggregate farmer orders differently,
 * but it also works if you just pass a single line for one FarmerOrder.
 */
export function estimateContainersForFarmerOrderLines(
  lines: FarmerOrderLineLite[],
  itemsById: Record<string, ItemLite>,
  containers: ContainerSizeLite[],
  itemPackingById?: Record<string, ItemPackingOverride | undefined>
): ContainerPlanForOrder {
  const warnings: string[] = [];
  const outLines: ContainerPlanLine[] = [];

  if (!Array.isArray(containers) || containers.length === 0) {
    return {
      lines: [],
      totalContainers: 0,
      warnings: ["No container sizes configured."],
    };
  }

  for (const line of lines ?? []) {
    const item = itemsById[String(line.itemId)];
    if (!item) {
      warnings.push(`Item ${String(line.itemId)} not found; skipping.`);
      continue;
    }

    // Prefer committedKg, fall back to estimatedKg
    const totalKg = (line.committedKg ?? line.estimatedKg ?? 0) || 0;
    if (totalKg <= 0) continue;

    const overrides = itemPackingById?.[String(item._id)];
    const capacities = estimateContainerCapacitiesForItem(
      item,
      containers,
      overrides
    );

    const best = pickBestContainerForItem(capacities, totalKg);
    if (!best) {
      warnings.push(
        `No feasible container for item ${String(line.itemId)}.`
      );
      continue;
    }

    const capacityKgPerContainer = best.limitingKg;
    const containersNeeded =
      capacityKgPerContainer > 0
        ? Math.ceil(totalKg / capacityKgPerContainer)
        : 0;

    outLines.push({
      itemId: String(line.itemId),
      itemName: item.name,
      totalKg: round2(totalKg),
      containerKey: best.containerKey,
      containerName: best.containerName,
      capacityKgPerContainer,
      containersNeeded,
      limitingFactor: best.limitingFactor,
    });
  }

  const totalContainers = outLines.reduce(
    (sum, l) => sum + l.containersNeeded,
    0
  );

  return {
    lines: outLines,
    totalContainers,
    warnings,
  };
}

/* ---------------- Convenience: single quantity for one FarmerOrder ------- */

/**
 * Very simple helper for your current use-case:
 *
 *  - You already have a FarmerOrder (one item per FO).
 *  - You know which quantity to use (sumOrderedQuantityKg, forecastedQuantityKg, finalQuantityKg, etc.).
 *  - You just want: "how many containers do we need for THIS kg?"
 *
 * This does NOT touch the FarmerOrder model, it just returns a calculated response.
 */
export function estimateContainersForItemQuantity(
  item: ItemLite,
  quantityKg: number,
  containers: ContainerSizeLite[],
  overrides?: ItemPackingOverride
): ContainerEstimateForQuantity | null {
  const totalKg = quantityKg || 0;
  if (totalKg <= 0 || !containers.length) return null;

  const capacities = estimateContainerCapacitiesForItem(
    item,
    containers,
    overrides
  );
  const best = pickBestContainerForItem(capacities, totalKg);
  if (!best) return null;

  const containersNeeded =
    best.limitingKg > 0 ? Math.ceil(totalKg / best.limitingKg) : 0;

  return {
    itemId: String(item._id),
    itemName: item.name,
    quantityKg: round2(totalKg),
    containerKey: best.containerKey,
    containerName: best.containerName,
    containersNeeded,
    capacityKgPerContainer: best.limitingKg,
    limitingFactor: best.limitingFactor,
    approxMaxUnits: best.approxMaxUnits,
  };
}
