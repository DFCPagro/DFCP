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
import { fetchMarket, addLocation, fetchMyLocations } from "@/api/market";
import type {
  MarketItem,
  ShiftCode,
  UserLocation,
  CategoryCode,
} from "@/types/market";
import CartIconButton from "@/components/common/CartIconButton";
import { useCart } from "@/store/cart";
import { useCartItemsUnified } from "@/hooks/useCartItemsUnified";

// LocalStorage cart helpers
import {
  addToCart as addToCartLS,
  clearCart as clearCartLS,
  setCartMeta,
  getCartMeta,
  onCartUpdated,
  type CartLine,
} from "@/utils/cart";

// Cart's canonical ShiftKey type: 'morning'|'afternoon'|'night'
import type { ShiftKey as CartShiftKey } from "@/types/cart";

/* ---------------- ShiftCode ↔ ShiftKey mapping (+legacy EVENING) ---------------- */
function toShiftKey(code?: ShiftCode | null): CartShiftKey | null {
  switch (code) {
    case "MORNING":
      return "morning";
    case "AFTERNOON":
      return "afternoon";
    case "NIGHT":
      return "night";
    // some older parts might still emit "EVENING"
    // @ts-ignore
    case "EVENING":
      return "night";
    default:
      return null;
  }
}
function fromShiftKey(key?: CartShiftKey | null): ShiftCode | undefined {
  switch (key) {
    case "morning":
      return "MORNING";
    case "afternoon":
      return "AFTERNOON";
    case "night":
      return "NIGHT";
    default:
      return undefined;
  }
}
function normalizeKey(input?: unknown): CartShiftKey | null {
  if (!input) return null;
  const v = String(input).toLowerCase();
  if (v === "evening") return "night";
  if (v === "night" || v === "morning" || v === "afternoon")
    return v as CartShiftKey;
  return null;
}
/* ------------------------------------------------------------------------------ */

type PendingAction =
  | { kind: "shift"; value?: ShiftCode }
  | { kind: "locationId"; value?: string }
  | { kind: "mapPick"; value: { address: string; lat: number; lng: number } }
  | null;

