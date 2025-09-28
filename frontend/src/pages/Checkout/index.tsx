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
import {
  getCart,
  getActiveCart,
  refreshCartExpiry,
  type Cart as ApiCart,
} from "@/api/cart";
import { getCustomerAddresses } from "@/api/market";
import { createOrder } from "@/api/orders";
import type { Address } from "@/types/address";
import { fmtILS } from "@/utils/format";
import ItemList, { type ItemRow as UIItemRow } from "@/components/common/ItemList";

export default function Checkout() {
  const [sp] = useSearchParams();
  const cartId = sp.get("cart") || "";
  const ams = sp.get("ams") || "";
  const navigate = useNavigate();

  const [cart, setCart] = useState<ApiCart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // payment: only card for now
  const payMethod: "card" = "card";

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [c, addr] = await Promise.all([
          cartId ? getCart(cartId) : ams ? getActiveCart(ams) : Promise.resolve(null),
          getCustomerAddresses().catch(() => [] as Address[]),
        ]);
        if (!alive) return;
        setCart(c);
        setAddresses(addr);
        if (c?._id) await refreshCartExpiry(c._id).catch(() => {});
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load checkout data");
        setCart(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [cartId, ams]);

  const totals = useMemo(() => {
    if (!cart) return { subtotal: 0, grand: 0 };
    const subtotal = cart.items.reduce(
      (a, i) => a + Number(i.amountKg || 0) * Number(i.pricePerUnit || 0),
      0
    );
    return { subtotal, grand: subtotal };
  }, [cart]);

  const addr = addresses[0];
  const addressLabel = addr?.address || "No saved address";
  const cartEmpty = !cart || cart.items.length === 0;

  const itemRows = useMemo<UIItemRow[]>(() => {
    if (!cart) return [];
    return cart.items.map((it) => ({
      id: String(it._id ?? it.itemId ?? Math.random()),
      name: it.displayName,
      farmer: "",
      qty: Number(it.amountKg || 0),
      unitLabel: "unit", // replaced "kg" with "unit"
      unitPrice: Number(it.pricePerUnit || 0),
      currency: "$",
    }));
  }, [cart]);

  async function placeOrder() {
    if (!cart || cartEmpty) return;
    setBusy(true);
    try {
      // map address -> API shape
      const deliveryAddress = {
        line1: "",
        line2: "",
        city: "",
        district: "",
        state: "",
        postalCode: "",
        country: "",
        lat: Number((addr as any)?.lnt ?? (addr as any)?.lat ?? 0),
        lng: Number((addr as any)?.alt ?? (addr as any)?.lng ?? 0),
        label: addressLabel,
        logisticCenterId: cart.LCid ?? (addr as any)?.logisticCenterId ?? "",
      };

      // map cart items -> API shape
      const items = cart.items.map((it) => ({
        itemId: it.itemId,
        name: it.displayName,
        quantityKg: Number(it.amountKg),
        pricePerKg: Number(it.pricePerUnit),
        category: it.category,
        amsItemId: it.availableMarketStockItemId,
        availableMarketStockId: cart.availableMarketStockId,
      }));

      const res = await createOrder({ deliveryAddress, items, payMethod });
      navigate(`/orders/${res.orderId || "success"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container maxW="5xl" py={6}>
      <HStack gap={3} mb={4} align="center">
        <Heading size="lg">Checkout</Heading>
        <span style={{ flex: 1 }} />
        <Button asChild variant="ghost">
          <RouterLink to={`/cart${cart?.availableMarketStockId ? `?ams=${cart.availableMarketStockId}` : ""}`}>
            Back to Cart
          </RouterLink>
        </Button>
      </HStack>

      {!cartId && !ams && (
        <Alert.Root status="warning" borderRadius="md" mb={4}>
          <Alert.Indicator />
          <Alert.Description>
            Missing identifiers. Open checkout from Cart or Market.
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
          {/* Delivery */}
          <Box borderWidth="1px" borderRadius="2xl" p={5} mb={4}>
            <Stack gap={2}>
              <Heading size="sm">Delivery</Heading>
              <HStack gap={3} style={{ flexWrap: "wrap" }}>
                <Badge colorPalette="purple" variant="subtle" title={addressLabel}>
                  <Text style={{ display: "block", maxWidth: "40ch" }}>{addressLabel}</Text>
                </Badge>
                <Badge colorPalette="blue">Shift: {cart?.availableShift ?? "?"}</Badge>
              </HStack>
            </Stack>
          </Box>

          {/* Payment */}
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

          {/* Items */}
          <Box borderWidth="1px" borderRadius="2xl" p={5}>
            <Heading size="sm" mb={3}>
              Order Summary
            </Heading>

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
                {/* delivery fee */}
                <HStack justifyContent="space-between">
                  <Text>Delivery fee</Text>
                  <Text fontWeight={700}>15 $</Text>
                </HStack>
                {/* total */}
                <HStack justifyContent="space-between">
                  <Text fontWeight={800}>Total</Text>
                  <Text fontWeight={800}>{totals.grand+15} $</Text>
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
