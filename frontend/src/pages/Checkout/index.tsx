import React, { useEffect, useMemo, useState } from "react";
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
} from "@chakra-ui/react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/store/cart";
import { useCartItemsUnified } from "@/hooks/useCartItemsUnified";
import { getCartMeta, clearCart as clearCartLS } from "@/utils/cart";
import { fmtILS } from "@/utils/format";
import { createOrder } from "@/api/orders"; // you’ll add this tiny API below

type SavedLoc = { id?: string; label?: string; lat?: number; lng?: number };

export default function Checkout() {
  const navigate = useNavigate();
  const cart = useCart();
  const itemsUnified = useCartItemsUnified(); // reads store + LS
  const [address, setAddress] = useState<SavedLoc | null>(null);

  // meta (lc + shift + locationKey) saved from Market
  const meta = getCartMeta();
  const shiftKey = meta?.shiftKey ?? null; // 'morning' | 'afternoon' | 'night'
  const lcId = meta?.logisticCenterId ?? null;
  const locationKey = meta?.locationKey ?? null;

  // read nice label we saved when the user picked map location (optional)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("dfcp:lastLocation");
      if (raw) setAddress(JSON.parse(raw) as SavedLoc);
    } catch {}
  }, []);

  const totals = useMemo(() => {
    const subtotal = itemsUnified.reduce(
      (acc, it: any) =>
        acc + Number(it.price ?? it.pricePerKg ?? 0) * Number(it.qty ?? it.qtyKg ?? 1),
      0
    );
    // no tax/shipping for now
    return { subtotal, grandTotal: subtotal };
  }, [itemsUnified]);

  const isCartEmpty = itemsUnified.length === 0;

  async function placeOrder() {
    // simple guards
    if (isCartEmpty || !shiftKey || !lcId || !locationKey) return;

    // prepare payload that your backend expects
    const payload = {
      locationKey,
      logisticCenterId: lcId,
      shiftKey,
      items: itemsUnified.map((it: any) => ({
        inventoryId: it.inventoryId ?? it.id,
        qtyKg: Number(it.qty ?? it.qtyKg ?? 1),
        pricePerKg: Number(it.price ?? it.pricePerKg ?? 0),
        name: it.name,
      })),
      totals,
      addressLabel: address?.label,
    };

    try {
      // optional purge of expired holds before submit
      if ((cart as any)?.purgeExpired) (cart as any).purgeExpired();

      const res = await createOrder(payload); // { orderId: string }
      // clear both sources
      if ((cart as any)?.clear) (cart as any).clear();
      clearCartLS();

      // go to a simple confirmation (you can change the path)
      navigate(`/order/${res.orderId ?? "success"}`);
    } catch (e) {
      // fallback: keep user on page; you can add a toast if you like
      console.error(e);
    }
  }

  return (
    <Container maxW="5xl" py={6}>
      <HStack gap={3} mb={4} align="center">
        <Heading size="lg">Checkout</Heading>
        <span style={{ flex: 1 }} />
        <Button asChild variant="ghost">
          <Link to="/cart">Back to Cart</Link>
        </Button>
      </HStack>

      {/* Delivery section */}
      <Box borderWidth="1px" borderRadius="2xl" p={5} mb={4}>
        <Stack gap={2}>
          <Heading size="sm">Delivery</Heading>
          <HStack gap={3} wrap="wrap">
            <Badge colorPalette="purple" variant="subtle" title={address?.label || ""}>
              <Text style={{ display: "block", maxWidth: "40ch" }}>
                {address?.label || "No address saved"}
              </Text>
            </Badge>
            <Badge colorPalette="blue">Shift: {shiftKey ?? "?"}</Badge>
            <Badge colorPalette="gray">LC: {lcId ?? "?"}</Badge>
          </HStack>
          {!locationKey || !shiftKey ? (
            <Alert.Root status="warning" borderRadius="md">
              <Alert.Indicator />
              <Alert.Description>
                Choose your delivery location &amp; shift on the Market page before placing the order.
              </Alert.Description>
            </Alert.Root>
          ) : null}
        </Stack>
      </Box>

      {/* Items */}
      <Box borderWidth="1px" borderRadius="2xl" p={5}>
        <Heading size="sm" mb={3}>
          Order Summary
        </Heading>

        {isCartEmpty ? (
          <Alert.Root status="info" borderRadius="md">
            <Alert.Indicator />
            <Alert.Description>
              Your cart is empty. <Link to="/market">Go back to the market</Link>.
            </Alert.Description>
          </Alert.Root>
        ) : (
          <Stack gap={3}>
            {itemsUnified.map((it: any) => {
              const qty = Number(it.qty ?? it.qtyKg ?? 1);
              const price = Number(it.price ?? it.pricePerKg ?? 0);
              const sub = qty * price;
              return (
                <Box
                  key={it.inventoryId ?? it.id}
                  borderWidth="1px"
                  borderRadius="xl"
                  p={4}
                >
                  <HStack gap={3} justifyContent="space-between" align="start">
                    <Stack gap={1}>
                      <Text fontWeight={600}>{it.name}</Text>
                      <Text fontSize="sm" color="fg.muted">
                        {qty} kg × {fmtILS(price)}
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
              <Text fontWeight={800}>{fmtILS(totals.grandTotal)}</Text>
            </HStack>

            <Button
              mt={2}
              size="lg"
              colorPalette="green"
              disabled={isCartEmpty || !locationKey || !shiftKey || !lcId}
              onClick={placeOrder}
            >
              Place Order
            </Button>
          </Stack>
        )}
      </Box>
    </Container>
  );
}
