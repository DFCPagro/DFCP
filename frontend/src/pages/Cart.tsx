// src/pages/Cart.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  SimpleGrid,
  Stack,
  Text,
  HStack,
  Badge,
  Spinner,
  Alert,
} from "@chakra-ui/react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  getActiveCart,
  addToCart,
  updateCartItem,
  clearCart,
  checkoutCart,
  refreshCartExpiry,
  type Cart as ApiCart,
  type CartItem as ApiCartItem,
} from "@/api/cart";
import { fmtILS } from "@/utils/format";

import { Link as RouterLink } from "react-router-dom";


function isoToLocal(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

export default function Cart() {
  const [sp] = useSearchParams();
  const ams = sp.get("ams") || ""; // required by GET /carts/active?ams=...
  const navigate = useNavigate();

  const [cart, setCart] = useState<ApiCart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
const canCheckout = !!cart && cart.items.length > 0;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!ams) {
        setCart(null);
        return;
      }
      const c = await getActiveCart(ams);
      setCart(c);
      if (c?._id) {
        // optional: keep the cart alive while user views it
        await refreshCartExpiry(c._id).catch(() => {});
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load cart");
      setCart(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ams]);

  const totals = useMemo(() => {
    if (!cart) return { kg: 0, price: 0 };
    const kg = cart.items.reduce((a, i) => a + Number(i.amountKg || 0), 0);
    const price = cart.items.reduce(
      (a, i) => a + Number(i.amountKg || 0) * Number(i.pricePerUnit || 0),
      0
    );
    return { kg, price };
  }, [cart]);

  const cartEmpty = !cart || cart.items.length === 0;

  async function inc(item: ApiCartItem, deltaKg: number) {
    if (!cart || !deltaKg) return;
    setBusy(true);
    try {
      if (deltaKg > 0) {
        // add more of the same AMS item
        const updated = await addToCart({
          availableMarketStockId: cart.availableMarketStockId,
          amsItemId: item.availableMarketStockItemId,
          amountKg: deltaKg,
        });
        setCart(updated);
      } else {
        // remove partial quantity
        const updated = await updateCartItem(cart._id, item._id, {
          amountKg: Math.abs(deltaKg),
        });
        setCart(updated);
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(item: ApiCartItem) {
    if (!cart) return;
    setBusy(true);
    try {
      const updated = await updateCartItem(cart._id, item._id, {}); // remove whole line
      setCart(updated);
    } finally {
      setBusy(false);
    }
  }

  async function wipeAll() {
    if (!cart) return;
    setBusy(true);
    try {
      await clearCart(cart._id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function doCheckout() {
    if (!cart || cartEmpty) return;
    setBusy(true);
    try {
      await checkoutCart(cart._id);
      navigate("/checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container maxW="container.lg" py={8}>
      <Stack gap={6}>
        <HStack gap={3} align="center">
          <Heading size="lg">Your Cart</Heading>
          <span style={{ flex: 1 }} />
          {cart && (
            <HStack gap={2}>
              <Badge colorPalette="purple">LC: {cart.LCid}</Badge>
              <Badge colorPalette="blue">Shift: {cart.availableShift}</Badge>
              <Badge>{cart.status}</Badge>
            </HStack>
          )}
        </HStack>

        {!ams && (
          <Alert.Root status="warning" borderRadius="md">
            <Alert.Indicator />
            <Alert.Description>
              Missing <code>ams</code> in URL. Open the cart from the Market page so the active
              shift is known.
            </Alert.Description>
          </Alert.Root>
        )}

        {error && (
          <Alert.Root status="error" borderRadius="md">
            <Alert.Indicator />
            <Alert.Description>{error}</Alert.Description>
          </Alert.Root>
        )}

        {loading ? (
          <HStack justifyContent="center" py={10}>
            <Spinner />
          </HStack>
        ) : cartEmpty ? (
          <Box borderWidth="1px" borderRadius="2xl" p={8} textAlign="center">
            <Text>Your cart is empty.</Text>
          </Box>
        ) : (
          <>
            <SimpleGrid columns={{ base: 1 }} gap={4}>
              {cart!.items.map((it) => (
                <Box
                  key={it._id}
                  borderWidth="1px"
                  borderRadius="xl"
                  p={4}
                  display="grid"
                  gridTemplateColumns="1fr auto"
                  gap={3}
                >
                  <Stack gap={1}>
                    <Text fontWeight={600}>{it.displayName}</Text>
                    <HStack gap={2} wrap="wrap">
                      <Badge>{it.category}</Badge>
                      {it.imageUrl ? <Badge>image</Badge> : null}
                      <Badge>₪ {it.pricePerUnit}/kg</Badge>
                    </HStack>
                    <Text color="fg.muted" fontSize="sm">
                      Added: {isoToLocal(it.addedAt)} • Updated: {isoToLocal(it.updatedAt)}
                    </Text>
                  </Stack>

                  <Stack align="end" gap={2}>
                    <HStack gap={2}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => inc(it, -0.5)}
                        disabled={busy || it.amountKg <= 0.5}
                        aria-label="Decrease 0.5kg"
                      >
                        −0.5 kg
                      </Button>
                      <Text minW="6ch" textAlign="center" fontWeight={700}>
                        {it.amountKg.toFixed(2)} kg
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => inc(it, +0.5)}
                        disabled={busy}
                        aria-label="Increase 0.5kg"
                      >
                        +0.5 kg
                      </Button>
                    </HStack>
                    <Button
                      size="sm"
                      colorPalette="red"
                      variant="subtle"
                      onClick={() => removeLine(it)}
                      disabled={busy}
                    >
                      Remove
                    </Button>
                  </Stack>
                </Box>
              ))}
            </SimpleGrid>

            <Box borderTopWidth="1px" />

            <Box borderWidth="1px" borderRadius="2xl" p={6}>
              <HStack justifyContent="space-between">
                <Text>Total Items</Text>
                <Text fontWeight={700}>{totals.kg.toFixed(2)} kg</Text>
              </HStack>
              <HStack justifyContent="space-between">
                <Text>Total Price</Text>
                <Text fontWeight={800}>{fmtILS(totals.price)}</Text>
              </HStack>
              <Text color="fg.muted" fontSize="sm" mt={2}>
                Expires at: {isoToLocal(cart?.expiresAt)}
              </Text>

              <HStack mt={4} gap={3}>
                <Button
                  colorPalette="gray"
                  variant="outline"
                  onClick={wipeAll}
                  disabled={busy || cartEmpty}
                >
                  Clear Cart
                </Button>
{canCheckout ? (
  <Button asChild colorPalette="green" size="lg">
    <RouterLink to={`/checkout?cart=${cart!._id}&ams=${cart!.availableMarketStockId}`}>
      Proceed to Checkout
    </RouterLink>
  </Button>
) : (
  <Button colorPalette="green" size="lg" disabled>
    Proceed to Checkout
  </Button>
)}
              </HStack>
            </Box>
          </>
        )}
      </Stack>
    </Container>
  );
}
