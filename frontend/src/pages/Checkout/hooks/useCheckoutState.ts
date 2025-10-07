// src/pages/checkout/hooks/useCheckoutState.ts
import { useEffect, useMemo, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import type { Address } from "@/types/address";
import type { CreateOrderItemInput, UnitMode } from "@/types/orders";
import { getCart, clearCart, subscribeCart } from "@/utils/marketCart.shared";
import type { SharedCart, CartLine as SharedCartLine } from "@/utils/marketCart.shared";

/** What we need available before allowing payment */
export type CheckoutContext = {
  amsId: string | null;
  logisticsCenterId: string | null;
  deliveryDate: string | null; // ISO yyyy-mm-dd
  shiftName: string | null;
  deliveryAddress: Address | null;
};

export type PreflightState = {
  hasAmsId: boolean;
  hasLogisticsCenterId: boolean;
  hasDeliveryDate: boolean;
  hasShiftName: boolean;
  hasAddress: boolean;
  cartNotEmpty: boolean;
  allGood: boolean;
};

export type Totals = {
  itemsSubtotal: number;     // sum of line price snapshots
  deliveryFee: number;       // keep 0 for now (server can compute)
  taxUsd: number;            // keep 0 for now (server can compute)
  totalPrice: number;        // itemsSubtotal + deliveryFee + tax
};

/**
 * Try to read context saved by the Market page.
 * If you’ve used different keys, adjust here once and the rest of Checkout won’t change.
 */
function readContextFromStorage(): CheckoutContext {
  // Be conservative; only parse if value exists.
  const safeParseJSON = <T,>(raw: string | null): T | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  return {
    amsId: localStorage.getItem("market.amsId") || null,
    logisticsCenterId: localStorage.getItem("market.logisticsCenterId") || localStorage.getItem("market.LogisticsCenterId") || null,
    deliveryDate: localStorage.getItem("market.deliveryDate") || null,
    shiftName: localStorage.getItem("market.shiftName") || null,
    deliveryAddress: safeParseJSON<Address>(localStorage.getItem("market.deliveryAddress")),
  };
}

/**
 * Map a cart line (whatever the marketCart.shared puts there) into a CreateOrderItemInput.
 * We intentionally accept both legacy (quantity) and new schema (unitMode, quantityKg/units).
 */
function mapCartLineToOrderItem(line: any): CreateOrderItemInput {
  // Common identity/display fields
  const itemId: string = line.itemId ?? line.id ?? line.item?.itemId ?? line.item?._id ?? line._id;
  const name: string | undefined =
    line.name ?? line.displayName ?? line.item?.displayName ?? line.item?.name;
  const imageUrl: string | undefined =
    line.imageUrl ?? line.item?.imageUrl ?? line.item?.img ?? line.item?.photo;
  const category: string | undefined =
    line.category ?? line.item?.category;

  // Price snapshot
  const pricePerUnit: number =
    Number(line.unitPriceUsd ?? line.pricePerUnit ?? line.item?.pricePerUnit ?? line.item?.price ?? 0) || 0;

  // New model fields (preferred when present)
  const unitMode: UnitMode | undefined =
    (line.unitMode as UnitMode | undefined) ?? (line.item?.unitMode as UnitMode | undefined);


  const quantityKg: number | undefined =
    line.quantityKg ?? line.weightKg ?? line.item?.originalCommittedQuantityKg ?? undefined;

  const units: number | undefined =
    line.units ?? line.quantityUnits ?? undefined;

  const estimatesSnapshot =
    line.estimatesSnapshot ??
    line.item?.estimatesSnapshot ??
    (line.avgWeightPerUnitKg
      ? { avgWeightPerUnitKg: Number(line.avgWeightPerUnitKg) || undefined }
      : undefined);

  // Legacy fallback (pure kg with 'quantity')
  const legacyQuantity = Number(line.quantity ?? line.qty);
  const hasLegacyKg = !unitMode && !quantityKg && Number.isFinite(legacyQuantity) && legacyQuantity > 0;

  return {
    itemId: String(itemId),
    pricePerUnit, // per KG by backend definition
    unitMode: unitMode ?? "kg",
    quantityKg: unitMode === "kg" || hasLegacyKg ? (quantityKg ?? legacyQuantity) : quantityKg,
    units: unitMode === "unit" || unitMode === "mixed" ? units : undefined,
    estimatesSnapshot,
    name,
    imageUrl,
    category,
    // Optional provenance (keep if present)
    sourceFarmerName: line.sourceFarmerName ?? line.item?.farmerName,
    sourceFarmName: line.sourceFarmName ?? line.item?.farmName,
    farmerOrderId: line.farmerOrderId,
  };
}

function computeTotals(items: CreateOrderItemInput[]): Totals {
  // itemsSubtotal = sum(pricePerUnit * (quantityKg || units*avgPerUnitKg if available))
  const subtotal = items.reduce((sum, it) => {
    const price = Number(it.pricePerUnit) || 0;

    if (it.unitMode === "unit" && it.units && it.estimatesSnapshot?.avgWeightPerUnitKg) {
      return sum + price * it.units * it.estimatesSnapshot.avgWeightPerUnitKg;
    }
    if ((it.unitMode === "kg" || !it.unitMode) && it.quantityKg) {
      return sum + price * it.quantityKg;
    }
    if (it.unitMode === "mixed") {
      const kgPart = (Number(it.quantityKg) || 0) * price;
      const unitPart =
        (Number(it.units) || 0) *
        (Number(it.estimatesSnapshot?.avgWeightPerUnitKg) || 0) *
        price;
      return sum + kgPart + unitPart;
    }

    // Fallback: nothing explicit => 0
    return sum;
  }, 0);

  const itemsSubtotal = Math.max(0, Math.round(subtotal * 100) / 100);
  const deliveryFee = 0;
  const taxUsd = 0;
  const totalPrice = itemsSubtotal + deliveryFee + taxUsd;

  return { itemsSubtotal, deliveryFee, taxUsd, totalPrice };
}

export function useCheckoutState() {
  // Cart subscription
  
    // Guarantee a non-null cart shape even if storage is empty
    const ensureCart = (c: SharedCart | null | undefined): SharedCart =>
    (c as SharedCart) ?? ({ lines: [] } as unknown as SharedCart);

    const [cart, setCart] = useState<SharedCart>(() => ensureCart(getCart()));

    useEffect(() => {
    // subscribeCart(listener: () => void) — no args are passed, so re-read via getCart()
    const unsub = subscribeCart(() => setCart(ensureCart(getCart())));
    return () => { try { unsub?.(); } catch {} };
    }, []);

  // Read context once on mount; you can expose setters if you want to allow editing on Checkout
  const [context] = useState<CheckoutContext>(() => readContextFromStorage());

  // Derived order items from cart
  const lines: SharedCartLine[] = useMemo(
    () => cart?.lines ?? [],
    [cart]
    );

  const items = useMemo(() => lines.map(mapCartLineToOrderItem), [lines]);


  // Totals
  const totals = useMemo(() => computeTotals(items), [items]);

  // Preflight
  const preflight: PreflightState = useMemo(() => {
    const hasAmsId = !!context.amsId;
    const hasLogisticsCenterId = !!context.logisticsCenterId;
    const hasDeliveryDate = !!context.deliveryDate;
    const hasShiftName = !!context.shiftName;
    const hasAddress = !!context.deliveryAddress;
    const cartNotEmpty = (cart?.lines?.length ?? 0) > 0;

    return {
      hasAmsId,
      hasLogisticsCenterId,
      hasDeliveryDate,
      hasShiftName,
      hasAddress,
      cartNotEmpty,
      allGood:
        hasAmsId &&
        hasLogisticsCenterId &&
        hasDeliveryDate &&
        hasShiftName &&
        hasAddress &&
        cartNotEmpty,
    };
  }, [context, cart?.lines?.length]);
  // Actions
  const clear = () => {
    clearCart();
    toaster.create({
      title: "Cart cleared",
      type: "info",
    });
  };

  return {
    context,
    items,
    totals,
    cart,
    preflight,
    clear,
  };
}
