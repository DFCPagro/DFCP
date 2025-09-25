// src/pages/Checkout.tsx
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
} from "@chakra-ui/react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import {
  getCart,
  getActiveCart,
  checkoutCart,
  refreshCartExpiry,
  type Cart as ApiCart,
} from "@/api/cart";
import { getCustomerAddresses } from "@/api/market";
import type { Address } from "@/types/address";
import { fmtILS } from "@/utils/format";

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

  // payment method stub (no details required now)
  const [payMethod, setPayMethod] = useState<"cod" | "card">("cod");

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

  const addressLabel =
    addresses.length ? (addresses[0]?.address || "") : "No saved address";
  const cartEmpty = !cart || cart.items.length === 0;

  async function placeOrder() {
    if (!cart || cartEmpty) return;
    setBusy(true);
    try {
      await checkoutCart(cart._id);
      navigate("/orders");
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
        <HStack justifyContent="center" py={12}><Spinner /></HStack>
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
                <Badge colorPalette="gray">LC: {cart?.LCid ?? "?"}</Badge>
              </HStack>
            </Stack>
          </Box>

          {/* Payment (structure only) */}
          <Box borderWidth="1px" borderRadius="2xl" p={5} mb={4}>
            <Stack gap={3}>
              <Heading size="sm">Payment</Heading>
              <Text color="fg.muted" fontSize="sm">
                Payment details not required now. Keep method selection for flow.
              </Text>
              <label style={{ display: "block" }}>
                <span style={{ display: "block", marginBottom: 6 }}>Payment method</span>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as "cod" | "card")}
                  aria-label="Payment method"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
                    background: "var(--chakra-colors-white, #fff)",
                    minWidth: 240,
                  }}
                >
                  <option value="cod">Cash on Delivery</option>
                  <option value="card">Card (coming soon)</option>
                </select>
              </label>
            </Stack>
          </Box>

          {/* Items */}
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
                {cart!.items.map((it) => {
                  const sub = Number(it.amountKg || 0) * Number(it.pricePerUnit || 0);
                  return (
                    <Box key={it._id} borderWidth="1px" borderRadius="xl" p={4}>
                      <HStack gap={3} justifyContent="space-between" align="start">
                        <Stack gap={1}>
                          <Text fontWeight={600}>{it.displayName}</Text>
                          <Text fontSize="sm" color="fg.muted">
                            {it.amountKg.toFixed(2)} kg × {fmtILS(it.pricePerUnit)}
                          </Text>
                        </Stack>
                        <Text fontWeight={700}>{fmtILS(sub)}</Text>
                      </HStack>
                    </Box>
                  );
                })}

                <HStack justifyContent="space-between">
                  <Text>Subtotal</Text>
                  <Text fontWeight={700}>{fmtILS(totals.subtotal)}</Text>
                </HStack>
                <HStack justifyContent="space-between">
                  <Text fontWeight={800}>Total</Text>
                  <Text fontWeight={800}>{fmtILS(totals.grand)}</Text>
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
