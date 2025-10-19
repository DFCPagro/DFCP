// src/pages/checkout/hooks/useCheckoutState.ts
import { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  getCart as getSharedCart,
  setCart as setSharedCart,
  clearCart as clearSharedCart,
  subscribeCart,
} from "@/utils/marketCart.shared";
import type { CartLine as SharedCartLine } from "@/utils/marketCart.shared";

import { AddressSchema, type Address } from "@/types/address";

/* -----------------------------------------------------------------------------
 * Types
 * -------------------------------------------------------------------------- */

export type CheckoutContext = {
  /** Region / AMS id */
  amsId: string | null;
  /** Logistics center id */
  logisticsCenterId: string | null;
  /** ISO yyyy-mm-dd */
  deliveryDate: string | null;
  /** e.g., "morning" | "afternoon" | "night" */
  shiftName: string | null;

  /** Optional: if you later resolve the human labels, keep placeholders here */
  amsLabel?: string | null;
  logisticsCenterLabel?: string | null;

  /** Optional address object if you decide to resolve it in Checkout */
  address: Address | null;
};

export type PreflightState = {
  hasCart: boolean;
  hasDeliveryDate: boolean;
  hasShift: boolean;
  hasAmsId: boolean;
  hasLogisticsCenterId: boolean;
  hasAddress: boolean;
  /** All checks passed */
  ok: boolean;
};

export type MoneyTotals = {
  itemCount: number;
  subtotal: number; // numeric only; format at render-time
};

export type UseCheckoutState = {
  context: CheckoutContext;
  cartLines: SharedCartLine[];
  totals: MoneyTotals;
  preflight: PreflightState;
  actions: {
    /** Clears the shared cart (all tabs/pages) */
    clear: () => void;
    /** Re-reads the cart from storage (useful after external changes) */
    refresh: () => void;
  };
};

/* -----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

function parseParams(search: string): CheckoutContext {
  const qs = new URLSearchParams(search);
  // console.log("parseParams", { search });
  const amsId = (qs.get("amsId") || "").trim() || null;
  const logisticsCenterId = (qs.get("logisticsCenterId") || "").trim() || null;

  // Normalize date to yyyy-mm-dd (basic guard)
  const rawDate = (qs.get("deliveryDate") || "").trim();
  const deliveryDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : rawDate
      ? new Date(rawDate).toISOString().slice(0, 10)
      : null;

  // shift param in URL → shiftName in context
  const shiftParam = (qs.get("shift") || "").trim();
  const shiftName = shiftParam || null;

  // NEW: addressJson → Address (validated/normalized)
  let address: Address | null = null;
  const rawAddressJson = qs.get("addressJson");
  if (rawAddressJson) {
    try {
      const parsed = JSON.parse(rawAddressJson);
      const res = AddressSchema.safeParse(parsed);
      if (res.success) {
        address = res.data;
      } else {
        console.warn("parseParams: invalid addressJson", res.error);
      }
    } catch (e) {
      console.warn("parseParams: failed to parse addressJson", e);
    }
  }

  return {
    amsId,
    logisticsCenterId,
    deliveryDate,
    shiftName,
    amsLabel: null,
    logisticsCenterLabel: null,
    address,
  };
}

function computeTotals(lines: SharedCartLine[]): MoneyTotals {
  const subtotal = Number(
    lines
      .reduce((sum, l) => {
        const p = Number(l?.pricePerUnit ?? 0) || 0;
        const q = Number(l?.quantity ?? 0) || 0;
        return sum + p * q;
      }, 0)
      .toFixed(2)
  );
  // keep your existing UI meaning for itemCount (sum of quantities)
  const itemCount = lines.reduce(
    (n, l) => n + (Number(l?.quantity ?? 0) || 0),
    0
  );
  return { itemCount, subtotal };
}

function computePreflight(
  ctx: CheckoutContext,
  lines: SharedCartLine[]
): PreflightState {
  const hasCart = lines.length > 0 && lines.some((l) => (l.quantity ?? 0) > 0);
  const hasDeliveryDate = !!ctx.deliveryDate;
  const hasShift = !!ctx.shiftName;
  const hasAmsId = !!ctx.amsId;
  const hasLogisticsCenterId = !!ctx.logisticsCenterId;
  const hasAddress = !!ctx.address; // NEW

  return {
    hasCart,
    hasDeliveryDate,
    hasShift,
    hasAmsId,
    hasLogisticsCenterId,
    hasAddress, // NEW
    ok:
      hasCart &&
      hasDeliveryDate &&
      hasShift &&
      hasAmsId &&
      hasLogisticsCenterId &&
      hasAddress, // NEW
  };
}

/* -----------------------------------------------------------------------------
 * Hook
 * -------------------------------------------------------------------------- */

export function useCheckoutState(): UseCheckoutState {
  const { search } = useLocation();

  // Parse URL → context
  const context = useMemo<CheckoutContext>(() => parseParams(search), [search]);

  // Shared cart (kept in sync with storage + other tabs via subscribeCart)
  const [cartLines, setCartLines] = useState<SharedCartLine[]>(
    () => getSharedCart().lines ?? []
  );

  // cross-tab sync
  useEffect(() => {
    const off = subscribeCart(() => setCartLines(getSharedCart().lines ?? []));
    return off;
  }, []);

  const refresh = useCallback(() => {
    setCartLines(getSharedCart().lines ?? []);
  }, []);

  const clear = useCallback(() => {
    clearSharedCart();
    setCartLines([]);
    // optional: also write empty cart to storage explicitly
    setSharedCart({ lines: [] });
  }, []);

  const totals = useMemo(() => computeTotals(cartLines), [cartLines]);
  const preflight = useMemo(
    () => computePreflight(context, cartLines),
    [context, cartLines]
  );

  return {
    context,
    cartLines,
    totals,
    preflight,
    actions: { clear, refresh },
  };
}
