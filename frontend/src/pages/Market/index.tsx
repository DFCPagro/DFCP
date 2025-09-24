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
  Input,
} from "@chakra-ui/react";
import { z } from "zod";

import AuthGuard from "@/guards/AuthGuard";
import MapPickerDialog from "@/components/common/MapPickerDialog";
import ItemCard from "@/components/feature/market/ItemCard";
import CategoryFilter, { type CatCode } from "@/components/feature/market/CategoryFilter";
import {
  getAvailableShiftsByLC,
  addCustomerAddress,
  getCustomerAddresses,
  getStockByMarketStockId,
} from "@/api/market";

import {
  type MarketItem,
  type ShiftName,
  AvailableShiftFlatSchema,
  type AvailableShiftFlat,
  flattenMarketDocToItems,
} from "@/types/market";
import type { Address } from "@/types/address";
import type { AxiosError } from "axios";

import CartIconButton from "@/components/common/CartIconButton";

import type { ShiftKey as CartShiftKey } from "@/types/cart";
import {
  getActiveCart,
  addToCart as addToCartApi,
  clearCart as clearCartApi,
} from "@/api/cart";
import type { Cart } from "@/api/cart";

// ---------------- helpers ----------------
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

// Map backend shift doc (works for both next5 and getActive)
const mapShift = (r: any) => ({
  date: String(r.availableDate ?? r.date).slice(0, 10),
  shift: (r.availableShift ?? r.shift) as ShiftName,
  marketStockId: r._id ?? r.docId,
  slotLabel: r.deliverySlotLabel ?? "",
});

const shiftHuman = (s: ShiftName) =>
  s === "morning" ? "Morning" : s === "afternoon" ? "Afternoon" : s === "evening" ? "Evening" : "Night";

// =========================================

