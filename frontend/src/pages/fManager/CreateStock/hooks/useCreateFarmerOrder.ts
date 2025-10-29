// src/pages/CreateStock/hooks/useCreateFarmerOrder.ts

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFarmerOrder } from "@/api/farmerOrders";
import type {
  CreateFarmerOrderRequest,
  FarmerOrderDTO,
} from "@/types/farmerOrders";

/**
 * Helper: build a stable composite key for a create request.
 * We use this to gate double-submits and to disable only the relevant row button.
 */
function makeKey(
  req: Pick<
    CreateFarmerOrderRequest,
    "itemId" | "farmerId" | "pickUpDate" | "shift"
  >
): string {
  // Structure: itemId:farmerId:pickUpDate:shift
  return `${req.itemId}:${req.farmerId}:${req.pickUpDate}:${req.shift}`;
}

export type UseCreateFarmerOrder = {
  /**
   * Create a farmer order.
   * @param req Exact backend contract:
   *  { itemId, farmerId, shift, pickUpDate (YYYY-MM-DD), forcastedQuantityKg }
   * @param opts Optional override for the pending key (e.g., if your UI has its own row id)
   */
  create: (
    req: CreateFarmerOrderRequest,
    opts?: { pendingKey?: string }
  ) => Promise<FarmerOrderDTO>;

  /** Returns true if a request for this key is in flight. */
  isSubmitting: (
    key:
      | string
      | Pick<
          CreateFarmerOrderRequest,
          "itemId" | "farmerId" | "pickUpDate" | "shift"
        >
  ) => boolean;

  /** Current set of pending keys (useful for debugging or list UIs). */
  pendingKeys: string[];

  /** Last successful result (for convenience). */
  lastResult: FarmerOrderDTO | null;

  /** Last error thrown by `create` (for convenience). */
  lastError: unknown;

  /** Clear lastResult/lastError. */
  reset: () => void;
};

/**
 * Production-ready hook for creating Farmer Orders.
 * - Uses the real API (`/farmer-orders`).
 * - Per-request "pending" is tracked by a composite key: itemId:farmerId:pickUpDate:shift
 * - No UI coupling (no toasts): caller decides how to present success/errors.
 */
export function useCreateFarmerOrder(): UseCreateFarmerOrder {
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [lastResult, setLastResult] = useState<FarmerOrderDTO | null>(null);
  const [lastError, setLastError] = useState<unknown>(null);

  // Track mounted to avoid setting state after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isSubmitting = useCallback<UseCreateFarmerOrder["isSubmitting"]>(
    (keyLike) => {
      const key = typeof keyLike === "string" ? keyLike : makeKey(keyLike);
      return pending.has(key);
    },
    [pending]
  );

  const pendingKeys = useMemo(() => Array.from(pending), [pending]);

  const reset = useCallback(() => {
    if (!mountedRef.current) return;
    setLastError(null);
    setLastResult(null);
  }, []);

  const create: UseCreateFarmerOrder["create"] = useCallback(
    async (req, opts) => {
      // Build or use supplied pending key
      const key = opts?.pendingKey ?? makeKey(req);

      if (pending.has(key)) {
        // Prevent duplicate in-flight requests for the same (itemId, farmerId, date, shift)
        throw new Error("A request for this row is already in progress.");
      }

      // Lightweight input validation (the API + zod will still validate thoroughly)
      if (!req.itemId) throw new Error("itemId is required.");
      if (!req.farmerId) throw new Error("farmerId is required.");
      if (!req.shift) throw new Error("shift is required.");
      if (!req.pickUpDate)
        throw new Error("pickUpDate is required (YYYY-MM-DD).");
      if (!Number.isFinite(req.forcastedQuantityKg)) {
        throw new Error("forcastedQuantityKg must be a finite number.");
      }

      // Mark as pending
      setPending((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      try {
        const result = await createFarmerOrder(req);
        if (mountedRef.current) {
          setLastResult(result);
          setLastError(null);
        }
        return result;
      } catch (err) {
        if (mountedRef.current) {
          setLastError(err);
        }
        throw err;
      } finally {
        // Clear pending
        if (mountedRef.current) {
          setPending((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }
    },
    [pending]
  );

  return {
    create,
    isSubmitting,
    pendingKeys,
    lastResult,
    lastError,
    reset,
  };
}

export default useCreateFarmerOrder;
