// src/hooks/useUnitPref.ts
import { useEffect, useState, useCallback } from "react";
import { readUnit, writeUnit, type UnitMode, syncUnitFromUrl } from "@/utils/unitPref";

export function useUnitPref(search?: string) {
  const [unit, setUnit] = useState<UnitMode>(() => readUnit());
  useEffect(() => {
    if (search) {
      syncUnitFromUrl(search);
      setUnit(readUnit());
    }
  }, [search]);
  const set = useCallback((u: UnitMode) => {
    writeUnit(u);
    setUnit(u);
  }, []);
  return { unit, setUnit: set, toggle: () => set(unit === "unit" ? "kg" : "unit") };
}