export default function Market() {
  // Location & LC
  const [locationKey, setLocationKey] = useState<string>();
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [logisticCenterId, setLogisticCenterId] = useState<string>();
  const [locations, setLocations] = useState<Address[]>([]);

  // Shifts
  const [availableShifts, setAvailableShifts] = useState<AvailableShiftFlat[]>([]);
  const [shift, setShift] = useState<ShiftName>();
  const [marketStockId, setMarketStockId] = useState<string>();

  // Items
  const [category, setCategory] = useState<CatCode>("ALL");
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Server cart
  const [serverCart, setServerCart] = useState<Cart | null>(null);

  // wipe any legacy LS carts once
  useEffect(() => {
    ["cart_v1", "dfcp_cart_v1", "cart_meta_v1"].forEach((k) => localStorage.removeItem(k));
  }, []);

  // Search
  const [query, setQuery] = useState("");

  // Guards
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState<
    | { kind: "shift"; value?: ShiftName }
    | { kind: "locationKey"; value?: string }
    | { kind: "mapPick"; value: { address: string; lat: number; lng: number } }
    | null
  >(null);
  const countries = "il";

  const cartNotEmpty = (serverCart?.items?.length ?? 0) > 0;

  // lock placeholder (no local store anymore)
  const lastLock = useRef<{ lc: string | null; sk: CartShiftKey | null }>({ lc: null, sk: null });
  const addingRef = useRef(false);
  const setLockSafe = (lc: string | null, sk: CartShiftKey | null) => {
    if (lastLock.current.lc !== lc || lastLock.current.sk !== sk) {
      lastLock.current = { lc, sk };
    }
  };

  // reserved map (by stockId)
  const lineIdToStockId = useMemo(() => {
    const m: Record<string, string> = {};
    for (const it of items) m[it.lineId] = it.stockId;
    return m;
  }, [items]);

  const reservedByCart = useMemo(() => {
    const m: Record<string, number> = {};
    for (const ln of serverCart?.items ?? []) {
      const stockId = lineIdToStockId[ln.availableMarketStockItemId];
      if (!stockId) continue;
      const qty = Number(ln.amountKg ?? 0);
      m[stockId] = (m[stockId] ?? 0) + (isFinite(qty) ? qty : 0);
    }
    return m;
  }, [serverCart, lineIdToStockId]);

  const openGuard = (a: NonNullable<typeof pending>) => setPending(a);

  const clearCartEverywhere = async () => {
    if (!serverCart?._id) {
      setServerCart(null);
      return;
    }
    try {
      await clearCartApi(serverCart._id); // 204
    } catch (e) {
      console.error("clearCart failed", e);
    } finally {
      try {
        if (marketStockId) {
          const fresh = await getActiveCart(marketStockId);
          setServerCart(fresh);
        } else {
          setServerCart(null);
        }
      } catch {
        setServerCart(null);
      }
    }
  };

  const applyPending = async (action?: NonNullable<typeof pending>) => {
    const p = action ?? pending;
    setPending(null);
    if (!p) return;

    if (p.kind === "shift") {
      setShift((prev) => (prev === p.value ? prev : p.value));
      if (p.value) {
        const hit = availableShifts.find((s) => s.shift === p.value);
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
      try {
        const updatedList = await addCustomerAddress({ address, lnt: lat, alt: lng });
        const list: Address[] = Array.isArray(updatedList) ? updatedList : [updatedList];
        setLocations(list);

        const added = list.find((a) => a.address === address) ?? list[list.length - 1];
        if (added) {
          setLocationKey(added.address);
          setSelectedAddress(added.address);
          const lc = (added as any)?.logisticCenterId ?? undefined;
          setLogisticCenterId(lc);
          setLockSafe(lc ?? null, toShiftKey(shift));
        }
      } catch {
        setLocations((prev) => {
          if (prev.some((a) => a.address === address)) return prev;
          return [{ address, lnt: lat, alt: lng, logisticCenterId: undefined as any }, ...prev];
        });
        setLocationKey(address);
        setSelectedAddress(address);
      } finally {
        setAvailableShifts([]);
        setMarketStockId(undefined);
        try {
          const refreshed = await getCustomerAddresses();
          setLocations(refreshed);
        } catch {}
      }
    }
  };

  // initial load: saved addresses
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await getCustomerAddresses();
        if (mounted) setLocations(list);
      } catch {}
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
  }, [locationKey, locations]); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch available shifts when LC exists
  useEffect(() => {
    if (!logisticCenterId) {
      setAvailableShifts([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const raw = await getAvailableShiftsByLC(logisticCenterId);
        const parsed: AvailableShiftFlat[] = z
          .array(AvailableShiftFlatSchema)
          .parse(raw.map(mapShift));
        if (!mounted) return;
        setAvailableShifts(parsed);
        if (shift) {
          const hit = parsed.find((s) => s.shift === shift);
          setMarketStockId(hit?.marketStockId ?? undefined);
        }
      } catch {
        if (mounted) {
          setAvailableShifts([]);
          setMarketStockId(undefined);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [logisticCenterId, shift]);

  // keep lock on shift changes and map to marketStockId
  const lastShiftForLock = useRef<ShiftName | undefined>(undefined);
  useEffect(() => {
    if (lastShiftForLock.current !== shift) {
      lastShiftForLock.current = shift;
      setLockSafe(logisticCenterId ?? null, toShiftKey(shift));
      if (shift) {
        const hit = availableShifts.find((s) => s.shift === shift);
        setMarketStockId(hit?.marketStockId ?? undefined);
      } else {
        setMarketStockId(undefined);
      }
    }
  }, [shift, availableShifts, logisticCenterId]); // eslint-disable-line react-hooks/exhaustive-deps

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
          category === "ALL"
            ? rawItems
            : rawItems.filter((i) => String(i.category || "").toLowerCase() === category);
        if (mounted) setItems(filtered);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [marketStockId, category]);

  // get server cart for the current marketStockId
  useEffect(() => {
    if (!marketStockId) {
      setServerCart(null);
      return;
    }
    const ctl = new AbortController();
    (async () => {
      try {
        const c = await getActiveCart(marketStockId, { signal: ctl.signal });
        setServerCart(c);
      } catch {
        if (!ctl.signal.aborted) setServerCart(null);
      }
    })();
    return () => ctl.abort();
  }, [marketStockId]);

  // display list with reserved deduction
  const computedItems = useMemo(
    () =>
      items.map((it) => ({
        it,
        displayStock: Math.max(0, Number(it.availableKg ?? 0) - (reservedByCart[it.stockId] ?? 0)),
      })),
    [items, reservedByCart]
  );

  // real-time search filter
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return computedItems;
    return computedItems.filter(({ it }) => {
      const hay = `${it.name} ${it.farmerName ?? ""} ${it.farmName ?? ""} ${it.category ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [computedItems, query]);

  const emptyState = useMemo(() => {
    if (!locationKey) return "Pick your delivery location to continue.";
    if (!shift) return "Choose a shift to load available items.";
    if (!loading && query && visibleItems.length === 0) return "No items match your search.";
    if (!loading && items.length === 0) return "No items available for this shift.";
    return null;
  }, [locationKey, shift, loading, items.length, query, visibleItems.length]);

  // interactions
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
        const hit = availableShifts.find((s) => s.shift === name);
        setMarketStockId(hit?.marketStockId ?? undefined);
      } else {
        setMarketStockId(undefined);
      }
    }
  };

  const handleSelectShift = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = (e.target.value || "") as ShiftName | "";
    onShiftChangeGuarded(val ? val : undefined);
  };

  const handleMapConfirm = (res: any) => {
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

  async function handleAddToCart(stockId: string, qty: number) {
    if (addingRef.current) return;
    addingRef.current = true;
    try {
      const product = items.find((i) => i.stockId === stockId);
      if (!product || !marketStockId) return;

      const reserved = reservedByCart[stockId] ?? 0;
      const available = Math.max(0, Number(product.availableKg ?? 0) - reserved);
      if (available <= 0) return;

      const clampQty = Math.max(1, Math.min(qty, available));

      try {
        const updated = await addToCartApi({
          availableMarketStockId: marketStockId,
          amsItemId: product.lineId,
          amountKg: clampQty,
        });
        setServerCart(updated);
        return;
      } catch (e) {
        const err = e as AxiosError<any>;
        const msg = String(err.response?.data?.message ?? "");
        const m = msg.match(/Current global shift is '(\w+)'/i);

        if (err.response?.status === 400 && m) {
          const target = m[1] as ShiftName;

          // ensure we have that shift; refetch if needed
          let hit = availableShifts.find((s) => s.shift === target);
          if (!hit && logisticCenterId) {
            try {
              const raw = await getAvailableShiftsByLC(logisticCenterId);
              const parsed: AvailableShiftFlat[] = z
                .array(AvailableShiftFlatSchema)
                .parse(raw.map(mapShift));
              setAvailableShifts(parsed);
              hit = parsed.find((s) => s.shift === target);
            } catch {
              /* ignore */
            }
          }
          if (!hit) {
            console.error("Server shift missing after refresh:", target);
            return;
          }

          if (cartNotEmpty && shift !== target) {
            openGuard({ kind: "shift", value: target });
            return;
          }

          // switch and retry once
          setShift(target);
          setMarketStockId(hit.marketStockId);
          try {
            const updated = await addToCartApi({
              availableMarketStockId: hit.marketStockId,
              amsItemId: product.lineId,
              amountKg: clampQty,
            });
            setServerCart(updated);
          } catch (e2) {
            console.error("retry addToCart failed", e2);
          }
          return;
        }

        console.error("addToCart failed", err);
      }
    } finally {
      addingRef.current = false;
    }
  }

  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        <HStack gap={3} mb={4} align="center">
          <Heading size="lg">Market</Heading>
          <span style={{ flex: 1 }} />
          <CartIconButton count={serverCart?.items?.length ?? 0} />
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
            <Field.Root>
              <Field.Label htmlFor="shift-select">Delivery shift</Field.Label>
              <select
                id="shift-select"
                value={shift ?? ""}
                onChange={handleSelectShift}
                disabled={!availableShifts.length}
                aria-label="Delivery shift"
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
                  minWidth: 240,
                  background: "var(--chakra-colors-white, #fff)",
                }}
              >
                <option value="">
                  {!logisticCenterId
                    ? "Pick location first"
                    : availableShifts.length
                    ? "Choose shift"
                    : "No shifts available"}
                </option>
                {availableShifts.map((s) => (
                  <option key={s.shift} value={s.shift}>
                    {shiftHuman(s.shift)}{s.slotLabel ? ` • ${s.slotLabel}` : ""}{" "}
                    {s.date ? `• ${s.date}` : ""}
                  </option>
                ))}
              </select>
            </Field.Root>
          </GridItem>
        </Grid>

        <HStack mb={4} gap="3" align="center" style={{ flexWrap: "wrap" }}>
          <CategoryFilter value={category} onChange={setCategory} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items or farmers"
            aria-label="Search items"
            maxW="360px"
          />
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
            {visibleItems.map(({ it, displayStock }) => (
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
                    await clearCartEverywhere();
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
