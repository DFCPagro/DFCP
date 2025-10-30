// src/utils/marketUnits.ts
export function avgPerUnitKg(it: any): number {
  return (
    Number(it?.estimates?.avgWeightPerUnitKg) ||
    Number(it?.avgWeightPerUnitKg) ||
    0.25
  );
}

export function effectiveUnitForItem(it: any, globalUnit: boolean): boolean {
  const raw = String(it?.unitMode ?? "").trim().toLowerCase(); // "unit" | "kg" | "mix"/""
  if (raw === "unit") return true;
  if (raw === "kg") return false;
  return globalUnit;
}

export function qtyToUnits(it: any, effUnit: boolean, qty: number): number {
  if (effUnit) return Math.max(1, Math.floor(qty)); // already units
  const per = avgPerUnitKg(it);
  if (!(per > 0)) return 1;
  return Math.max(1, Math.round(qty / per));       // kg → units
}

