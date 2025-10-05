// src/services/amsLine.builder.ts
import { Types } from "mongoose";
import type { Item } from "@/models/Item.model";

/**
 * Unit conversion & estimate config
 */
type UnitSafeConfig = {
  zScore?: number;        // default 1.28 (~90% one-sided)
  shrinkagePct?: number;  // default 0.02 (2% handling loss)
  bundle?: number;        // default 1 (e.g., eggs -> 12)
};

/**
 * Compute a conservative estimate of how many units you can sell
 * from the available KG, given avg/sd, z-score, shrink and bundle.
 */
function conservativeUnitsFromKg(
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
 * Derive unit price from price per KG and avg unit weight (grams).
 * If override is present, prefer it.
 */
function derivePricePerUnit(pricePerKg: number | null | undefined, avgGr: number | null | undefined, override?: number | null) {
  if (override != null) return override;
  if (!pricePerKg || !avgGr) return null;
  return pricePerKg * (avgGr / 1000);
}

/**
 * Build a single AMS "items" subdoc ready to push into AvailableMarketStock.items[]
 * NOTE: Aligns with your schema field names exactly.
 */
export function buildAmsItemFromItem(params: {
  item: Item; // populated Item document (or plain object with same fields)
  farmer: {
    id: string | Types.ObjectId;
    name: string;
    farmName: string;
    farmLogo?: string | null;
  };
  committedKg: number;
  unitConfig?: UnitSafeConfig; // optional tuning
}) {
  const { item, farmer, committedKg, unitConfig } = params;

  const pricePerKg = item?.price?.a ?? 0; // canonical per KG
  const byUnit = !!item?.sellModes?.byUnit;
  const bundle = Math.max(1, item?.sellModes?.unitBundleSize ?? 1);

  // Derive price per unit (fallback: set to pricePerKg just to satisfy required constraint)
  const derivedUnitPrice = derivePricePerUnit(pricePerKg, item?.avgWeightPerUnitGr ?? null, item?.pricePerUnitOverride ?? null);
  const requiredPricePerUnit = byUnit
    ? (derivedUnitPrice ?? pricePerKg) // if byUnit but we lack avg, fallback to kg price
    : pricePerKg;                      // if not byUnit, keep parity with kg price (schema requires number)

  // Base AMS item shape (matches your schema names)
  const amsLine = {
    itemId: new Types.ObjectId((item as any)._id),

    displayName: item.variety ? `${item.type} ${item.variety}` : item.type,
    imageUrl: item.imageUrl ?? null,
    category: item.category,

    pricePerKg: pricePerKg,
    pricePerUnit: requiredPricePerUnit,

    currentAvailableQuantityKg: committedKg,
    originalCommittedQuantityKg: committedKg,

    farmerOrderId: null, // fill later if linked

    farmerID: new Types.ObjectId(farmer.id),
    farmerName: farmer.name,
    farmName: farmer.farmName,
    farmLogo: farmer.farmLogo ?? undefined,

    // unitMode + estimates are additive (optional) – only when selling by unit and we have avg
    unitMode: undefined as
      | {
          enabled: boolean;
          unitBundleSize: number;
          avgWeightPerUnitGr: number | null;
          sdWeightPerUnitGr: number;
          pricePerUnit: number | null;
          zScore: number;
          shrinkagePct: number;
          minUnitStep: number;
        }
      | undefined,
    estimates: undefined as
      | {
          availableUnitsEstimate: number | null;
        }
      | undefined,

    status: "active" as const,
  };

  // If units are enabled, include unitMode & conservative estimate
  if (byUnit) {
    const avgGr = item?.avgWeightPerUnitGr ?? null;
    const sdGr = item?.sdWeightPerUnitGr ?? 0;
    const z = unitConfig?.zScore ?? 1.28;
    const shrink = unitConfig?.shrinkagePct ?? 0.02;

    amsLine.unitMode = {
      enabled: true,
      unitBundleSize: bundle,
      avgWeightPerUnitGr: avgGr,
      sdWeightPerUnitGr: sdGr,
      pricePerUnit: derivedUnitPrice, // may be null if avg missing
      zScore: z,
      shrinkagePct: shrink,
      minUnitStep: 1,
    };

    if (avgGr) {
      const estimate = conservativeUnitsFromKg(committedKg, avgGr, sdGr ?? 0, {
        zScore: z,
        shrinkagePct: shrink,
        bundle,
      });
      amsLine.estimates = { availableUnitsEstimate: estimate };
    }
  }

  return amsLine;
}

/**
 * OPTIONAL: For unit-based cart lines, convert requested units -> safe KG to reserve.
 * Use the same conservative math used for the estimate.
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
