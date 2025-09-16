// src/pages/Market.tsx
import { useEffect, useMemo, useState } from "react";
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
} from "@chakra-ui/react";
import AuthGuard from "@/guards/AuthGuard";
import MapPickerDialog from "@/components/common/MapPickerDialog";
import ShiftPicker from "@/components/ui/ShiftPicker";
import ItemCard from "@/components/feature/market/ItemCard";
import CategoryFilter from "@/components/feature/market/CategoryFilter";
import { fetchMarket, addLocation, fetchMyLocations } from "@/api/market";
import type { MarketItem, ShiftCode, UserLocation, CategoryCode } from "@/types/market";
import CartIconButton from "@/components/common/CartIconButton";
import { useCart } from "@/store/cart";

export default function Market() {
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
  const cart = useCart();

  // Load saved locations
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchMyLocations();
        setLocations(res);
      } catch {/* ignore */}
    })();
  }, []);

  // Sync address + LC when user selects from dropdown
  useEffect(() => {
    if (!locationId) {
      setSelectedAddress("");
      setLogisticCenterId(undefined);
      return;
    }
    const loc = locations.find((l) => l._id === locationId);
    if (loc) {
      if (loc.label) setSelectedAddress(loc.label);
      setLogisticCenterId((loc as any).logisticCenterId || undefined);
    }
  }, [locationId, locations]);

  // When we have both LC and shift, set them in cart meta so the Cart page shows the badges
  useEffect(() => {
    const setMeta =
      (cart as any)?.setMeta ??
      (useCart as any).getState?.()?.setMeta;
    if (setMeta && logisticCenterId && shift) {
      setMeta({ lcId: logisticCenterId, shiftKey: shift });
    }
  }, [cart, logisticCenterId, shift]);

  // Reset items when location changes
  useEffect(() => {
    setShift(undefined);
    setItems([]);
  }, [locationId]);

  // Fetch items for location/shift/category
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
    if (!loading && items.length === 0) return "No items available for this shift.";
    return null;
  }, [locationId, shift, loading, items.length]);

  // 🔧 Robust "add to cart" that always updates state.items (what the Cart page renders)
  function handleAddToCart(inventoryId: string, qty: number) {
    const product = items.find((i) => i.inventoryId === inventoryId);
    if (!product || qty <= 0) return;

    const payload = {
      id: inventoryId,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      farmer: product.farmer,
      qty,
    };

    // 1) Try common store APIs first
    const apiNow = cart as any;
    const apiRaw = (useCart as any).getState?.() || {};
    const addItem =
      apiNow?.addItem ?? apiNow?.add ?? apiNow?.upsertItem ??
      apiRaw?.addItem ?? apiRaw?.add ?? apiRaw?.upsertItem ??
      apiNow?.actions?.addItem ?? apiRaw?.actions?.addItem;

    if (typeof addItem === "function") {
      try {
        addItem(payload);
      } catch {/* fall through to manual */}
    } else {
      // 2) Fallback: mutate state.items (the Cart page reads `state.items`)
      const setter =
        apiNow?.set ?? apiNow?.setState ?? apiRaw?.set ?? apiRaw?.setState;
      if (typeof setter === "function") {
        setter((prev: any) => {
          const prevState = prev?.state ?? {};
          const prevItems = prevState.items ?? [];
          const idx = prevItems.findIndex((x: any) => x.id === payload.id);
          const nextItems =
            idx === -1
              ? [...prevItems, payload]
              : prevItems.map((x: any, i: number) =>
                  i === idx ? { ...x, qty: (x.qty ?? 0) + qty } : x
                );
          return {
            ...prev,
            state: { ...prevState, items: nextItems },
            lcId: logisticCenterId ?? prev?.lcId,
            shiftKey: shift ?? prev?.shiftKey,
          };
        });
      } else {
        // 3) Last-ditch: direct mutation if the store exposes `state` but no setter
        try {
          if (apiNow?.state && Array.isArray(apiNow.state.items)) {
            const idx = apiNow.state.items.findIndex((x: any) => x.id === payload.id);
            if (idx === -1) apiNow.state.items.push(payload);
            else apiNow.state.items[idx] = {
              ...apiNow.state.items[idx],
              qty: (apiNow.state.items[idx].qty ?? 0) + qty,
            };
          }
        } catch {
          console.warn("[Market] Could not push item into cart. Exposed keys:", Object.keys(apiNow || {}));
        }
      }
    }

    // Optimistic stock decrement on the list
    setItems((prev) =>
      prev.map((it) =>
        it.inventoryId === inventoryId
          ? { ...it, inStock: Math.max(0, Number(it.inStock ?? 0) - qty) }
          : it
      )
    );
  }

  type MapConfirm =
    | { address: string; lat: number; lng: number }
    | { address: string; latitude: number; longitude: number };

  async function handleMapConfirm(res: MapConfirm) {
    const lat = "lat" in res ? res.lat : (res as any).latitude;
    const lng = "lng" in res ? res.lng : (res as any).longitude;

    const parts = res.address.split(",").map((s) => s.trim());
    const city = parts.length >= 2 ? ((parts.at(-2) as string) ?? "") : "";
    const street = res.address;

    const saved: UserLocation = await addLocation({
      label: res.address,
      street,
      city,
      lat,
      lng,
    });

    setLocationId(saved._id);
    setSelectedAddress(saved.label || res.address);
    setLogisticCenterId((saved as any).logisticCenterId || undefined);
    setPickerOpen(false);

    try {
      const refreshed = await fetchMyLocations();
      setLocations(refreshed);
    } catch {/* ignore */}
  }

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
            <HStack gap={3} align="end" wrap="wrap">
              <Field.Root>
                <Field.Label htmlFor="location-select">Saved locations</Field.Label>
                <select
                  id="location-select"
                  value={locationId ?? ""}
                  onChange={(e) => setLocationId(e.target.value || undefined)}
                  aria-label="Saved locations"
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--chakra-colors-gray-300)",
                    minWidth: 280,
                    background: "var(--chakra-colors-white)",
                  }}
                >
                  <option value="">
                    {locations.length ? "Choose saved address" : "No saved addresses"}
                  </option>
                  {locations.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </Field.Root>

              <Button type="button" onClick={() => setPickerOpen(true)} variant="outline">
                {selectedAddress ? "Change delivery location" : "Pick delivery location"}
              </Button>

              {selectedAddress && (
                <Badge colorPalette="green" variant="surface" title={selectedAddress}>
                  <Text lineClamp={1} maxW="36ch">
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
              onChange={setShift}
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
            {items.map((it) => (
              <ItemCard
                key={it.inventoryId}
                item={it}
                onAdd={handleAddToCart}
                disabled={!locationId || !shift}
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
      </Container>
    </AuthGuard>
  );
}
