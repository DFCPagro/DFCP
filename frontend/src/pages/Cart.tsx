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

const Cart: React.FC = () => {
  const { state, totals, purgeExpired } = useCart();

  useEffect(() => {
    purgeExpired();
  }, []);

  useEffect(() => {
    const onVis = () => purgeExpired();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

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
