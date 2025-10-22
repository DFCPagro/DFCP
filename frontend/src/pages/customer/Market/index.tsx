import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack, Heading, Separator } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
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
} from "@/utils/marketCart.shared";
import type { MarketItem } from "@/types/market"; // ✅ units-only typing
import { getCustomerAddresses } from "@/api/market";

// --------------------------- Local cart adapter ---------------------------
// (kept inside this file as requested; swap to your real cart store later)

const EPS = 1e-4; // ~11 meters; avoids float jitter
function sameAddress(a: Address, b: Address): boolean {
  if (!a || !b) return false;
  const sameText = (a.address ?? "").trim() === (b.address ?? "").trim();
  const sameLat = Math.abs((a.alt ?? NaN) - (b.alt ?? NaN)) < EPS;
  const sameLng = Math.abs((a.lnt ?? NaN) - (b.lnt ?? NaN)) < EPS;
  return sameText && sameLat && sameLng;
}

function formatAddressShort(a: any): string {
  if (!a) return "—";
  // prefer the plain text address; fall back to coords
  const txt = (a.address ?? "").trim();
  if (txt) return txt;
  const lat = Number(a.lat ?? a.alt),
    lng = Number(a.lng ?? a.lng);
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    : "—";
}

function formatShiftLabel(s: any): string {
  if (!s) return "—";
  const date = s.date ?? "";
  const win = s.shift ?? ""; // our API: "morning" | "afternoon" | ...
  return `${date}${date && win ? " • " : ""}${win}`;
}

// ------------------------------- Component --------------------------------

