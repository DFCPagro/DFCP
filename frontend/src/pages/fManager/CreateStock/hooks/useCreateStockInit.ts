import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InitPayload, InitResult, AsyncStatus } from "../types";
import type {
  Shift as ShiftEnum,
  IsoDateString,
  FarmerOrdersSummaryResponse,
  ShiftRollup,
} from "@/types/farmerOrders";
import { getFarmerOrdersSummary } from "@/api/farmerOrders";
import { useQuery } from "@tanstack/react-query";
import { initAvailableStock } from "@/api/availableStock";

/** Build a stable key for deduping requests */
function makeKey(
  date?: IsoDateString,
  shift?: ShiftEnum,
  LCid?: string
): string | null {
  if (!date || !shift || !LCid) return null;
  return `${LCid}::${date}::${shift}`;
}

/* -----------------------------------------------------------------------------
 * Hook
 * ---------------------------------------------------------------------------*/

export function useCreateStockInit(params: {
  LCid?: string; // ✅ required by backend (explicit)
  date?: IsoDateString;
  shift?: ShiftEnum;
  /** If true (default), call init automatically when LCid+date+shift are present */
  auto?: boolean;
}) {
  const { LCid, date, shift, auto = true } = params;

  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [data, setData] = useState<InitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the last (LCid,date,shift) request key to dedupe in-flight or repeated calls
  const lastKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  const key = useMemo(() => makeKey(date, shift, LCid), [LCid, date, shift]);

  // Hard reset: clear everything (e.g., when changing selection)
  const reset = useCallback(() => {
    lastKeyRef.current = null;
    inFlightRef.current = false;
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  const init = useCallback(
    async (payload: InitPayload & { LCid?: string }) => {
      const { date: pDate, shift: pShift } = payload;
      const pLCid = payload.LCid ?? LCid;

      // Validate required inputs
      if (!pLCid || !pDate || !pShift) {
        setError("Missing LCid, date, or shift");
        setStatus("error");
        return null;
      }

      const reqKey = makeKey(pDate, pShift, pLCid);
      if (!reqKey) {
        setError("Invalid request key");
        setStatus("error");
        return null;
      }

      // Dedupe: if we already have data for this key, return it
      if (data && lastKeyRef.current === reqKey) {
        return data;
      }

      // Prevent concurrent duplicates.
      if (inFlightRef.current && lastKeyRef.current === reqKey) {
        return null; // caller can rely on status/loading
      }

      inFlightRef.current = true;
      lastKeyRef.current = reqKey;
      setStatus("loading");
      setError(null);

      try {
        // ✅ Real API call aligned to YAML: { LCid, date, shift }
        const amsDoc = await initAvailableStock({
          LCid: pLCid,
          date: pDate,
          shift: pShift as any, // api Shift matches [morning|afternoon|evening]
        });

        if (!mountedRef.current) return null;

        // Map API result to the FE InitResult expected by the page
        const result: InitResult = {
          amsId: amsDoc.id,
          // YAML/endpoint does not indicate "created vs found"; default to false.
          // If backend later adds a flag/header, swap this line to reflect it.
          created: false,
          date: (amsDoc.availableDate as IsoDateString) ?? pDate,
          shift: (amsDoc.availableShift as ShiftEnum) ?? pShift,
        };

        setData(result);
        setStatus("success");
        return result;
      } catch (e: any) {
        if (!mountedRef.current) return null;
        setError(e?.message ?? "Failed to initialize available stock");
        setStatus("error");
        return null;
      } finally {
        inFlightRef.current = false;
      }
    },
    [LCid, data]
  );

  // Mount/unmount guard
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-run when params provide LCid+date+shift and auto=true
  useEffect(() => {
    if (!auto) return;
    if (!LCid || !date || !shift) return;

    const reqKey = makeKey(date, shift, LCid);
    if (!reqKey) return;

    // Avoid redundant calls if we already have data for the current key
    if (data && lastKeyRef.current === reqKey) return;

    void init({ LCid, date, shift });
  }, [auto, LCid, date, shift, init, data]);

  return {
    status, // "idle" | "loading" | "success" | "error"
    data, // InitResult | null
    error, // string | null
    init, // (payload) => Promise<InitResult | null>
    reset, // () => void
    lastKey: lastKeyRef.current as string | null,
    // Expose the computed key for the current LCid+date+shift (useful for debugging)
    key,
  } as const;
}

export function isShiftMissing(row: ShiftRollup | undefined | null): boolean {
  return !!row && row.count === 0;
}

export type UseManagerSummaryResult = {
  /** Raw server payload (or sensible empty defaults while loading). */
  data: FarmerOrdersSummaryResponse | null;

  missingShifts: ShiftRollup[];

  /** Time zone / LC echoed by the backend (optional for UI). */
  tz: string | null;
  lc: string | null;

  /** React Query state */
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
};

export function useManagerSummary(): UseManagerSummaryResult {
  const query = useQuery({
    queryKey: ["farmerOrders", "summary"],
    queryFn: getFarmerOrdersSummary,
    staleTime: 30_000, // cache briefly; summary changes within minutes, not seconds
  });

  const data = query.data ?? null;
  const next = data?.next ?? [];

  const missingShifts = useMemo<ShiftRollup[]>(
    () => next.filter((r) => r.count === 0),
    [next]
  );

  return {
    data,
    missingShifts,
    tz: data?.tz ?? null,
    lc: data?.lc ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: !!query.error,
    error: query.error ?? null,
    refetch: query.refetch as unknown as () => Promise<unknown>,
  };
}
