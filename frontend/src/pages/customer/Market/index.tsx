import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack } from "@chakra-ui/react";
import { useNavigate, useLocation } from "react-router-dom";
import { toaster } from "@/components/ui/toaster";
import type { Address } from "@/types/address";

import { useMarketActivation } from "./hooks/useMarketActivation";
import { useMarketFilters } from "./hooks/useMarketFilters";
import { useMarketSearchIndex } from "./hooks/useMarketSearchIndex";
import { useMarketItems } from "./hooks/useMarketItems";

import { ActivationGate } from "./components/ActivationGate";
import AddressShiftDrawer from "./components/AddressShiftDrawer";
import { StickyFilterBar } from "./components/StickyFilterBar";
import { ItemsGrid } from "./components/ItemsGrid";
import { PinButton } from "./components/PinButton";
import { CartFAB } from "./components/CartFAB";
import CartDrawer from "./components/CartDrawer";
import {
  getCart as getSharedCart,
  setCart as setSharedCart,
  clearCart as clearSharedCart,
  subscribeCart,
  marketItemToCartLine,
  type CartLine as SharedCartLine,
  type CartContext as SharedCartContext,
} from "@/utils/market/marketCart.shared";
import type { MarketItem } from "@/types/market";
import { getCustomerAddresses } from "@/api/market";

import { useUnitPref } from "@/hooks/useUnitPref";
import { qtyToUnits, effectiveUnitForItem } from "@/utils/market/marketUnits";

/* -------------------------------- helpers -------------------------------- */

const EPS = 1e-4;
function sameAddress(a: Address, b: Address): boolean {
  if (!a || !b) return false;
  const sameText = (a.address ?? "").trim() === (b.address ?? "").trim();
  const sameLat = Math.abs((a.alt ?? NaN) - (b.alt ?? NaN)) < EPS;
  const sameLng = Math.abs((a.lnt ?? NaN) - (b.lnt ?? NaN)) < EPS;
  return sameText && sameLat && sameLng;
}

function formatAddressShort(a: any): string {
  if (!a) return "—";
  const txt = (a.address ?? "").trim();
  if (txt) return txt;
  const lat = Number(a.alt ?? a.lat);
  const lng = Number(a.lnt ?? a.lng);
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    : "—";
}

function formatShiftLabel(s: any): string {
  if (!s) return "—";
  const date = s.date ?? "";
  const win = s.shift ?? "";
  return `${date}${date && win ? " • " : ""}${win}`;
}


/* ------------------------------- component ------------------------------- */

