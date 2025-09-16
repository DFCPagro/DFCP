// src/components/feature/market/ItemCard.tsx
import { useState, useMemo } from "react";
import {
  Card,
  Box,
  AspectRatio,
  Badge,
  Text,
  Button,
  HStack,
  VStack,
  Separator,
  Image,
} from "@chakra-ui/react";
import type { MarketItem } from "@/types/market";

type Props = {
  // Accept inventoryId if present, but don’t require it at the type level
  item: MarketItem & { inventoryId?: string };
  onAdd: (id: string, qty: number) => void;
  disabled?: boolean;
};

export default function ItemCard({ item, onAdd, disabled }: Props) {
  const [qty, setQty] = useState(1);

  // prefer inventoryId, fall back to item._id so onAdd always gets something stable
  const inventoryId = useMemo(
    () => item.inventoryId ?? item._id,
    [item.inventoryId, item._id]
  );

  const inStock = Number.isFinite(item.inStock) ? Number(item.inStock) : 0;
  const outOfStock = inStock <= 0;
  const canAdd = !disabled && !outOfStock && qty > 0;

  const priceText = useMemo(
    () => `₪ ${Number(item.price ?? 0).toFixed(2)}`,
    [item.price]
  );

  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () =>
    setQty((q) => Math.max(1, Math.min(q + 1, Math.max(1, inStock))));

  const handleAdd = () => {
    if (!canAdd) return;
    if (!inventoryId) {
      // Shouldn’t happen with the fallback, but just in case:
      console.warn("Missing inventoryId for item:", item);
      return;
    }
    onAdd(inventoryId, qty);
  };

  return (
    <Card.Root
      variant="elevated"
      rounded="2xl"
      overflow="hidden"
      borderWidth="1px"
      _hover={{ shadow: "lg", translateY: "-2px", transition: "all 160ms" }}
    >
      {/* Media */}
      <AspectRatio ratio={4 / 3} bg="gray.50">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            objectFit="cover"
            w="100%"
            h="100%"
            loading="lazy"
          />
        ) : (
          <Box bgGradient="to-br" gradientFrom="gray.50" gradientTo="gray.100" />
        )}
      </AspectRatio>

      <Card.Body p="4">
        <VStack align="start" gap="2">
          <Text fontWeight="semibold" lineClamp={1}>
            {item.name}
          </Text>
          <Text color="fg.muted" fontSize="sm" lineClamp={1}>
            {item.farmer.farmName} by {item.farmer.name}
          </Text>

          <HStack justify="space-between" w="full">
            <Text fontWeight="medium">{priceText}</Text>
            <Badge colorPalette={outOfStock ? "red" : "green"} variant="subtle">
              {outOfStock ? "Out of stock" : `${inStock} in stock`}
            </Badge>
          </HStack>

          <Separator my="1" />

          <HStack gap="2">
            <Text fontSize="sm" color="fg.muted">
              Quantity:
            </Text>
            <HStack gap="1" borderWidth="1px" rounded="lg" p="1">
              <Button size="xs" variant="ghost" onClick={dec} disabled={!canAdd}>
                −
              </Button>
              <Text minW="2ch" textAlign="center">
                {qty}
              </Text>
              <Button size="xs" variant="ghost" onClick={inc} disabled={!canAdd}>
                +
              </Button>
            </HStack>
          </HStack>
        </VStack>
      </Card.Body>

      <Card.Footer p="4" pt="0">
        <Button
          w="full"
          colorPalette="teal"
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
        >
          Add to cart
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
