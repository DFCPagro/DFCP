import React, { useEffect } from "react";
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
} from "@chakra-ui/react";
import { useCart } from "@/store/cart";
import { CartItemCard } from "@/components/feature/cart";
import { fmtILS } from "@/utils/format";
const STORAGE_KEY = "dfcp_cart_v1";

const Cart: React.FC = () => {
  const { state, totals, purgeExpired } = useCart();
/**
 * 1) Hydrate the store from localStorage if the hook state is empty
 *    and storage already has items (added on Market page).
 */
  
  useEffect(() => {
  try {
    const bag = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(bag.items) && bag.items.length && state.items.length === 0) {
      // Try common zustand APIs if your store exposes them:
      const api: any = (useCart as any).getState?.();
      if (api?.import) {
        api.import(bag);                      // preferred if you have it
      } else if (api?.setState) {
        // fall back: minimally set the persisted slice
        api.setState((s: any) => ({
          ...s,
          state: {
            ...(s.state || {}),
            items: bag.items,
            lcId: bag.lcId ?? null,
            shiftKey: bag.shiftKey ?? null,
          },
        }));
      }
    }
  } catch {}
  // DO NOT purge here; let hydration happen first
}, []);

/**
 * 2) Purge only when it won’t nuke the cart:
 *    - there is at least one item
 *    - at least one item has a valid holdExpiresAt in the future
 */
useEffect(() => {
  const hasFuture = state.items.some(
    (it: any) => typeof it?.holdExpiresAt === "number" && it.holdExpiresAt > Date.now()
  );
  if (state.items.length && hasFuture) {
    purgeExpired();
  }
}, [state.items.length]);
  const cartEmpty = state.items.length === 0;

  return (
    <Container maxW="container.lg" py={8}>
      <Stack gap={6}>
        <Heading size="lg">Your Cart</Heading>

        {state.lcId && state.shiftKey && (
          <HStack gap={2}>
            <Badge colorScheme="purple">LC: {state.lcId}</Badge>
            <Badge colorScheme="blue">Shift: {state.shiftKey}</Badge>
            <Text color="gray.500" fontSize="sm">
              (Selected on the Market page)
            </Text>
          </HStack>
        )}

        {cartEmpty ? (
          <Box borderWidth="1px" borderRadius="2xl" p={8} textAlign="center">
            <Text>Your cart is empty. Go add some fresh items! 🥕🥚🍎</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 1 }} gap={4}>
            {state.items.map((it) => (
              <CartItemCard key={it.id} item={it} />
            ))}
          </SimpleGrid>
        )}

        {/* Divider replacement */}
        <Box borderTopWidth="1px" />

        <Box borderWidth="1px" borderRadius="2xl" p={6}>
          <HStack justifyContent="space-between">
            <Text>Total Items</Text>
            <Text fontWeight={700}>{totals.totalItemsKg.toFixed(0)} kg</Text>
          </HStack>
          <HStack justifyContent="space-between">
            <Text>Total Price</Text>
            <Text fontWeight={800}>{fmtILS(totals.totalPrice)}</Text>
          </HStack>
          <Button
            mt={4}
            colorScheme="green"
            size="lg"
            disabled={cartEmpty}
            onClick={() => {
              if (cartEmpty) return;
              purgeExpired();
              if (state.items.length === 0) {
                // useToast not available in your build; fallback
                alert("Some items expired and were removed.");
                return;
              }
              // TODO: replace with your router navigate("/checkout")
              window.location.href = "/checkout";
            }}
          >
            Proceed to Checkout
          </Button>
        </Box>
      </Stack>
    </Container>
  );
};

export default Cart;
