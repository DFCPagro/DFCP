// src/pages/CreateStock/hooks/useFarmerInventory.ts
// Fetches the farmer inventory rows for a given AMS context (post-init).
// v1: inline FAKE fetch (no separate mock files), ignores pagination.
//
// TODO(real API): Replace FAKE_FETCH with a real GET:
//   GET /api/farmer-inventory?amsId=<id>&page=1&limit=... (or /:amsId)
//   Expect a payload compatible with FarmerInventoryResponse.
//
// Notes per product decisions:
// - "forecasted" is ignored for now.
// - We show farmer IDs as-is (no name lookup).
// - Disable submit button later based on `currentAvailableAmountKg <= 0` (component rule).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AsyncStatus,
  FarmerInventoryItem,
  FarmerInventoryResponse,
} from "../types";

/* -----------------------------------------------------------------------------
 * FAKE fetch (inline) — deterministic-ish from amsId for stable previews
 * ---------------------------------------------------------------------------*/

function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function isoPlusMinutes(baseIso: string, minutes: number): string {
  const d = new Date(baseIso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

async function FAKE_FETCH(amsId: string): Promise<FarmerInventoryResponse> {
  // Simulate latency
  await new Promise((r) => setTimeout(r, 400));

  // Build a few rows deterministically from the amsId
  const seed = djb2(amsId);
  const baseCreated = new Date("2025-10-24T10:00:00.000Z").toISOString();
  const baseUpdated = new Date("2025-10-24T10:15:00.000Z").toISOString();

  const count = (seed % 3) + 1; // 1..3 rows
  const rows: FarmerInventoryItem[] = Array.from({ length: count }).map(
    (_, i) => {
      const iSeed = seed + i * 97;
      const agreement = 200 + (iSeed % 200); // 200..399
      const available = Math.max(0, (iSeed % 180) - 20); // ~0..160 with some zeros
      const ids = [
        "66f7a1c0e5b6d9d7d1b1a111",
        "66f7a1c0e5b6d9d7d1b1a222",
        "66f7a1c0e5b6d9d7d1b1a333",
      ];
      const items = [
        "30eb71d9a20cb517be34112f",
        "30eb71d9a20cb517be341130",
        "30eb71d9a20cb517be341131",
      ];
      const farmerId = pick(ids, iSeed);
      const itemId = pick(items, iSeed >> 1);

      return {
        id: `${(iSeed % 0xffffffff).toString(16).padStart(8, "0")}${i}`,
        farmerId,
        itemId,
        logisticCenterId: "66e007000000000000000001",
        agreementAmountKg: agreement,
        currentAvailableAmountKg: available,
        createdAt: isoPlusMinutes(baseCreated, i * 3),
        updatedAt: isoPlusMinutes(baseUpdated, i * 5),
      };
    }
  );

  return {
    data: rows,
    page: 1,
    limit: 20,
    total: rows.length,
  };
}

/* -----------------------------------------------------------------------------
 * Hook
 * ---------------------------------------------------------------------------*/

export function useFarmerInventory(amsId?: string, opts?: { auto?: boolean }) {
  const auto = opts?.auto ?? true;

  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [items, setItems] = useState<FarmerInventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const lastAmsRef = useRef<string | undefined>(undefined);
  const inFlightRef = useRef(false);

  const hasAms = !!amsId;

  const fetchAll = useCallback(async () => {
    if (!amsId) {
      setError("Missing amsId");
      setStatus("error");
      return;
    }
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus("loading");
    setError(null);

    try {
      /* ---------------------------------------------------------------------
       * TODO(real API):
       * const resp = await api.get<FarmerInventoryResponse>(
       *   `/api/farmer-inventory?amsId=${encodeURIComponent(amsId)}&page=1&limit=1000`
       * );
       * const payload = resp.data;
       * const rows = payload.data ?? [];
       * --------------------------------------------------------------------*/
      const payload = await FAKE_FETCH(amsId);
      const rows = payload.data ?? [];

      if (!mountedRef.current) return;
      setItems(rows); // ignore pagination by product decision
      setStatus("success");
      lastAmsRef.current = amsId;
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e?.message ?? "Failed to load inventory");
      setStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  }, [amsId]);

  const refetch = useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Auto-fetch when amsId changes and auto=true
  useEffect(() => {
    if (!auto) return;
    if (!hasAms) return;
    if (lastAmsRef.current === amsId && status === "success") return;
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, hasAms, amsId]);

  const meta = useMemo(
    () => ({
      total: items.length,
      // Placeholder sort/filter metadata could go here later.
    }),
    [items.length]
  );

  return {
    status, // "idle" | "loading" | "success" | "error"
    items, // Flattened list (ignores pagination)
    error, // string | null
    refetch, // () => Promise<void>
    meta, // { total }
    isEmpty: status === "success" && items.length === 0,
    hasData: status === "success" && items.length > 0,
  } as const;
}
