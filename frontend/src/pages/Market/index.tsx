// src/pages/Market.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Container,
  Heading,
  Grid,
  GridItem,
  Button,
  HStack,
  Text,
  Badge,
  Spinner,
  Alert,
  Field,
  Dialog,
} from "@chakra-ui/react";

import AuthGuard from "@/guards/AuthGuard";
import MapPickerDialog from "@/components/common/MapPickerDialog";
import ShiftPicker from "@/components/ui/ShiftPicker";
import ItemCard from "@/components/feature/market/ItemCard";
import CategoryFilter from "@/components/feature/market/CategoryFilter";

import {
  getAvailableShiftsByLC,
  addCustomerAddress,
  getCustomerAddresses,
  getStockByMarketStockId,
} from "@/api/market";

import {
  type MarketItem,
  type ShiftName,
  type AvailableShift,
  flattenMarketDocToItems,
} from "@/types/market";
import type { Address } from "@/types/address";

import CartIconButton from "@/components/common/CartIconButton";
import { useCart } from "@/store/cart";
import { useCartItemsUnified } from "@/hooks/useCartItemsUnified";

// cart LS helpers
import {
  addToCart as addToCartLS,
  clearCart as clearCartLS,
  setCartMeta,
  getCartMeta,
  onCartUpdated,
  type CartLine,
} from "@/utils/cart";

// ===== ShiftName ↔ cart ShiftKey (4 shifts) =====
import type { ShiftKey as CartShiftKey } from "@/types/cart";
function toShiftKey(code?: ShiftName | null): CartShiftKey | null {
  switch (code) {
    case "morning":
    case "afternoon":
    case "evening":
    case "night":
      return code;
    default:
      return null;
  }
}
function fromShiftKey(key?: CartShiftKey | null): ShiftName | undefined {
  return key ?? undefined;
}
function normalizeKey(input?: unknown): CartShiftKey | null {
  if (!input) return null;
  const v = String(input).toLowerCase() as CartShiftKey;
  return v === "morning" || v === "afternoon" || v === "evening" || v === "night" ? v : null;
}

// ===== Types for local state =====
type CategoryCode = string | "ALL";
type PendingAction =
  | { kind: "shift"; value?: ShiftName }
  | { kind: "locationKey"; value?: string }
  | { kind: "mapPick"; value: { address: string; lat: number; lng: number } }
  | null;