export default function Market() {
  const cart = useCart(); // { state, setLock, clear, ... }

  const [locationId, setLocationId] = useState<string>();
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [shift, setShift] = useState<ShiftCode>();
  const [category, setCategory] = useState<CategoryCode | "ALL">("ALL");

  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const countries = "il";

  const [logisticCenterId, setLogisticCenterId] = useState<string>();
  const [locations, setLocations] = useState<UserLocation[]>([]);

  // Live cart items from both sources (store + LS util)
  const storeItems = useCartItemsUnified();
  const [lsItems, setLsItems] = useState<CartLine[]>([]);
  useEffect(() => onCartUpdated(({ items }) => setLsItems(items)), []);

  // ---- Helper: only call cart.setLock when value actually changes
  const lastLock = useRef<{ lc: string | null; sk: CartShiftKey | null }>({
    lc: null,
    sk: null,
  });
  const setLockSafe = (lc: string | null, sk: CartShiftKey | null) => {
    if (lastLock.current.lc !== lc || lastLock.current.sk !== sk) {
      lastLock.current = { lc, sk };
      cart.setLock(lc, sk);
    }
  };

  // Reserved map from cart (inventoryId -> qty)
  const reservedByCart = useMemo(() => {
    const m: Record<string, number> = {};
    const fold = (list: any[]) => {
      for (const it of list ?? []) {
        const id = (it as any).id ?? (it as any).inventoryId;
        const qty = Number((it as any).qtyKg ?? (it as any).qty ?? 1);
        if (!id) continue;
        m[id] = (m[id] ?? 0) + (isFinite(qty) ? qty : 0);
      }
    };
    fold(storeItems as any[]);
    fold(lsItems as any[]);
    return m;
  }, [storeItems, lsItems]);

  // Guard dialog
  const [pending, setPending] = useState<PendingAction>(null);
  const cartNotEmpty = (storeItems?.length ?? 0) + (lsItems?.length ?? 0) > 0;
  const openGuard = (a: PendingAction) => setPending(a);

  // Clear cart everywhere
  const clearCartEverywhere = () => {
    if ((cart as any)?.clear) (cart as any).clear();
    clearCartLS();
  };

  // Apply guarded change (with lock updates)
  const applyPending = async () => {
    const p = pending;
    setPending(null);
    clearCartEverywhere();
    if (!p) return;

    if (p.kind === "shift") {
      setShift((prev) => (prev === p.value ? prev : p.value));
      setLockSafe(logisticCenterId ?? null, toShiftKey(p.value));
    } else if (p.kind === "locationId") {
      const newId = p.value;
      setLocationId((prev) => (prev === newId ? prev : newId));
      setSelectedAddress((prev) => (prev === "" ? prev : "")); // clear label; will re-derive
      const loc = locations.find((l) => l._id === newId);
      const lc = (loc as any)?.logisticCenterId ?? undefined;
      setLogisticCenterId((prev) => (prev === lc ? prev : lc));
      setLockSafe(lc ?? null, toShiftKey(shift));
    } else if (p.kind === "mapPick") {
      const { address, lat, lng } = p.value;
      const parts = address.split(",").map((s) => s.trim());
      const city = parts.length >= 2 ? ((parts.at(-2) as string) ?? "") : "";
      const street = address;
      const saved: UserLocation = await addLocation({
        label: address,
        street,
        city,
        lat,
        lng,
      });

      setLocationId((prev) => (prev === saved._id ? prev : saved._id));
      setSelectedAddress((prev) =>
        prev === (saved.label || address) ? prev : (saved.label || address)
      );
      const lc = (saved as any)?.logisticCenterId ?? undefined;
      setLogisticCenterId((prev) => (prev === lc ? prev : lc));
      setLockSafe(lc ?? null, toShiftKey(shift));

      try {
        const refreshed = await fetchMyLocations();
        setLocations(refreshed);
      } catch {}
    }
  };

  // Fetch saved locations once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchMyLocations();
        if (mounted) setLocations(list);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // When locationId resolves, update label/LC and lock (only if changed)
  useEffect(() => {
    if (!locationId) {
      if (selectedAddress !== "") setSelectedAddress("");
      if (logisticCenterId !== undefined) setLogisticCenterId(undefined);
      setLockSafe(null, toShiftKey(shift)); // lc cleared
      return;
    }
    const loc = locations.find((l) => l._id === locationId);
    if (!loc) return;
    if (loc.label && loc.label !== selectedAddress) {
      setSelectedAddress(loc.label);
    }
    const lc = (loc as any)?.logisticCenterId ?? undefined;
    if (lc !== logisticCenterId) {
      setLogisticCenterId(lc);
      setLockSafe(lc ?? null, toShiftKey(shift));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, locations]); // (avoid including selectedAddress/logisticCenterId to prevent churn)

  // Hydrate once from saved meta (idempotent)
  useEffect(() => {
    const meta = getCartMeta();
    // location
    if (meta?.locationId && meta.locationId !== locationId) {
      setLocationId(meta.locationId);
    }
    // shift (normalize legacy)
    const key = normalizeKey((meta as any)?.shiftKey);
    const shiftCode = fromShiftKey(key);
    if (shiftCode && shiftCode !== shift) {
      setShift(shiftCode);
    }
    // lock
    setLockSafe(meta?.logisticCenterId ?? null, key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep lock in sync when shift changes (only if it actually changes)
  const lastShiftForLock = useRef<ShiftCode | undefined>(undefined);
  useEffect(() => {
    if (lastShiftForLock.current !== shift) {
      lastShiftForLock.current = shift;
      setLockSafe(logisticCenterId ?? null, toShiftKey(shift));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift]);

  // Reset items when location changes (but avoid re-render churn)
  useEffect(() => {
    setItems([]); // safe clear
  }, [locationId]);

  // Fetch items (locationId + shift + category)
  useEffect(() => {
    if (!locationId || !shift) {
      setItems([]);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchMarket({ locationId, shift, category });
        if (mounted) setItems(res);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [locationId, shift, category]);

  const emptyState = useMemo(() => {
    if (!locationId) return "Pick your delivery location to continue.";
    if (!shift) return "Choose a shift to load available items.";
    if (!loading && items.length === 0)
      return "No items available for this shift.";
    return null;
  }, [locationId, shift, loading, items.length]);

  // Guarded handlers
  const onSelectSavedLocation = (newId?: string) => {
    if (cartNotEmpty) openGuard({ kind: "locationId", value: newId });
    else {
      if (locationId !== newId) setLocationId(newId);
      const loc = locations.find((l) => l._id === newId);
      const lc = (loc as any)?.logisticCenterId ?? undefined;
      setLockSafe(lc ?? null, toShiftKey(shift));
    }
  };

  const onShiftChangeGuarded = (s?: ShiftCode) => {
    if (cartNotEmpty && s && s !== shift) openGuard({ kind: "shift", value: s });
    else {
      if (shift !== s) setShift(s);
      setLockSafe(logisticCenterId ?? null, toShiftKey(s));
    }
  };

  type MapConfirm =
    | { address: string; lat: number; lng: number }
    | { address: string; latitude: number; longitude: number };

  const handleMapConfirm = (res: MapConfirm) => {
    const lat = "lat" in res ? res.lat : (res as any).latitude;
    const lng = "lng" in res ? res.lng : (res as any).longitude;
    const payload = { address: res.address, lat, lng };
    if (cartNotEmpty) openGuard({ kind: "mapPick", value: payload });
    else {
      (async () => {
        setPending({ kind: "mapPick", value: payload });
        await applyPending();
      })();
    }
    setPickerOpen(false);
  };

  // Add to cart (clamps qty; persists meta; updates lock safely)
// ======= Add to cart (clamps to available; stores meta + updates store) =======
function handleAddToCart(inventoryId: string, qty: number) {
  const product = items.find((i) => i.inventoryId === inventoryId);
  if (!product) return;

  const reserved = reservedByCart[inventoryId] ?? 0;
  const baseStock = Number(product.inStock ?? 0);
  const available = Math.max(0, baseStock - reserved);
  if (available <= 0) return;

  const clampQty = Math.max(1, Math.min(qty, available));

  setCartMeta({
    locationId,
    logisticCenterId,
    shiftKey: toShiftKey(shift),
  });

  addToCartLS({
    inventoryId,
    name: product.name,
    price: Number(product.price ?? 0),
    imageUrl: product.imageUrl,
    farmer: product.farmer
      ? { name: product.farmer.name, farmName: product.farmer.farmName }
      : undefined,
    qty: clampQty,
    maxQty: available,
  });

  cart.addOrInc(
    {
      id: inventoryId,
      name: product.name,
      imageUrl: product.imageUrl,
      pricePerKg: Number(product.price ?? 0),
      farmerName:
        product.farmer ? product.farmer.name || product.farmer.farmName : "",
      lcId: logisticCenterId ?? undefined,
      shiftKey: toShiftKey(shift) ?? undefined,
      holdId: undefined,
      holdExpiresAt: Date.now() + 3 * 60_000,
    },
    clampQty
  );
}



  // Render list with live reserved stock
  const computedItems = useMemo(
    () =>
      items.map((it) => ({
        it,
        displayStock: Math.max(
          0,
          Number(it.inStock ?? 0) - (reservedByCart[it.inventoryId] ?? 0)
        ),
      })),
    [items, reservedByCart]
  );

  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        {/* Header */}
        <HStack gap={3} mb={4} align="center">
          <Heading size="lg">Market</Heading>
          <span style={{ flex: 1 }} />
          <CartIconButton />
        </HStack>

        {/* Controls */}
        <Grid templateColumns={["1fr", null, "1fr 1fr"]} gap={4} mb={3}>
          <GridItem>
            <HStack gap={3} align="end" style={{ flexWrap: "wrap" }}>
              <Field.Root>
                <Field.Label htmlFor="location-select">
                  Saved locations
                </Field.Label>
                <select
                  id="location-select"
                  value={locationId ?? ""}
                  onChange={(e) =>
                    onSelectSavedLocation(e.target.value || undefined)
                  }
                  aria-label="Saved locations"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border:
                      "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
                    minWidth: 280,
                    background: "var(--chakra-colors-white, #fff)",
                  }}
                >
                  <option value="">
                    {locations.length
                      ? "Choose saved address"
                      : "No saved addresses"}
                  </option>
                  {locations.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field.Root>

              <Button
                type="button"
                onClick={() => setPickerOpen(true)}
                variant="outline"
              >
                {selectedAddress
                  ? "Change delivery location"
                  : "Pick delivery location"}
              </Button>

              {selectedAddress && (
                <Badge
                  colorPalette="green"
                  variant="surface"
                  title={selectedAddress}
                >
                  <Text style={{ display: "block", maxWidth: "36ch" }}>
                    {selectedAddress}
                  </Text>
                </Badge>
              )}
            </HStack>
          </GridItem>

          <GridItem>
            <ShiftPicker
              locationId={locationId}
              logisticCenterId={logisticCenterId}
              value={shift}
              onChange={onShiftChangeGuarded}
            />
          </GridItem>
        </Grid>

        {/* Category filter */}
        <HStack mb={4}>
          <CategoryFilter value={category} onChange={setCategory} />
        </HStack>

        {/* Content */}
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
            templateColumns={[
              "1fr",
              "repeat(2, 1fr)",
              "repeat(3, 1fr)",
              "repeat(4, 1fr)",
            ]}
            gap={6}
          >
            {computedItems.map(({ it, displayStock }) => (
              <ItemCard
                key={it.inventoryId}
                item={{ ...it, inStock: displayStock }}
                displayStock={displayStock}
                onAdd={handleAddToCart}
                disabled={!locationId || !shift}
              />
            ))}
          </Grid>
        )}

        {/* Map picker */}
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

        {/* Confirm dialog */}
        <Dialog.Root
          open={!!pending}
          onOpenChange={(e) => !e.open && setPending(null)}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="md">
              <Dialog.Header>
                <Dialog.Title>Clear cart?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                Changing your{" "}
                {pending?.kind === "shift"
                  ? "delivery shift"
                  : "delivery location"}{" "}
                will empty your cart. Do you want to continue?
              </Dialog.Body>
              <Dialog.Footer gap="2">
                <Button variant="ghost" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button colorPalette="red" onClick={applyPending}>
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
