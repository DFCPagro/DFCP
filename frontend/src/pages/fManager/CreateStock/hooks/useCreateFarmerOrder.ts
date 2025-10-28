// src/pages/CreateStock/hooks/useCreateFarmerOrder.ts
// Creates a farmer order for a given AMS and inventory item.
// - Pure FE for now: inline FAKE call (no separate mock files).
// - Per-item submitting state so only the clicked row disables.
//
// TODO(real API): Replace FAKE_CREATE with a real POST:
//   POST /api/farmer-orders
//   body: { amsId, itemId, ... }
//   expect: { orderId, createdAtIso, ... }

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AsyncStatus,
  CreateFarmerOrderInput,
  CreateFarmerOrderResult,
} from "../types";

/* -----------------------------------------------------------------------------
 * FAKE create (inline)
 * ---------------------------------------------------------------------------*/

function randomHex(len = 8): string {
  return Array.from({ length: len })
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
}

async function FAKE_CREATE(
  input: CreateFarmerOrderInput
): Promise<CreateFarmerOrderResult> {
  // Simulate latency and success
  await new Promise((r) => setTimeout(r, 500));
  return {
    orderId: `FO_${randomHex(6)}_${input.itemId.slice(-6)}`,
    createdAtIso: new Date().toISOString(),
  };
}

/* -----------------------------------------------------------------------------
 * Hook
 * ---------------------------------------------------------------------------*/

export function useCreateFarmerOrder(amsId?: string) {
  // Per-item submitting set; components can call isSubmitting(itemId)
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CreateFarmerOrderResult | null>(
    null
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isSubmitting = useCallback(
    (itemId?: string) =>
      itemId ? submittingIds.has(itemId) : submittingIds.size > 0,
    [submittingIds]
  );

  const create = useCallback(
    async (input: { itemId: string } | CreateFarmerOrderInput) => {
      const payload: CreateFarmerOrderInput =
        "amsId" in input ? input : { amsId: amsId ?? "", itemId: input.itemId };

      if (!payload.amsId) {
        setError("Missing amsId");
        setStatus("error");
        return null;
      }
      if (!payload.itemId) {
        setError("Missing itemId");
        setStatus("error");
        return null;
      }

      // mark this item as submitting
      setSubmittingIds((prev) => new Set(prev).add(payload.itemId));
      setStatus("loading");
      setError(null);

      try {
        /* -------------------------------------------------------------------
         * TODO(real API):
         * const resp = await api.post<CreateFarmerOrderResult>("/api/farmer-orders", payload);
         * const result = resp.data;
         * ------------------------------------------------------------------*/
        const result = await FAKE_CREATE(payload);

        if (!mountedRef.current) return null;
        setLastResult(result);
        setStatus("success");
        return result;
      } catch (e: any) {
        if (!mountedRef.current) return null;
        setError(e?.message ?? "Failed to create farmer order");
        setStatus("error");
        return null;
      } finally {
        // clear submitting for this item
        setSubmittingIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.itemId);
          return next;
        });
      }
    },
    [amsId]
  );

  return {
    // Actions
    create, // (input) => Promise<CreateFarmerOrderResult | null>
    // State
    status, // "idle" | "loading" | "success" | "error"
    error, // string | null
    lastResult, // last success result (for toasts, badges)
    isSubmitting, // (itemId?) => boolean
    submittingCount: submittingIds.size, // useful for global spinners if needed
  } as const;
}
