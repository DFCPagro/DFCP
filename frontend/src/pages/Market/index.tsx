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

// --------------------------- Local cart adapter ---------------------------
// (kept inside this file as requested; swap to your real cart store later)

type CartLine = Record<string, any>;
function mkLineFromItem(item: any): CartLine {
  // Derive a consistent line shape
  const id = item?.id ?? item?.itemId ?? `${item?.name ?? "item"}|${item?.farmerId ?? item?.farmerName ?? "farmer"}`;
  return {
    id,
    itemId: item?.itemId ?? item?.id,
    name: item?.name ?? "Item",
    farmerName: item?.farmerName,
    imageUrl: item?.imageUrl ?? item?.img ?? item?.photo ?? item?.picture,
    // Spec: cart shows qty in kg; default to 1 kg per add for now.
    qtyKg: 1,
    // Price in $ (we normalize a few known fields)
    priceUsd:
      Number(item?.priceUsd ?? item?.usd ?? item?.price ?? item?.unitPrice ?? item?.pricePerUnit ?? 0) || 0,
  };
}

function formatAddressShort(a: any): string {
  if (!a) return "—";
  // prefer the plain text address; fall back to coords
  const txt = (a.address ?? "").trim();
  if (txt) return txt;
  const lat = Number(a.alt), lng = Number(a.lnt);
  return (Number.isFinite(lat) && Number.isFinite(lng)) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "—";
}

function formatShiftLabel(s: any): string {
  if (!s) return "—";
  const date = s.date ?? "";
  const win  = s.window ?? s.shiftName ?? "";
  return `${date}${date && win ? " • " : ""}${win}`;
}


// ------------------------------- Component --------------------------------

export default function MarketPage() {
  const navigate = useNavigate();

  const {
    isActive, address, shift, isLoading: activationLoading, error: activationError,
    setSelection, clearSelection, revalidate,
  } = useMarketActivation({ autoActivateOnMount: true, keepInvalidInStorage: false });

  // ---- Local UI drawers ----
  const [pinOpen, setPinOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  // track first transition to active to fire a toast once
  const wasActiveRef = useRef<boolean>(false);
  useEffect(() => {
    const was = wasActiveRef.current;
    if (!was && isActive) {
      wasActiveRef.current = true;
      setPinOpen(false);
      toaster.create({
        title: "Market activated",
        description: `Deliver to ${formatAddressShort(address)} · ${formatShiftLabel(shift)}`,
        type: "success",
        duration: 5000,
      });
    }
    if (!isActive) wasActiveRef.current = false;
  }, [isActive, address, shift]);


  // ---- Filters ----
  const {
    category, search, debouncedSearch, sort, page, pageSize,
    setCategory, setSearch, setSort, setPage,
  } = useMarketFilters({ pageSize: 16 });

  // ---- Items (stock) ----
  const marketStockId = shift?.marketStockId ?? null;
  const {
    allItems, pageItems, isLoading: itemsLoading, isFetching: itemsFetching,
    error: itemsError, totalItems, totalPages, setPage: setLocalPage,
  } = useMarketItems({
    marketStockId,
    enabled: isActive,
    category,
    debouncedSearch,
    sort,
    page,
    pageSize,
  });

  // ---- Search suggestions (items + farmers) ----
  const { suggestions, matchFilter } = useMarketSearchIndex({
    items: allItems,
    text: debouncedSearch,
  });

  // ---- Cart (page-local) ----
  const [cart, setCart] = useState<CartLine[]>([]);
  const cartCount = cart.length;

  const addToCart = useCallback((item: any) => {
    setCart((prev) => {
      // If the same line exists, bump qty by 1 kg
      const id = item?.id ?? item?.itemId ?? `${item?.name ?? "item"}|${item?.farmerId ?? item?.farmerName ?? "farmer"}`;
      const idx = prev.findIndex((l) => l.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qtyKg: Number(next[idx].qtyKg || 0) + 1 };
        return next;
      }
      return [...prev, mkLineFromItem(item)];
    });
    setCartOpen(true);
    toaster.create({ title: "Added to cart", type: "success" });
  }, []);

  const removeLine = useCallback(async (line: CartLine) => {
    setCart((prev) => prev.filter((l) => l.id !== (line.id ?? line)));
  }, []);

  const clearCart = useCallback(async () => {
    setCart([]);
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
    navigate("/checkout");
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

  // ---- Derived: page items filtered with search predicate from index ----
  // (Optional: if you want matchFilter to apply before paging, move it into useMarketItems via its options)
  const visiblePageItems = useMemo(() => {
    return pageItems.filter(matchFilter);
  }, [pageItems, matchFilter]);

  return (
    <Box w="full">
      <Stack gap="6">

        {/* Header */}
        <Heading size="lg">Market</Heading>

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
              offsetTop={64}                 // adjust to your header height
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
              items={pageItems}
              isLoading={itemsLoading}
              isFetching={itemsFetching}
              error={itemsError}
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={handlePageChange}
              onAdd={({ item }) => addToCart(item)}
            />
          </>
        )}
      </Stack>

      {/* Floating controls */}
      <PinButton active={isActive} onClick={() => setPinOpen(true)} />
      <CartFAB count={cartCount} onClick={() => setCartOpen(true)} />

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

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onRemove={removeLine}
        onClear={clearCart}
        onCheckout={checkout}
      />
    </Box>
  );
}