export default function MarketPage() {
  const navigate = useNavigate();

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
  } = useMarketActivation({
    autoActivateOnMount: true,
    keepInvalidInStorage: false,
  });

  // ---- Cart (shared utils) ----
  // derive the context from active address + shift (null until ready)
  const cartCtx = useMemo<SharedCartContext | null>(() => {
    if (!isActive || !address || !shift?.date || !shift?.shift) return null;
    const lc = address.logisticCenterId ?? null;
    if (!lc) return null;
    return {
      logisticCenterId: lc,
      date: shift.date, // ISO yyyy-mm-dd
      shift: shift.shift, // "morning" | "afternoon" | ...
    };
  }, [isActive, address, shift]);

  // local state init (plain read; may be replaced when cartCtx becomes ready)
  const [cartLines, setCartLines] = useState<SharedCartLine[]>(
    () => getSharedCart().lines
  );

  // when the context first becomes available (or changes), re-read cart (util will clear if mismatched)
  useEffect(() => {
    if (cartCtx) {
      const { lines } = getSharedCart(cartCtx);
      setCartLines(lines);
    }
  }, [cartCtx]);

  // keep in sync with other tabs/pages (re-read with current ctx if we have it)
  useEffect(() => {
    const off = subscribeCart(() => {
      const { lines } = cartCtx ? getSharedCart(cartCtx) : getSharedCart();
      setCartLines(lines);
    });
    return off;
  }, [cartCtx]);

  const cartCount = useMemo(
    () => cartLines.reduce((sum, l) => sum + Number(l.quantity ?? 0), 0),
    [cartLines]
  );

  // ---- Local UI drawers ----
  const [pinOpen, setPinOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [forcePicker, setForcePicker] = useState(false);
  // track first transition to active to fire a toast once
  const wasActiveRef = useRef<boolean>(false);
  useEffect(() => {
    const was = wasActiveRef.current;
    if (!was && isActive) {
      wasActiveRef.current = true;
      setPinOpen(false);
      alert(
        `Market activated!\nDeliver to ${formatAddressShort(address)} · ${formatShiftLabel(shift)}`
      );
      // validate cart against the active context (will auto-clear if mismatched)
      if (cartCtx) {
        const { lines } = getSharedCart(cartCtx);
        setCartLines(lines);
      }
    }
    if (!isActive) wasActiveRef.current = false;
  }, [isActive, address, shift, cartCtx]);

  // ---- Filters ----
  const {
    category,
    search,
    debouncedSearch,
    sort,
    page,
    pageSize,
    setCategory,
    setSearch,
    setSort,
    setPage,
  } = useMarketFilters({ pageSize: 16 });

  // ---- Items (stock) ----
  const marketStockId =
    selection?.marketStockId ?? shift?.marketStockId ?? null;
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

  // console.log("selection.marketStockId", selection?.marketStockId);
  // console.log("marketStockId derived", marketStockId);

  // console.log("marketStockId", marketStockId, "isActive", isActive);
  // console.log("pageItems (from hook)", pageItems.length);

  // ---- Search suggestions (items + farmers) ----
  // ---- Search suggestions (items + farmers) ----
  // Immediate instance → suggestions feel live-as-you-type
  const { suggestions: liveSuggestions } = useMarketSearchIndex({
    items: allItems,
    text: search,
  });

  // Debounced instance → predicate for grid filtering
  const { matchFilter: matchFilterDebounced } = useMarketSearchIndex({
    items: allItems,
    text: debouncedSearch,
  });

  const addToCart = useCallback((item: MarketItem, qtyUnits: number) => {
    // ✅ units-only: whole numbers, 1..50
    const deltaUnits = Math.max(
      1,
      Math.min(50, Math.floor(Number(qtyUnits) || 1))
    );

    const newLine = marketItemToCartLine(item, deltaUnits); // shared builder
    const curr = getSharedCart().lines;
    const idx = curr.findIndex(
      (l) => (l.key ?? l.stockId) === (newLine.key ?? newLine.stockId)
    );

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

    const approxPerUnit = item.avgWeightPerUnitKg ?? 0.02;
    const approxAddedKg = deltaUnits * approxPerUnit;

    toaster.create({
      title: "Added to cart",
      description: `${deltaUnits} unit${deltaUnits > 1 ? "s" : ""} × ${item?.name ?? "Item"}${item?.farmerName ? ` • ${item.farmerName}` : ""} • ≈ ${approxAddedKg.toFixed(2)} kg`,
      type: "success",
      duration: 2500,
    });
  }, []);

  const removeLineByKey = useCallback((key: string) => {
    const curr = getSharedCart().lines;
    const next = curr.filter((l) => (l.key ?? l.stockId) !== key);
    setSharedCart({ lines: next }, cartCtx ?? undefined);
    setCartLines(next);
  }, []);

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

    // Pull what Checkout needs from the active shift/context
    const amsId = shift.marketStockId ?? selection?.marketStockId ?? null;
    const addresses = await getCustomerAddresses();
    const addr =
      addresses.find((a) => sameAddress(a, selection.address)) ?? null;

    if (!addr) {
      return { address: null, shift: null };
    }

    // 2) Validate we can resolve the LC id from the address
    const lcId = addr.logisticCenterId ?? null;
    // console.log("customer addresses", addresses);
    const logisticsCenterId = lcId;
    const deliveryDate = shift.date ?? null; // ISO yyyy-mm-dd
    const shiftName = shift.shift ?? null; // "morning" | "afternoon" | ...

    // Basic guardrails so you don’t navigate with half-baked context
    if (!amsId || !logisticsCenterId || !deliveryDate || !shiftName) {
      console.warn("checkout: missing context", {
        amsId,
        logisticsCenterId,
        deliveryDate,
        shiftName,
      });
      toaster.create({
        title: "Missing delivery details",
        description:
          "AMS, logistics center, date, and shift are required for checkout.",
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
    });
    // console.log(
    //   "checkout: navigate to /checkout with",
    //   Object.fromEntries(qs.entries())
    // );

    navigate(`/checkout?${qs.toString()}`);
  }, [isActive, shift, selection, navigate]);

  // ---- Handlers for UI ----
  const handlePickSuggestion = useCallback(
    (s: any) => {
      // Simple behavior: put label into search field
      setSearch(s.label);
      // Reset to page 1 for new search
      setPage(1);
    },
    [setSearch, setPage]
  );

  const handleChangeSelectionConfirm = useCallback(async () => {
    // Empty cart + clear selection + go inactive
    await clearCart();
    clearSelection();
  }, [clearCart, clearSelection]);

  const handlePickSelection = useCallback(
    async ({ address, shift }: { address: any; shift: any }) => {
      await setSelection({ address, marketStockId: shift.marketStockId });
    },
    [setSelection]
  );

  // If filters changed and page is out of range, the hook snaps it;
  // Keep URL/page state in sync by updating the filters' page setter too.
  const handlePageChange = useCallback(
    (p: number) => {
      setPage(p);
      setLocalPage(p);
    },
    [setPage, setLocalPage]
  );

  const handleChangeQty = useCallback((key: string, nextUnitsRaw: number) => {
    const curr = getSharedCart().lines;
    const idx = curr.findIndex((l) => (l.key ?? l.stockId) === key);
    if (idx < 0) return;

    // ✅ units-only: whole numbers, 1..50 (<=0 removes)
    const nextUnits = Math.floor(Number(nextUnitsRaw) || 0);

    let next: SharedCartLine[];
    if (nextUnits <= 0) {
      next = curr.filter((_, i) => i !== idx);
    } else {
      next = [...curr];
      next[idx] = {
        ...next[idx],
        quantity: Math.min(50, Math.max(1, nextUnits)),
      };
    }
    setSharedCart({ lines: next }, cartCtx ?? undefined);
    setCartLines(next);
  }, []);

  // ---- Derived: page items filtered with search predicate from index ----
  const visiblePageItems = useMemo(() => {
    // console.log("filtering pageItems", pageItems.length);
    return pageItems.filter(matchFilterDebounced);
  }, [pageItems, matchFilterDebounced]);

  return (
    <Box w="full">
      <Stack gap="6">
        {/* Inactive Gate */}
        {!isActive ? (
          <ActivationGate
            loading={activationLoading}
            error={activationError}
            onOpenPicker={() => setPinOpen(true)}
            onRetry={revalidate}
          />
        ) : (
          <>
            {/* Sticky filters */}
            <StickyFilterBar
              offsetTop={55}
              category={category}
              search={search}
              sort={sort}
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              suggestions={liveSuggestions} // ← immediate suggestions
              onCategoryChange={(cat) => setCategory(cat)}
              onSearchChange={(t) => setSearch(t)}
              onPickSuggestion={handlePickSuggestion}
              onSortChange={setSort}
              onPageChange={handlePageChange}
            />

            {/* Grid */}
            <ItemsGrid
              items={visiblePageItems}
              isLoading={itemsLoading}
              isFetching={itemsFetching}
              error={itemsError}
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              onAdd={({ item, qty }) => addToCart(item, qty)}
              allItemsForRelated={allItems}   // ✅ add this line
            />

          </>
        )}
      </Stack>

      {/* Floating controls */}
      <PinButton active={isActive} onClick={() => setPinOpen(true)} />
      <CartFAB count={cartCount} onClick={() => setCartOpen(true)} />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartLines}
        onRemove={removeLineByKey}
        onClear={clearCart}
        onChangeQty={handleChangeQty}
        onCheckout={checkout}
      />

      {/* Drawers */}
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