export default function Market() {
  const cart = useCart();

  // Location & LC
  const [locationKey, setLocationKey] = useState<string>(); // Address.address
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [logisticCenterId, setLogisticCenterId] = useState<string>();
  const [locations, setLocations] = useState<Address[]>([]);

  // Shifts
  const [availableShifts, setAvailableShifts] = useState<AvailableShift[]>([]);
  const [shift, setShift] = useState<ShiftName>();
  const [marketStockId, setMarketStockId] = useState<string>();

  // Items
  const [category, setCategory] = useState<CategoryCode | "ALL">("ALL");
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Guards
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const countries = "il";

  // Items from store + LS
  const storeItems = useCartItemsUnified();
  const [lsItems, setLsItems] = useState<CartLine[]>([]);
  useEffect(() => onCartUpdated(({ items }) => setLsItems(items)), []);
  const cartNotEmpty = (storeItems?.length ?? 0) + (lsItems?.length ?? 0) > 0;

  // setLock only on change
  const lastLock = useRef<{ lc: string | null; sk: CartShiftKey | null }>({ lc: null, sk: null });
  const setLockSafe = (lc: string | null, sk: CartShiftKey | null) => {
    if (lastLock.current.lc !== lc || lastLock.current.sk !== sk) {
      lastLock.current = { lc, sk };
      cart.setLock(lc, sk);
    }
  };

  // reserved map (by stockId)
  const reservedByCart = useMemo(() => {
    const m: Record<string, number> = {};
    const fold = (list: any[]) => {
      for (const it of list ?? []) {
        const id = (it as any).stockId ?? (it as any).inventoryId ?? (it as any).id;
        const qty = Number((it as any).qtyKg ?? (it as any).qty ?? 1);
        if (!id) continue;
        m[id] = (m[id] ?? 0) + (isFinite(qty) ? qty : 0);
      }
    };
    fold(storeItems as any[]);
    fold(lsItems as any[]);
    return m;
  }, [storeItems, lsItems]);

  // ---------- helpers ----------
  const openGuard = (a: PendingAction) => setPending(a);
  const clearCartEverywhere = () => {
    (cart as any)?.clear?.();
    clearCartLS();
  };

  const applyPending = async (action?: PendingAction) => {
    const p = action ?? pending;
    setPending(null);
    if (!p) return;

    if (p.kind === "shift") {
      setShift((prev) => (prev === p.value ? prev : p.value));
      if (p.value) {
        const hit = availableShifts.find((s) => s.key === p.value);
        setMarketStockId(hit?.marketStockId ?? undefined);
      }
      setLockSafe(logisticCenterId ?? null, toShiftKey(p.value));
      return;
    }

    if (p.kind === "locationKey") {
      const newKey = p.value;
      setLocationKey((prev) => (prev === newKey ? prev : newKey));
      setSelectedAddress("");
      const loc = locations.find((l) => l.address === newKey);
      const lc = (loc as any)?.logisticCenterId ?? undefined;
      setLogisticCenterId(lc);
      setLockSafe(lc ?? null, toShiftKey(shift));
      setAvailableShifts([]);
      setMarketStockId(undefined);
      return;
    }

    if (p.kind === "mapPick") {
      const { address, lat, lng } = p.value;
      console.log(address, lat, lng)

      // BE expects { address, lnt, alt } and responds with updated list
      try {
        console.log("Adding address:", { address, lnt: lat, alt: lng });
        const updatedList = await addCustomerAddress({ address, lnt: lat, alt: lng });
        console.log("dude")
        console.log("addCustomerAddress response:", updatedList);
        // Some backends return a single Address; yours returns Address[] (per Swagger).
        const list: Address[] = Array.isArray(updatedList) ? updatedList : [updatedList];
        console.log("maaaaan")
        setLocations(list);

        const added =
          list.find((a) => a.address === address) ?? list[list.length - 1];

        if (added) {
          setLocationKey(added.address);
          setSelectedAddress(added.address);
          const lc = (added as any)?.logisticCenterId ?? undefined;
          setLogisticCenterId(lc);
          setLockSafe(lc ?? null, toShiftKey(shift));
        }
      } catch (err) {
        console.log("err: ", err)
        console.error("addCustomerAddress failed:", err);
        // Optimistic fallback so user still sees the chosen address
        setLocations((prev) => {
          if (prev.some((a) => a.address === address)) return prev;
          return [{ address, lnt: lat, alt: lng, logisticCenterId: undefined as any }, ...prev];
        });
        setLocationKey(address);
        setSelectedAddress(address);
      } finally {
        setAvailableShifts([]);
        setMarketStockId(undefined);
        // refresh from server (authoritative)
        try {
          console.log("Refreshing customer addresses");
          const refreshed = await getCustomerAddresses();
          setLocations(refreshed);
        } catch (e) {
          console.log("main")
          console.warn("getCustomerAddresses refresh failed:", e);
        }
      }
    }
  };

  // ---------- initial load ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getCustomerAddresses();
        if (mounted) setLocations(list);
      } catch (err) {
        console.error("initial getCustomerAddresses failed:", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // locationKey → selected label + LC + lock
  useEffect(() => {
    if (!locationKey) {
      if (selectedAddress !== "") setSelectedAddress("");
      if (logisticCenterId !== undefined) setLogisticCenterId(undefined);
      setAvailableShifts([]);
      setMarketStockId(undefined);
      setLockSafe(null, toShiftKey(shift));
      return;
    }
    const loc = locations.find((l) => l.address === locationKey);
    if (!loc) return;
    if (loc.address !== selectedAddress) setSelectedAddress(loc.address);
    const lc = (loc as any)?.logisticCenterId ?? undefined;
    if (lc !== logisticCenterId) {
      setLogisticCenterId(lc);
      setLockSafe(lc ?? null, toShiftKey(shift));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationKey, locations]);

  // hydrate from cart meta once
  useEffect(() => {
    const meta = getCartMeta();
    if (meta?.locationKey && meta.locationKey !== locationKey) setLocationKey(meta.locationKey);
    const key = normalizeKey((meta as any)?.shiftKey);
    const shiftCode = fromShiftKey(key);
    if (shiftCode && shiftCode !== shift) setShift(shiftCode);
    setLockSafe(meta?.logisticCenterId ?? null, key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch available shifts when LC exists
  useEffect(() => {
    if (!logisticCenterId) {
      setAvailableShifts([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const shifts = await getAvailableShiftsByLC(logisticCenterId);
        if (!mounted) return;
        setAvailableShifts(shifts);
        if (shift) {
          const hit = shifts.find((s) => s.key === shift);
          setMarketStockId(hit?.marketStockId ?? undefined);
        }
      } catch (e) {
        if (mounted) {
          console.warn("Couldn’t load shifts for LC", logisticCenterId, e);
          setAvailableShifts([]);
        }
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logisticCenterId]);

  // keep lock on shift changes and map to marketStockId
  const lastShiftForLock = useRef<ShiftName | undefined>(undefined);
  useEffect(() => {
    if (lastShiftForLock.current !== shift) {
      lastShiftForLock.current = shift;
      setLockSafe(logisticCenterId ?? null, toShiftKey(shift));
      if (shift) {
        const hit = availableShifts.find((s) => s.key === shift);
        setMarketStockId(hit?.marketStockId ?? undefined);
      } else {
        setMarketStockId(undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift]);

  // reset items on location/stock change
  useEffect(() => {
    setItems([]);
  }, [locationKey, marketStockId]);

  // fetch stock when we have marketStockId
  useEffect(() => {
    if (!marketStockId) {
      setItems([]);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const doc = await getStockByMarketStockId(marketStockId);
        const rawItems = flattenMarketDocToItems(doc);
        const filtered =
          category === "ALL" ? rawItems : rawItems.filter((i) => i.category === category);
        if (mounted) setItems(filtered);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [marketStockId, category]);

  const emptyState = useMemo(() => {
    if (!locationKey) return "Pick your delivery location to continue.";
    if (!shift) return "Choose a shift to load available items.";
    if (!loading && items.length === 0) return "No items available for this shift.";
    return null;
  }, [locationKey, shift, loading, items.length]);

  // ---------- interactions ----------
  const onSelectSavedLocation = (newKey?: string) => {
    if (cartNotEmpty) openGuard({ kind: "locationKey", value: newKey });
    else {
      if (locationKey !== newKey) setLocationKey(newKey);
      const loc = locations.find((l) => l.address === newKey);
      const lc = (loc as any)?.logisticCenterId ?? undefined;
      setLockSafe(lc ?? null, toShiftKey(shift));
    }
  };
  const handleSelectLocation = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectSavedLocation(e.target.value || undefined);
  };

  const onShiftChangeGuarded = (name?: ShiftName) => {
    if (cartNotEmpty && name && name !== shift) openGuard({ kind: "shift", value: name });
    else {
      if (shift !== name) setShift(name);
      setLockSafe(logisticCenterId ?? null, toShiftKey(name));
      if (name) {
        const hit = availableShifts.find((s) => s.key === name);
        setMarketStockId(hit?.marketStockId ?? undefined);
      } else {
        setMarketStockId(undefined);
      }
    }
  };

  const handleMapConfirm = (res: any) => {
    // flexible extraction (supports different map pickers)
    const get = (obj: any, p: string[]) => p.reduce((a, k) => (a == null ? a : a[k]), obj);
    const rawLat =
      res?.lat ??
      res?.latitude ??
      get(res, ["position", "lat"]) ??
      (typeof get(res, ["geometry", "location", "lat"]) === "function"
        ? get(res, ["geometry", "location", "lat"])()
        : undefined);
    const rawLng =
      res?.lng ??
      res?.longitude ??
      get(res, ["position", "lng"]) ??
      (typeof get(res, ["geometry", "location", "lng"]) === "function"
        ? get(res, ["geometry", "location", "lng"])()
        : undefined);

    const payload = {
      address: res?.address ?? res?.formatted_address ?? selectedAddress,
      lat: Number(rawLat),
      lng: Number(rawLng),
    };

    if (cartNotEmpty) openGuard({ kind: "mapPick", value: payload });
    else {
      (async () => {
        setPending({ kind: "mapPick", value: payload });
        await applyPending({ kind: "mapPick", value: payload });
      })();
    }
    setPickerOpen(false);
  };

  // add to cart
  function handleAddToCart(stockId: string, qty: number) {
    const product = items.find((i) => i.stockId === stockId);
    if (!product) return;

    const reserved = reservedByCart[stockId] ?? 0;
    const baseStock = Number(product.availableKg ?? 0);
    const available = Math.max(0, baseStock - reserved);
    if (available <= 0) return;

    const clampQty = Math.max(1, Math.min(qty, available));

    setCartMeta({
      locationKey,
      logisticCenterId,
      shiftKey: toShiftKey(shift),
    });

    addToCartLS({
      inventoryId: stockId,
      name: product.name,
      price: Number(product.pricePerUnit),
      imageUrl: product.imageUrl,
      farmer: { name: product.farmerName, farmName: product.farmName },
      qty: clampQty,
      maxQty: available,
    });

    cart.addOrInc(
      {
        id: stockId,
        name: product.name,
        imageUrl: product.imageUrl,
        pricePerKg: Number(product.pricePerUnit),
        farmerName: product.farmerName || product.farmName || "",
        lcId: logisticCenterId ?? undefined,
        shiftKey: toShiftKey(shift) ?? undefined,
        holdId: undefined,
        holdExpiresAt: Date.now() + 3 * 60_000,
      },
      clampQty
    );
  }

  // render
  const computedItems = useMemo(
    () =>
      items.map((it) => ({
        it,
        displayStock: Math.max(0, Number(it.availableKg ?? 0) - (reservedByCart[it.stockId] ?? 0)),
      })),
    [items, reservedByCart]
  );

  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        <HStack gap={3} mb={4} align="center">
          <Heading size="lg">Market</Heading>
          <span style={{ flex: 1 }} />
          <CartIconButton />
        </HStack>

        <Grid templateColumns={["1fr", null, "1fr 1fr"]} gap={4} mb={3}>
          <GridItem>
            <HStack gap={3} align="end" style={{ flexWrap: "wrap" }}>
              <Field.Root>
                <Field.Label htmlFor="location-select">Saved locations</Field.Label>
                <select
                  id="location-select"
                  value={locationKey ?? ""}
                  onChange={handleSelectLocation}
                  aria-label="Saved locations"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
                    minWidth: 280,
                    background: "var(--chakra-colors-white, #fff)",
                  }}
                >
                  <option value="">
                    {locations.length ? "Choose saved address" : "No saved addresses"}
                  </option>
                  {locations.map((l) => (
                    <option key={l.address} value={l.address}>
                      {l.address}
                    </option>
                  ))}
                </select>
              </Field.Root>

              <Button type="button" onClick={() => setPickerOpen(true)} variant="outline">
                {selectedAddress ? "Change delivery location" : "Pick delivery location"}
              </Button>

              {selectedAddress && (
                <Badge colorPalette="green" variant="surface" title={selectedAddress}>
                  <Text style={{ display: "block", maxWidth: "36ch" }}>{selectedAddress}</Text>
                </Badge>
              )}
            </HStack>
          </GridItem>

          <GridItem>
            <ShiftPicker
              value={shift}
              available={availableShifts.map((s) => s.key)}
              onChange={onShiftChangeGuarded}
            />
          </GridItem>
        </Grid>

        <HStack mb={4}>
          <CategoryFilter value={category} onChange={setCategory} />
        </HStack>

        {emptyState ? (
          <Alert.Root status="info" borderRadius="md">
            <Alert.Indicator />
            <Alert.Description>{emptyState}</Alert.Description>
          </Alert.Root>
        ) : loading ? (
          <HStack justifyContent="center" py={10}>
            <Spinner />
          </HStack>
        ) : (
          <Grid
            templateColumns={["1fr", "repeat(2, 1fr)", "repeat(3, 1fr)", "repeat(4, 1fr)"]}
            gap={6}
          >
            {computedItems.map(({ it, displayStock }) => (
              <ItemCard
                key={it.stockId}
                item={{
                  inventoryId: it.stockId,
                  name: it.name,
                  imageUrl: it.imageUrl,
                  price: Number(it.pricePerUnit),
                  inStock: displayStock,
                  farmer: { name: it.farmerName, farmName: it.farmName },
                  category: it.category,
                } as any}
                displayStock={displayStock}
                onAdd={handleAddToCart}
                disabled={!locationKey || !shift}
              />
            ))}
          </Grid>
        )}

        <MapPickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onConfirm={(r: any) => handleMapConfirm(r)}
          countries={countries}
          initial={{
            address: selectedAddress || undefined,
            lat: 31.771959,
            lng: 35.217018,
          }}
        />

        <Dialog.Root open={!!pending} onOpenChange={(e) => !e.open && setPending(null)}>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="md">
              <Dialog.Header>
                <Dialog.Title>Clear cart?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                Changing your{" "}
                {pending?.kind === "shift" ? "delivery shift" : "delivery location"} will empty your
                cart. Do you want to continue?
              </Dialog.Body>
              <Dialog.Footer gap="2">
                <Button variant="ghost" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button
                  colorPalette="red"
                  onClick={async () => {
                    clearCartEverywhere();
                    await applyPending();
                  }}
                >
                  Confirm
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      </Container>
    </AuthGuard>
  );
}
