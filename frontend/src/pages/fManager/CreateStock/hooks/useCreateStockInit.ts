import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InitPayload, InitResult, AsyncStatus } from "../types";
import type { Shift as ShiftEnum, IsoDateString } from "@/types/farmerOrders";
import { getFarmerOrdersSummary } from "@/api/farmerOrders";
import type {
  FarmerOrdersSummaryResponse,
  ShiftRollup,
} from "@/types/farmerOrders";

/** Stable key used to dedupe requests */
export function isShiftMissing(row: ShiftRollup | undefined | null): boolean {
  return !!row && row.count === 0;
}

export type UseManagerSummaryResult = {
  /** Raw server payload (or sensible empty defaults while loading). */
  data: FarmerOrdersSummaryResponse | null;

  /** The "current" shift (may exist with count===0). */
  current: ShiftRollup | null;

  /** Upcoming shifts array. */
  next: ShiftRollup[];

  /**
   * Missing shifts for Create Stock card:
   * All shifts (current + next) where count === 0.
   */
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

function makeKey(date?: IsoDateString, shift?: ShiftEnum): string | null {
  if (!date || !shift) return null;
  return `${date}::${shift}`;
}

/** Deterministic (but fake) AMS id generator from date+shift (for FE-only mocks) */
function fakeAmsIdFrom(date: IsoDateString, shift: ShiftEnum): string {
  // Simple DJB2 hash for stability in the FE without server calls.
  const str = `${date}|${shift}`;
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = (hash * 33) ^ str.charCodeAt(i);
  // Format to a 10-hex tail for readability
  const tail = (hash >>> 0).toString(16).padStart(8, "0");
  return `AMS_${date.replace(/-/g, "")}_${shift.slice(0, 2).toUpperCase()}_${tail}`;
}

/* -----------------------------------------------------------------------------
 * FAKE INIT CALL (inline)
 * ---------------------------------------------------------------------------*/
// NOTE: This simulates the network and server logic for now.
// Replace with your real API call when backend is ready.
async function FAKE_INIT_CALL(payload: InitPayload): Promise<InitResult> {
  const { date, shift } = payload;

  // Simulate a small latency
  await new Promise((r) => setTimeout(r, 450));

  // Stable AMS id for the same (date,shift) to mimic "found vs created"
  const amsId = fakeAmsIdFrom(date, shift);

  // We can't actually know "created" vs "found" without a server—return a
  // consistent boolean based on an arbitrary rule to exercise the UI:
  // even days => created=true; odd days => created=false
  const created = Number(date.slice(-2)) % 2 === 0; // purely to toggle chips/labels in UI

  return { amsId, created, date, shift };
}

/* -----------------------------------------------------------------------------
 * Hook
 * ---------------------------------------------------------------------------*/

export function useCreateStockInit(params: {
  date?: IsoDateString;
  shift?: ShiftEnum;
  /** If true (default), call init automatically when date+shift are present */
  auto?: boolean;
}) {
  const { date, shift, auto = true } = params;

  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [data, setData] = useState<InitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the last (date,shift) request key to dedupe in-flight or repeated calls
  const lastKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  const key = useMemo(() => makeKey(date, shift), [date, shift]);

  // Hard reset: clear everything (e.g., when changing selection)
  const reset = useCallback(() => {
    lastKeyRef.current = null;
    inFlightRef.current = false;
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  const init = useCallback(
    async (payload: InitPayload) => {
      const reqKey = makeKey(payload.date, payload.shift);
      if (!reqKey) {
        setError("Missing date or shift");
        setStatus("error");
        return null;
      }

      // Dedupe: if the same request is already finished with identical data, return it.
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
        /* -------------------------------------------------------------------
         * TODO(real API):
         * const resp = await api.post("/api/available-stock/init", payload);
         * const result: InitResult = {
         *   amsId: resp.data.amsId,
         *   created: resp.data.created,  // BE returns same shape for found/created
         *   date: payload.date,
         *   shift: payload.shift,
         * };
         * ------------------------------------------------------------------*/
        const result = await FAKE_INIT_CALL(payload);

        if (!mountedRef.current) return null; // avoid state updates post-unmount

        setData(result);
        setStatus("success");
        return result;
      } catch (e: any) {
        if (!mountedRef.current) return null;
        setError(e?.message ?? "Failed to initialize stock");
        setStatus("error");
        return null;
      } finally {
        inFlightRef.current = false;
      }
    },
    [data]
  );

  // Auto-run when query params provide date+shift and auto=true
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!auto) return;
    if (!date || !shift) return;

    const reqKey = makeKey(date, shift);
    if (!reqKey) return;

    // Avoid redundant calls if we already have data for the current key
    if (data && lastKeyRef.current === reqKey) return;

    void init({ date, shift });
  }, [auto, date, shift, init, data]);

  return {
    status, // "idle" | "loading" | "success" | "error"
    data, // InitResult | null
    error, // string | null
    init, // (payload) => Promise<InitResult | null>
    reset, // () => void
    // Useful for debugging/visibility in components:
    lastKey: lastKeyRef.current as string | null,
  } as const;
}
