import { useEffect, useMemo, useState } from "react";
import {
  Container,
  Heading,
  Box,
  HStack,
  Stack,
  Text,
  Button,
  Badge,
  Alert,
  Spinner,
  Field,
  Fieldset,
  Input,
} from "@chakra-ui/react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { getCustomerAddresses } from "@/api/market";
import { createOrder } from "@/api/orders";
import type { Address } from "@/types/address";
import ItemList, { type ItemRow as UIItemRow } from "@/components/common/ItemList";
import {
  getCart as getSharedCart,
  clearCart as clearSharedCart,
  getCartStorageKey,
  type CartSnapshot as SharedCartSnapshot,
} from "@/utils/marketCart.shared";

export default function Checkout() {
  const [sp] = useSearchParams();

  // URL params as provided (may be empty right now)
  const amsIdParam = sp.get("ams") || "";
  const lcParam = sp.get("lc") || "";
  const dateParam = sp.get("date") || "";

  const navigate = useNavigate();

  const [cart, setCart] = useState<SharedCartSnapshot | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payMethod: "card" = "card";

  // Log initial URL params
  console.groupCollapsed("[Checkout] URL params");
  // console.log({ amsId: amsIdParam, logisticsCenterId: lcParam, deliveryDate: dateParam });
  console.groupEnd();

  // Extra: log localStorage inventory (once)
  useEffect(() => {
    console.groupCollapsed("[Checkout] localStorage keys");
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      console.log(" •", key);
    }
    console.groupEnd();

    const resolvedKey = getCartStorageKey();
    console.groupCollapsed("[Checkout] resolved cart storage key");
    console.log("getCartStorageKey() ->", resolvedKey);
    if (resolvedKey) {
      const raw = localStorage.getItem(resolvedKey);
      console.log("raw value under key:", resolvedKey, "->", raw);
    }
    console.groupEnd();
  }, []);

  // Load shared cart + addresses
  useEffect(() => {
    let alive = true;
    console.group("[Checkout] useEffect load");
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const shared = getSharedCart();
        console.groupCollapsed("[Checkout] Shared cart read");
        console.log("storageKey:", shared.storageKey);
        console.log("lines.length:", shared.lines.length);
        if (shared.lines.length) {
          console.table(
            shared.lines.map((l, idx) => ({
              idx,
              key: l.key,
              itemId: l.itemId,
              farmerOrderId: l.farmerOrderId,
              name: l.name,
              qty: l.quantity,
              pricePerUnit: l.pricePerUnit,
              category: l.category,
            }))
          );
        }
        console.groupEnd();

        const addr = await getCustomerAddresses().catch(() => [] as Address[]);
        console.groupCollapsed("[Checkout] Addresses read");
        console.log("addresses.length:", addr.length);
        if (addr[0]) {
          console.log("first address:", {
            address: (addr[0] as any)?.address,
            lnt: (addr[0] as any)?.lnt ?? (addr[0] as any)?.lng,
            alt: (addr[0] as any)?.alt ?? (addr[0] as any)?.lat,
            logisticCenterId: (addr[0] as any)?.logisticCenterId,
          });
        }
        console.groupEnd();

        if (!alive) return;
        setCart(shared);
        setAddresses(addr);
      } catch (e: any) {
        if (!alive) return;
        console.error("[Checkout] load error:", e);
        setError(e?.message || "Failed to load checkout data");
        setCart(null);
      } finally {
        if (alive) setLoading(false);
        console.groupEnd(); // useEffect
      }
    })();

    return () => {
      alive = false;
    };
  }, [amsIdParam, lcParam, dateParam]);

  const lines = cart?.lines ?? [];

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (a, l) => a + Number(l.quantity || 0) * Number(l.pricePerUnit || 0),
      0
    );
    return { subtotal, grand: subtotal };
  }, [lines]);

  const addr = addresses[0];
  const addressLabel = addr?.address || "No saved address";
  const cartEmpty = lines.length === 0;

  const itemRows = useMemo<UIItemRow[]>(() => {
    const rows = lines.map((l) => ({
      id: String(l.key || l.itemId || Math.random()),
      name: l.name,
      farmer: l.sourceFarmerName || l.sourceFarmName || "",
      qty: Number(l.quantity || 0),
      unitLabel: "unit",
      unitPrice: Number(l.pricePerUnit || 0),
      currency: "$",
    }));
    console.groupCollapsed("[Checkout] ItemList rows (UI)");
    console.table(rows);
    console.groupEnd();
    return rows;
  }, [lines]);

  // --- Soft inference for missing URL params (keeps UI unchanged) ---
  const inferred = useMemo(() => {
    // Try to infer AMS/LC from common fields we may have in lines or address
    const first = lines[0] as any;
    const amsFromLine =
      first?.amsId ||
      first?.availableMarketStockId ||
      (cart as any)?.availableMarketStockId ||
      "";

    const lcFromAddress =
      (addr as any)?.logisticsCenterId ||
      (addr as any)?.lcId ||
      (addr as any)?.LCid ||
      "";

    // Default date: today in YYYY-MM-DD (only as a fallback for testing)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateFallback = `${yyyy}-${mm}-${dd}`;

    const inferredVals = {
      amsId: amsFromLine,
      logisticsCenterId: lcFromAddress,
      deliveryDate: dateFallback,
    };

    console.groupCollapsed("[Checkout] Inferred context (fallbacks)");
    console.log(inferredVals);
    console.groupEnd();

    return inferredVals;
  }, [lines, cart, addr]);

  const finalAmsId = amsIdParam || inferred.amsId || "";
  const finalLC = lcParam || inferred.logisticsCenterId || "";
  const finalDate = dateParam || inferred.deliveryDate || "";

  // Pre-flight: ensure we have required fields for POST /orders
  const missingFarmerOrderId = useMemo(() => {
    const missing = lines.some((l) => !l.farmerOrderId);
    if (missing) {
      console.warn("[Checkout] Preflight: missing farmerOrderId on some lines");
      console.table(
        lines.map((l, i) => ({
          idx: i,
          key: l.key,
          itemId: l.itemId,
          farmerOrderId: l.farmerOrderId,
          name: l.name,
        }))
      );
    }
    return missing;
  }, [lines]);

  const missingOrderContext = useMemo(() => {
    const missing = !finalAmsId || !finalLC || !finalDate || !addr?.address;
    if (missing) {
      console.warn("[Checkout] Preflight: missing order context (final)", {
        hasAmsId: !!finalAmsId,
        hasLogisticsCenterId: !!finalLC,
        hasDeliveryDate: !!finalDate,
        hasAddress: !!addr?.address,
      });
    } else {
      console.info("[Checkout] Preflight: context OK", {
        amsId: finalAmsId,
        logisticsCenterId: finalLC,
        deliveryDate: finalDate,
      });
    }
    return missing;
  }, [finalAmsId, finalLC, finalDate, addr]);

  async function placeOrder() {
    if (cartEmpty || busy) {
      console.warn("[Checkout] placeOrder blocked: cartEmpty or busy", { cartEmpty, busy });
      return;
    }

    if (missingFarmerOrderId) {
      setError("Some items are missing farmerOrderId and cannot be ordered. Please remove and re-add them from the Market.");
      return;
    }
    if (missingOrderContext) {
      setError("Missing delivery details. Please open Checkout from Market with AMS, LC, and Date or select delivery details.");
      return;
    }

    setBusy(true);
    setError(null);
    console.group("[Checkout] placeOrder()");
    try {
      const deliveryAddress = {
        lnt: Number((addr as any)?.lnt ?? (addr as any)?.lng ?? 0),
        alt: Number((addr as any)?.alt ?? (addr as any)?.lat ?? 0),
        address: addressLabel,
      };
      console.log("[Checkout] deliveryAddress:", deliveryAddress);

      const items = lines.map((l, idx) => {
        const mapped = {
          farmerOrderId: String(l.farmerOrderId),
          itemId: String(l.itemId),
          name: l.name,
          imageUrl: l.imageUrl ?? "",
          pricePerUnit: Number(l.pricePerUnit),
          quantity: Number(l.quantity),
          category: l.category,
          sourceFarmerName: l.sourceFarmerName,
          sourceFarmName: l.sourceFarmName,
        };
        console.log(`[Checkout] map line -> item [${idx}]`, {
          src: {
            key: l.key,
            itemId: l.itemId,
            farmerOrderId: l.farmerOrderId,
            name: l.name,
            qty: l.quantity,
            ppu: l.pricePerUnit,
          },
          mapped,
        });
        return mapped;
      });

      const payload = {
        amsId: finalAmsId,
        logisticsCenterId: finalLC,
        deliveryDate: finalDate,
        deliveryAddress,
        items,
      };
      console.groupCollapsed("[Checkout] createOrder payload");
      console.log(payload);
      console.groupEnd();

      const res = await createOrder(payload);
      console.groupCollapsed("[Checkout] createOrder response");
      console.log(res);
      console.groupEnd();

      clearSharedCart();
      console.log("[Checkout] Cart cleared after successful order");

      const orderId = res?._id || "success";
      console.log("[Checkout] navigate ->", `/orders/${orderId}`);
      navigate(`/orders/${orderId}`);
    } catch (e: any) {
      console.error("[Checkout] placeOrder error:", e);
      setError(e?.message || "Failed to place order");
    } finally {
      setBusy(false);
      console.groupEnd(); // placeOrder
    }
  }

  return (
    <Container maxW="5xl" py={6}>
      <HStack gap={3} mb={4} align="center">
        <Heading size="lg">Checkout</Heading>
        <span style={{ flex: 1 }} />
        <Button asChild variant="ghost">
          <RouterLink to={`/cart${finalAmsId ? `?ams=${finalAmsId}` : ""}`}>
            Back to Cart
          </RouterLink>
        </Button>
      </HStack>

      {/* Warning only if still missing after inference */}
      {(!finalAmsId || !finalLC || !finalDate) && (
        <Alert.Root status="warning" borderRadius="md" mb={4}>
          <Alert.Indicator />
          <Alert.Description>
            Missing identifiers (ams, lc, date). Open checkout from Market with delivery details.
          </Alert.Description>
        </Alert.Root>
      )}

      {error && (
        <Alert.Root status="error" borderRadius="md" mb={4}>
          <Alert.Indicator />
          <Alert.Description>{error}</Alert.Description>
        </Alert.Root>
      )}

      {loading ? (
        <HStack justifyContent="center" py={12}>
          <Spinner />
        </HStack>
      ) : (
        <>
          {/* Delivery (UI unchanged) */}
          <Box borderWidth="1px" borderRadius="2xl" p={5} mb={4}>
            <Stack gap={2}>
              <Heading size="sm">Delivery</Heading>
              <HStack gap={3} style={{ flexWrap: "wrap" }}>
                <Badge colorPalette="purple" variant="subtle" title={addressLabel}>
                  <Text style={{ display: "block", maxWidth: "40ch" }}>{addressLabel}</Text>
                </Badge>
                <Badge colorPalette="blue">Shift: {"?"}</Badge>
              </HStack>
            </Stack>
          </Box>

          {/* Payment (UI unchanged) */}
          <Box borderWidth="1px" borderRadius="2xl" p={5} mb={4}>
            <Stack gap={3}>
              <Heading size="sm">Payment</Heading>
              <Text color="fg.muted" fontSize="sm">
                Only cards are supported. Card fields are optional for now.
              </Text>

              <Fieldset.Root>
                <Fieldset.Legend>Card details</Fieldset.Legend>
                <Fieldset.Content>
                  <Field.Root>
                    <Field.Label>Name on card</Field.Label>
                    <Input name="cardName" placeholder="Full name" autoComplete="cc-name" />
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Card number</Field.Label>
                    <Input name="cardNumber" placeholder="1234 5678 9012 3456" inputMode="numeric" autoComplete="cc-number" />
                  </Field.Root>

                  <HStack gap="3">
                    <Field.Root>
                      <Field.Label>Expiry</Field.Label>
                      <Input name="cardExpiry" placeholder="MM/YY" autoComplete="cc-exp" />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>CVC</Field.Label>
                      <Input name="cardCvc" placeholder="CVC" inputMode="numeric" autoComplete="cc-csc" />
                    </Field.Root>
                  </HStack>
                </Fieldset.Content>
              </Fieldset.Root>
            </Stack>
          </Box>

          {/* Items (UI unchanged) */}
          <Box borderWidth="1px" borderRadius="2xl" p={5}>
            <Heading size="sm" mb={3}>Order Summary</Heading>

            {cartEmpty ? (
              <Alert.Root status="info" borderRadius="md">
                <Alert.Indicator />
                <Alert.Description>
                  Your cart is empty. <RouterLink to="/market">Go to market</RouterLink>.
                </Alert.Description>
              </Alert.Root>
            ) : (
              <Stack gap={3}>
                <ItemList items={itemRows} currency="$" showDividers />

                <HStack justifyContent="space-between">
                  <Text>Subtotal</Text>
                  <Text fontWeight={700}>{totals.subtotal} $</Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text>Delivery fee</Text>
                  <Text fontWeight={700}>15 $</Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text fontWeight={800}>Total</Text>
                  <Text fontWeight={800}>{totals.grand + 15} $</Text>
                </HStack>

                <Button
                  mt={2}
                  size="lg"
                  colorPalette="green"
                  disabled={cartEmpty || busy}
                  onClick={placeOrder}
                >
                  Place Order
                </Button>
              </Stack>
            )}
          </Box>
        </>
      )}
    </Container>
  );
}
