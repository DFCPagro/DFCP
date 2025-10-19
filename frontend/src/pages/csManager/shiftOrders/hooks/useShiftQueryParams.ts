// src/pages/csManager/shiftOrders/hooks/useShiftQueryParams.ts
import { useSearchParams } from "react-router-dom";

export function useShiftQueryParams() {
  const [sp] = useSearchParams();
  const date = sp.get("date") ?? "";      // yyyy-LL-dd
  const shiftName = sp.get("shift") ?? ""; // must match your ShiftName union

  return { date, shiftName };
}
