import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GetFarmerOrderByShiftResponse } from "@/types/farmerOrders";
import { getFarmerOrderByShift } from "@/api/farmerOrders";
import { useQuery } from "@tanstack/react-query";
import { ShiftEnum, IsoDateString } from "@/types/shifts";
/* -----------------------------------------------------------------------------
 * Hook
 * ---------------------------------------------------------------------------*/

export function useShiftFarmerOrderInit(params: {
  date?: IsoDateString;
  shift?: ShiftEnum;
}) {
  const { date, shift } = params;
  console.log("info :", date, shift);
}
