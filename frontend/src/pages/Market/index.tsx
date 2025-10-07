import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Stack, Heading, Separator } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { toaster } from "@/components/ui/toaster";

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
} from "@/utils/marketCart.shared";

// --------------------------- Local cart adapter ---------------------------
// (kept inside this file as requested; swap to your real cart store later)



function formatAddressShort(a: any): string {
  if (!a) return "—";
  // prefer the plain text address; fall back to coords
  const txt = (a.address ?? "").trim();
  if (txt) return txt;
  const lat = Number(a.lat ?? a.alt), lng = Number(a.lng ?? a.lng);
  return (Number.isFinite(lat) && Number.isFinite(lng)) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "—";
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
    isActive, address, shift, selection, isLoading: activationLoading, error: activationError,
    setSelection, clearSelection, revalidate,
  } = useMarketActivation({ autoActivateOnMount: true, keepInvalidInStorage: false });

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
    }
    if (!isActive) wasActiveRef.current = false;
  }, [isActive, address, shift]);



  // ---- Filters ----
  const {
    category, search, debouncedSearch, sort, page, pageSize,
    setCategory, setSearch, setSort, setPage,
  } = useMarketFilters({ pageSize: 16 });

  // ---- Items (stock) ----
  const marketStockId = selection?.marketStockId ?? shift?.marketStockId ?? null;
  const {
    allItems, pageItems, isLoading: itemsLoading, isFetching: itemsFetching,
    error: itemsError, totalItems, totalPages, setPage: setLocalPage,
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
  const { suggestions, matchFilter } = useMarketSearchIndex({
    items: allItems,
    text: debouncedSearch,
  });

  // ---- Cart (shared utils) ----
  const [cartLines, setCartLines] = useState<SharedCartLine[]>(() => getSharedCart().lines);

  // keep in sync with other tabs / pages
  useEffect(() => {
    const off = subscribeCart(() => setCartLines(getSharedCart().lines));
    return off;
  }, []);


  const cartCount = useMemo(
    () => cartLines.reduce((sum, l) => sum + Number(l.quantity ?? 0), 0),
    [cartLines]
  );


  const addToCart = useCallback((item: any, qty: number) => {
    const clamped = Math.max(0.25, Math.min(50, Number(qty) || 1)); // keep a sane range; min quarter kg
    const newLine = marketItemToCartLine(item, clamped);
    const curr = getSharedCart().lines;
    const idx = curr.findIndex((l) => (l.key ?? l.stockId) === (newLine.key ?? newLine.stockId));

    let next: SharedCartLine[];
    if (idx >= 0) {
      next = [...curr];
      const prevQty = Number(next[idx].quantity ?? 0);
      next[idx] = { ...next[idx], quantity: prevQty + clamped };
    } else {
      next = [...curr, newLine];
    }
    setSharedCart({ lines: next });
    setCartLines(next);

    toaster.create({
      title: "Added to cart",
      description: `${clamped} kg × ${item?.name ?? "Item"}${item?.farmerName ? ` • ${item.farmerName}` : ""}`,
      type: "success",
      duration: 2500,
    });
  }, []);

  const removeLineByKey = useCallback((key: string) => {
    const curr = getSharedCart().lines;
    const next = curr.filter((l) => (l.key ?? l.stockId) !== key);
    setSharedCart({ lines: next });
    setCartLines(next);
  }, []);

  const clearCart = useCallback(async () => {
    clearSharedCart();
    setCartLines([]);
  }, []);

  const checkout = useCallback(async () => {
    // Re-validate selection before proceeding
    if (!isActive || !marketStockId) {
      toaster.create({
        title: "Select address & shift",
        description: "Please pick your address and shift before checkout.",
        type: "warning",
      });
      setPinOpen(true);
      return;
    }
    // Plug this into your real checkout flow; for now, go to /checkout
    navigate(`/checkout?ams=${marketStockId}`);

  }, [isActive, marketStockId, navigate]);

  // ---- Handlers for UI ----
  const handlePickSuggestion = useCallback((s: any) => {
    // Simple behavior: put label into search field
    setSearch(s.label);
    // Reset to page 1 for new search
    setPage(1);
  }, [setSearch, setPage]);

  const handleChangeSelectionConfirm = useCallback(async () => {
    // Empty cart + clear selection + go inactive
    await clearCart();
    clearSelection();
  }, [clearCart, clearSelection]);

  const handlePickSelection = useCallback(async ({ address, shift }: { address: any; shift: any; }) => {
    await setSelection({ address, marketStockId: shift.marketStockId });
  }, [setSelection]);

  // If filters changed and page is out of range, the hook snaps it;
  // Keep URL/page state in sync by updating the filters' page setter too.
  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    setLocalPage(p);
  }, [setPage, setLocalPage]);

  const handleChangeQty = useCallback((key: string, nextQtyKg: number) => {
    const curr = getSharedCart().lines;
    const idx = curr.findIndex((l) => (l.key ?? l.stockId) === key);
    if (idx < 0) return;

    let next: SharedCartLine[];
    if (nextQtyKg <= 0) {
      next = curr.filter((_, i) => i !== idx);
    } else {
      next = [...curr];
      next[idx] = { ...next[idx], quantity: nextQtyKg };
    }
    setSharedCart({ lines: next });
    setCartLines(next);
  }, []);

  // ---- Derived: page items filtered with search predicate from index ----
  // (Optional: if you want matchFilter to apply before paging, move it into useMarketItems via its options)
  const visiblePageItems = useMemo(() => {
    return pageItems.filter(matchFilter);
  }, [pageItems, matchFilter]);

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
              offsetTop={55}                 // adjust to your header height
              category={category}
              search={search}
              sort={sort}
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              suggestions={suggestions}
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
