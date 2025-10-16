// src/pages/csManager/Orders/hooks/useCSOrderFilters.ts
import { useMemo, useState } from "react";

export type ShiftName = "Morning" | "Afternoon" | "Evening" | "Night";
export const SHIFT_OPTIONS: ShiftName[] = ["Morning", "Afternoon", "Evening", "Night"];

const isISODate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function useCSOrderFilters() {
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchDate, setSearchDate] = useState<string>("");
  const [searchShift, setSearchShift] = useState<ShiftName | "">("");

  const exactValid = useMemo(
    () => (!!searchDate && isISODate(searchDate) && !!searchShift),
    [searchDate, searchShift]
  );

  return {
    fromDate, toDate, searchDate, searchShift,
    setFromDate, setToDate, setSearchDate, setSearchShift,
    exactValid,
  };
}
