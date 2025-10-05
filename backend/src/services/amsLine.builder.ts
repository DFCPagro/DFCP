// src/services/amsLine.builder.ts
import { Types } from "mongoose";
import type { Item } from "@/models/Item.model";

/**
 * Unit conversion & estimate config
 */
export type UnitSafeConfig = {
  zScore?: number;        // default 1.28 (~90% one-sided)
  shrinkagePct?: number;  // default 0.02 (2% handling loss)
  bundle?: number;        // default 1 (e.g., eggs -> 12)
};

/**
 * Compute a conservative estimate of how many units you can sell
 * from the available KG, given avg/sd, z-score, shrink and bundle.
 */
export function conservativeUnitsFromKg(
  availableKg: number,
  avgGr: number,
  sdGr = 0,
  cfg: UnitSafeConfig = {}
) {
  if (!availableKg || !avgGr) return 0;
  const z = cfg.zScore ?? 1.28;
  const shrink = cfg.shrinkagePct ?? 0.02;
  const bundle = Math.max(1, cfg.bundle ?? 1);

  const effKgPerUnit = (avgGr + z * sdGr) / 1000;
  const est = Math.floor(availableKg / (effKgPerUnit * (1 + shrink)));
  return Math.max(0, Math.floor(est / bundle) * bundle);
}

/**
 * Derive price per unit from price per KG and avg unit weight (grams).
 * If override is present, prefer it. (Used for UI/reference; AMS stores per-KG price as pricePerUnit.)
 */
export function derivePricePerUnit(
  pricePerKg: number | null | undefined,
  avgGr: number | null | undefined,
  override?: number | null
) {
  if (override != null) return override;
  if (!pricePerKg || !avgGr) return null;
  return pricePerKg * (avgGr / 1000);
}

/**
 * Decide AMS unitMode ("kg" | "unit" | "mixed") based on item sellModes and heuristics
 */
function decideUnitMode(item: any, avgGr?: number | null): "kg" | "unit" | "mixed" {
  const byUnit = !!item?.sellModes?.byUnit;
  const byKg = item?.sellModes?.byKg ?? true;
  const hasAvg = !!avgGr && avgGr > 0;

  if (byUnit && byKg && hasAvg) return "mixed";
  if (byUnit && hasAvg) return "unit";
  return "kg";
}

/**
 * Build a single AMS "items" subdoc ready to push into AvailableMarketStock.items[]
 * SHAPE ALIGNED to AvailableStockItemSchema:
 *  {
 *    itemId, displayName, imageUrl, category,
 *    pricePerUnit (per KG),
 *    currentAvailableQuantityKg, originalCommittedQuantityKg,
 *    farmerOrderId, farmerID, farmerName, farmName, farmLogo,
 *    unitMode: "kg" | "unit" | "mixed",
 *    estimates: { avgWeightPerUnitKg?, stdDevKg?, availableUnitsEstimate? },
 *    status
 *  }
 */
export function buildAmsItemFromItem(params: {
  item: Item; // Item document (or plain object)
  farmer: {
    id: string | Types.ObjectId;
    name: string;
    farmName: string;
    farmLogo?: string | null;
  };
  committedKg: number;
  unitConfig?: UnitSafeConfig; // optional tuning for estimates
}) {
  const { item, farmer, committedKg, unitConfig } = params;

  // canonical per KG (your Item model)
  const pricePerKg = Number((item as any)?.price?.a ?? 0);

  // unit stats from Item (if present)
  const avgGr = (item as any)?.avgWeightPerUnitGr ?? null;
  const sdGr = (item as any)?.sdWeightPerUnitGr ?? 0;
  const bundle = Math.max(1, (item as any)?.sellModes?.unitBundleSize ?? unitConfig?.bundle ?? 1);

  // choose unitMode to match AMS schema
  const unitMode = decideUnitMode(item, avgGr);

  // estimates for AMS (match schema keys)
  const estimates: {
    avgWeightPerUnitKg?: number | null;
    stdDevKg?: number | null;
    availableUnitsEstimate?: number | null;
  } = {};

  if (avgGr && avgGr > 0) {
    estimates.avgWeightPerUnitKg = Math.round((avgGr / 1000) * 1000) / 1000;
    estimates.stdDevKg = sdGr ? Math.round((sdGr / 1000) * 1000) / 1000 : null;

    // conservative units only when units might be sold (unit/mixed)
    if (unitMode === "unit" || unitMode === "mixed") {
      const estUnits = conservativeUnitsFromKg(committedKg, avgGr, sdGr ?? 0, {
        zScore: unitConfig?.zScore ?? 1.28,
        shrinkagePct: unitConfig?.shrinkagePct ?? 0.02,
        bundle,
      });
      estimates.availableUnitsEstimate = estUnits;
    }
  } else {
    // no avg => keep only KG mode estimates empty
    if (unitMode !== "kg") {
      // fallback to KG if no avg weight is available
      // (you can keep "unit"/"mixed" if you want, but order service needs avg to convert)
    }
  }

  return {
    itemId: new Types.ObjectId((item as any)._id),

    displayName:
      (item as any).variety ? `${(item as any).type} ${(item as any).variety}` : (item as any).type,
    imageUrl: (item as any).imageUrl ?? null,
    category: (item as any).category ?? "unknown",

    // AMS expects per-KG under pricePerUnit
    pricePerUnit: pricePerKg,

    currentAvailableQuantityKg: committedKg,
    originalCommittedQuantityKg: committedKg,

    farmerOrderId: null as any, // fill after you create FarmerOrder
    farmerID: new Types.ObjectId(farmer.id),
    farmerName: farmer.name,
    farmName: farmer.farmName,
    farmLogo: farmer.farmLogo ?? null,

    unitMode, // "kg" | "unit" | "mixed"
    estimates, // { avgWeightPerUnitKg?, stdDevKg?, availableUnitsEstimate? }

    status: "active" as const,
  };
}

/**
 * OPTIONAL: For unit-based cart lines, convert requested units -> safe KG to reserve.
 * Uses the same conservative math as the estimate.
 */
export function kgNeededForUnits(units: number, cfg: {
  avgWeightPerUnitGr: number;
  sdWeightPerUnitGr?: number;
  zScore?: number;
  shrinkagePct?: number;
  unitBundleSize?: number;
}) {
  const bundle = Math.max(1, cfg.unitBundleSize ?? 1);
  const unitsRounded = Math.ceil(units / bundle) * bundle;

  const z = cfg.zScore ?? 1.28;
  const sd = cfg.sdWeightPerUnitGr ?? 0;
  const shrink = cfg.shrinkagePct ?? 0.02;

  const effGr = cfg.avgWeightPerUnitGr + z * sd;
  const kg = unitsRounded * (effGr / 1000);
  return kg * (1 + shrink);
}