export default function MarketPage() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const {
    isActive,
    address,
    shift,
    selection,
    isLoading: activationLoading,
    error: activationError,
    setSelection,
    clearSelection,
    revalidate,
  } = useMarketActivation({ autoActivateOnMount: true, keepInvalidInStorage: false });

  // Unit mode: "unit" | "kg"
  const { unit, setUnit } = useUnitPref(search);
  const isUnit = unit === "unit";

  // cart context
  const cartCtx = useMemo<SharedCartContext | null>(() => {
    if (!isActive || !address || !shift?.date || !shift?.shift) return null;
    const lc = address.logisticCenterId ?? null;
    if (!lc) return null;
    return {
      logisticCenterId: lc,
      date: shift.date,
      shift: shift.shift,
      amsId: shift.marketStockId ?? null,
    };
  }, [isActive, address, shift]);

  // local cart
  const [cartLines, setCartLines] = useState<SharedCartLine[]>(() => getSharedCart().lines);
  useEffect(() => {
    if (cartCtx) {
      const { lines } = getSharedCart(cartCtx);
      setCartLines(lines);
    }
  }, [cartCtx]);
  useEffect(() => {
    const off = subscribeCart(() => {
      const { lines } = cartCtx ? getSharedCart(cartCtx) : getSharedCart();
      setCartLines(lines);
    });
    return off;
  }, [cartCtx]);

  // badge count
  const cartCount = useMemo(() => {
    if (isUnit) {
      return cartLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
    }
    const kg = cartLines.reduce((sum, l: any) => {
      const units = Number(l.quantity) || 0;
      const per = Number(l.avgWeightPerUnitKg) || 0.02;
      return sum + units * per;
    }, 0);
    return Math.max(0, Math.round(kg));
  }, [cartLines, isUnit]);

  // drawers
  const [pinOpen, setPinOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const wasActiveRef = useRef<boolean>(false);
  useEffect(() => {
    const was = wasActiveRef.current;
    if (!was && isActive) {
      wasActiveRef.current = true;
      setPinOpen(false);
      alert(`Market activated!\nDeliver to ${formatAddressShort(address)} · ${formatShiftLabel(shift)}`);
      if (cartCtx) {
        const { lines } = getSharedCart(cartCtx);
        setCartLines(lines);
      }
    }
    if (!isActive) wasActiveRef.current = false;
  }, [isActive, address, shift, cartCtx]);

  // filters
  const {
    category,
    search: searchText,
    debouncedSearch,
    sort,
    page,
    pageSize,
    setCategory,
    setSearch,
    setSort,
    setPage,
  } = useMarketFilters({ pageSize: 16 });

  // items
  const marketStockId = selection?.marketStockId ?? shift?.marketStockId ?? null;
  const {
    allItems,
    pageItems,
    isLoading: itemsLoading,
    isFetching: itemsFetching,
    error: itemsError,
    totalItems,
    totalPages,
    setPage: setLocalPage,
  } = useMarketItems({
    marketStockId,
    enabled: !!marketStockId,
    category,
    debouncedSearch,
    sort,
    page,
    pageSize,
  });

  // search index
  const { suggestions: liveSuggestions } = useMarketSearchIndex({ items: allItems, text: searchText });
  const { matchFilter: matchFilterDebounced } = useMarketSearchIndex({ items: allItems, text: debouncedSearch });

  // add to cart (cart stores units). If UI is kg, convert kg->units by avg weight.
  const addToCart = useCallback(
    (item: MarketItem, qtyUnits: number) => {
      const deltaUnits = Math.max(1, Math.min(50, Math.floor(Number(qtyUnits) || 1)));

      const newLine = marketItemToCartLine(item, deltaUnits);
      const curr = getSharedCart().lines;
      const idx = curr.findIndex((l) => (l.key ?? l.stockId) === (newLine.key ?? newLine.stockId));

      let next: SharedCartLine[];
      if (idx >= 0) {
        next = [...curr];
        const prevUnits = Number(next[idx].quantity ?? 0);
        next[idx] = { ...next[idx], quantity: prevUnits + deltaUnits };
      } else {
        next = [...curr, newLine];
      }

      setSharedCart({ lines: next }, cartCtx ?? undefined);
      setCartLines(next);

      const per = Number((item as any).avgWeightPerUnitKg) || Number((item as any).estimates?.avgWeightPerUnitKg) || 0.02;
      const approxKg = deltaUnits * per;

      toaster.create({
        title: "Added to cart",
        description: isUnit
          ? `${deltaUnits} unit${deltaUnits > 1 ? "s" : ""} × ${((item as any)?.name ?? (item as any)?.displayName ?? "Item")}${(item as any)?.farmerName ? ` • ${(item as any).farmerName}` : ""}`
          : `${Math.max(1, Math.round(approxKg))} kg × ${((item as any)?.name ?? (item as any)?.displayName ?? "Item")}${(item as any)?.farmerName ? ` • ${(item as any).farmerName}` : ""} • ≈ ${approxKg.toFixed(2)} kg`,
        type: "success",
        duration: 2500,
      });
    },
    [cartCtx, isUnit]
  );

  const removeLineByKey = useCallback(
    (key: string) => {
      const curr = getSharedCart().lines;
      const next = curr.filter((l) => (l.key ?? l.stockId) !== key);
      setSharedCart({ lines: next }, cartCtx ?? undefined);
      setCartLines(next);
    },
    [cartCtx]
  );

  const clearCart = useCallback(async () => {
    clearSharedCart();
    setCartLines([]);
  }, []);

  const checkout = useCallback(async () => {
    if (!isActive || !shift) {
      toaster.create({
        title: "Select address & shift",
        description: "Please pick your address and shift before checkout.",
        type: "warning",
      });
      setPinOpen(true);
      return;
    }

    const amsId = shift.marketStockId ?? selection?.marketStockId ?? null;
    const addresses = await getCustomerAddresses();
    const addr = addresses.find((a) => sameAddress(a, selection.address)) ?? null;

    if (!addr) return { address: null, shift: null };

    const lcId = addr.logisticCenterId ?? null;
    const logisticsCenterId = lcId;
    const deliveryDate = shift.date ?? null;
    const shiftName = shift.shift ?? null;

    if (!amsId || !logisticsCenterId || !deliveryDate || !shiftName) {
      toaster.create({
        title: "Missing delivery details",
        description: "AMS, logistics center, date, and shift are required for checkout.",
        type: "warning",
      });
      setPinOpen(true);
      return;
    }

    const qs = new URLSearchParams({
      amsId,
      logisticsCenterId,
      addressJson: JSON.stringify(addr),
      deliveryDate,
      shift: shiftName,
      unitMode: unit, // "unit" | "kg"
    });
    navigate(`/checkout?${qs.toString()}`);
  }, [isActive, shift, selection, navigate, unit]);

  // UI handlers
  const handlePickSuggestion = useCallback(
    (s: any) => {
      setSearch(s.label);
      setPage(1);
    },
    [setSearch, setPage]
  );

  const handleChangeSelectionConfirm = useCallback(async () => {
    await clearCart();
    clearSelection();
  }, [clearCart, clearSelection]);

  const handlePickSelection = useCallback(
    async ({ address, shift }: { address: any; shift: any }) => {
      await setSelection({ address, marketStockId: shift.marketStockId });
    },
    [setSelection]
  );

  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      setLocalPage(p);
    },
    [setPage, setLocalPage]
  );

  const handleChangeQty = useCallback(
    (key: string, nextUnitsRaw: number) => {
      const curr = getSharedCart().lines;
      const idx = curr.findIndex((l) => (l.key ?? l.stockId) === key);
      if (idx < 0) return;

      const nextUnits = Math.floor(Number(nextUnitsRaw) || 0);

      let next: SharedCartLine[];
      if (nextUnits <= 0) {
        next = curr.filter((_, i) => i !== idx);
      } else {
        next = [...curr];
        next[idx] = { ...next[idx], quantity: Math.min(50, Math.max(1, nextUnits)) };
      }
      setSharedCart({ lines: next }, cartCtx ?? undefined);
      setCartLines(next);
    },
    [cartCtx]
  );

  // filtered page items
  const visiblePageItems = useMemo(() => pageItems.filter(matchFilterDebounced), [pageItems, matchFilterDebounced]);

  return (
    <Box w="full">
      <Stack gap="6">
        {!isActive ? (
          <ActivationGate
            loading={activationLoading}
            error={activationError}
            onOpenPicker={() => setPinOpen(true)}
            onRetry={revalidate}
          />
        ) : (
          <>
            <StickyFilterBar
              offsetTop={55}
              category={category}
              search={searchText}
              sort={sort}
              page={page}
              unit={isUnit}
              totalPages={totalPages}
              totalItems={totalItems}
              suggestions={liveSuggestions}
              onCategoryChange={(cat) => setCategory(cat)}
              onSearchChange={(t) => setSearch(t)}
              onPickSuggestion={handlePickSuggestion}
              onSortChange={setSort}
              onPageChange={handlePageChange}
              onUnitChange={(next: boolean) => setUnit(next ? "unit" : "kg")}
            />

            <ItemsGrid
              items={visiblePageItems}
              unit={isUnit}
              onUnitChange={(next: boolean) => setUnit(next ? "unit" : "kg")}
              isLoading={itemsLoading}
              isFetching={itemsFetching}
              error={itemsError}
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={handlePageChange}
  onAdd={({ item, qty }) => {
    // qty is ALREADY in UNITS from children (card/page).
    const unitsToAdd = Math.max(1, Math.min(50, Math.floor(Number(qty) || 1)));
    addToCart(item, unitsToAdd);
  }}
              allItemsForRelated={allItems}
            />
          </>
        )}
      </Stack>

      {/* floating controls */}
      <PinButton active={isActive} onClick={() => setPinOpen(true)} />
      <CartFAB
        count={cartCount}
        onClick={() => setCartOpen(true)}
        tooltip={isUnit ? "Cart" : "Cart (kg mode)"}
      />
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartLines}
        onRemove={removeLineByKey}
        onClear={clearCart}
        onChangeQty={handleChangeQty}
        onCheckout={checkout}
      />

      {/* drawers */}
      <AddressShiftDrawer
        isOpen={pinOpen}
        onClose={() => setPinOpen(false)}
        active={isActive}
        currentAddress={address}
        currentShift={shift}
        onConfirmChange={handleChangeSelectionConfirm}
        onPick={handlePickSelection}
      />
    </Box>
  );
}
