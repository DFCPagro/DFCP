// src/services/amsLine.builder.ts
import { Types } from "mongoose";
import type { Item } from "@/models/Item.model";

/** Tuning for conservative estimates */
export type UnitSafeConfig = {
  zScore?: number;        // default 1.28 (~90% one-sided)
  shrinkagePct?: number;  // default 0.02 (2% handling loss)
  bundle?: number;        // default 1 (e.g., eggs -> 12)
};

/** Integer, bundle-aligned, conservative units from available KG (inputs in GRAMS for avg/sd). */
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

  // conservative effective kg per unit
  const effKgPerUnit = (avgGr + z * sdGr) / 1000;
  const raw = Math.floor(availableKg / (effKgPerUnit * (1 + shrink)));

  // natural number & bundle aligned
  return Math.max(0, Math.floor(raw / bundle) * bundle);
}

/** Optional helper: derive UI per-unit price (not persisted on AMS). */
export function derivePricePerUnit(
  pricePerKg: number | null | undefined,
  avgGr: number | null | undefined,
  override?: number | null
) {
  if (override != null) return override;
  if (!pricePerKg || !avgGr) return null;
  return pricePerKg * (avgGr / 1000);
}

/** Decide "kg" | "unit" | "mixed" from sellModes; requires avg present for unit/mixed */
function decideUnitMode(item: any, avgGr?: number | null): "kg" | "unit" | "mixed" {
  const byUnit = !!item?.sellModes?.byUnit;
  const byKg = item?.sellModes?.byKg ?? true;
  const hasAvg = !!avgGr && avgGr > 0;

  if (byUnit && byKg && hasAvg) return "mixed";
  if (byUnit && hasAvg) return "unit";
  return "kg";
}

/**
 * Build a single AMS line ready to push into AvailableMarketStock.items[]
 * ALIGNED with your current AvailableStockItemSchema:
 *
 *  {
 *    itemId, displayName, imageUrl, category,
 *    pricePerUnit (per KG, legacy name),
 *    currentAvailableQuantityKg, originalCommittedQuantityKg,
 *    farmerOrderId, farmerID, farmerName, farmName, farmLogo,
 *    unitMode: "kg" | "unit" | "mixed",
 *    estimates: {
 *      avgWeightPerUnitKg?, sdKg?, availableUnitsEstimate?,
 *      unitBundleSize, zScore, shrinkagePct
 *    },
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
  committedKg: number;        // both original & current start at this value
  unitConfig?: UnitSafeConfig;// optional tuning for estimates
}) {
  const { item, farmer, committedKg, unitConfig } = params;

  // Canonical per-KG price from Item.price.a
  const pricePerKg = Number((item as any)?.price?.a ?? 0);

  // Unit stats from Item (GRAMS)
  const avgGr = (item as any)?.avgWeightPerUnitGr ?? null;
  const sdGr = (item as any)?.sdWeightPerUnitGr ?? 0;

  // Bundle from sellModes or fallback to config; always >= 1
  const unitBundleSize = Math.max(
    1,
    (item as any)?.sellModes?.unitBundleSize ?? unitConfig?.bundle ?? 1
  );

  // Unit mode strictly from sellModes; requires avg for unit/mixed
  const unitMode = decideUnitMode(item, avgGr);

  // Tuning knobs
  const zScore = unitConfig?.zScore ?? 1.28;
  const shrinkagePct = unitConfig?.shrinkagePct ?? 0.02;

  // Estimates block (store KG-based stats; convert grams → kg ONCE)
  const estimates: {
    avgWeightPerUnitKg?: number | null;
    sdKg?: number | null;
    availableUnitsEstimate?: number | null;
    unitBundleSize: number;
    zScore: number;
    shrinkagePct: number;
  } = {
    unitBundleSize,
    zScore,
    shrinkagePct,
  } as any;

  if (avgGr && avgGr > 0) {
    const avgKg = Math.round((avgGr / 1000) * 1000) / 1000;
    const sdKg = sdGr ? Math.round((sdGr / 1000) * 1000) / 1000 : 0;

    (estimates as any).avgWeightPerUnitKg = avgKg;
    (estimates as any).sdKg = sdKg;

    if (unitMode === "unit" || unitMode === "mixed") {
      (estimates as any).availableUnitsEstimate = conservativeUnitsFromKg(
        committedKg,
        avgGr,
        sdGr ?? 0,
        { zScore, shrinkagePct, bundle: unitBundleSize }
      );
    } else {
      (estimates as any).availableUnitsEstimate = null;
    }
  } else {
    // No avg known ⇒ keep unit estimates null (UI will fall back to KG)
    (estimates as any).avgWeightPerUnitKg = null;
    (estimates as any).sdKg = null;
    (estimates as any).availableUnitsEstimate = null;
  }

  return {
    itemId: new Types.ObjectId((item as any)._id),

    displayName:
      (item as any).variety
        ? `${(item as any).type} ${(item as any).variety}`
        : (item as any).type,
    imageUrl: (item as any).imageUrl ?? null,
    category: (item as any).category ?? "unknown",

    // ⚠️ AMS expects the per-KG price under "pricePerUnit" (legacy field name)
    pricePerUnit: pricePerKg,

    // Canonical inventory (KG)
    currentAvailableQuantityKg: committedKg,
    originalCommittedQuantityKg: committedKg,

    // Link to FO can be patched after FO is created
    farmerOrderId: null as any,
    farmerID: new Types.ObjectId(farmer.id),
    farmerName: farmer.name,
    farmName: farmer.farmName,
    farmLogo: farmer.farmLogo ?? null,

    unitMode,     // "kg" | "unit" | "mixed"
    estimates,    // with avgWeightPerUnitKg, sdKg, availableUnitsEstimate, unitBundleSize, zScore, shrinkagePct

    status: "active" as const,
  };
}

/**
 * OPTIONAL: For unit-based reservations, convert requested units → conservative KG to reserve.
 * Inputs avg/sd in GRAMS, uses same tuning as estimates.
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

  const effGr = cfg.avgWeightPerUnitGr + z * sd; // conservative grams per unit
  const kg = (unitsRounded * effGr) / 1000;
  return kg * (1 + shrink);
}
