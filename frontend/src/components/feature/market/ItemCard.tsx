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
  item: MarketItem;
  onAdd: (id: string, qty: number) => void;
  disabled?: boolean;
  /** computed available units after cart reservations */
  displayStock?: number;
};

export default function ItemCard({
  item,
  onAdd,
  disabled,
  displayStock,
}: Props) {
  const [qty, setQty] = useState(1);

  // Normalize fields from heterogeneous MarketItem sources without changing the MarketItem type.
  const inventoryId = useMemo<string | undefined>(() => {
    const x = item as any;
    return x.inventoryId ?? x._id ?? x.itemId ?? x.id;
  }, [item]);

  const name = useMemo<string>(() => {
    const x = item as any;
    return x.name ?? x.displayName ?? x.title ?? "";
  }, [item]);

  const imageUrl = useMemo<string | undefined>(() => {
    const x = item as any;
    return x.imageUrl ?? x.image ?? x.photoUrl ?? x.thumbnailUrl;
  }, [item]);

  const unitPrice = useMemo<number>(() => {
    const x = item as any;
    return Number(x.price ?? x.pricePerUnit ?? x.unitPrice ?? 0);
  }, [item]);

  const farmerName = useMemo<string>(() => {
    const x = item as any;
    const f = x.farmer ?? {};
    return f.name ?? x.farmerName ?? "";
  }, [item]);

  const farmName = useMemo<string>(() => {
    const x = item as any;
    const f = x.farmer ?? {};
    return f.farmName ?? x.farmName ?? "";
  }, [item]);

  const available = useMemo<number>(() => {
    const x = item as any;
    const raw =
      displayStock ??
      x.inStock ??
      x.availableUnits ??
      x.stock ??
      x.quantity ??
      0;
    return Math.max(0, Number(raw) || 0);
  }, [displayStock, item]);

  const outOfStock = available <= 0;
  const canAdd = !disabled && !outOfStock && qty > 0;
  const priceText = useMemo(() => `$ ${unitPrice.toFixed(2)}`, [unitPrice]);

  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () =>
    setQty((q) => Math.max(1, Math.min(q + 1, Math.max(1, available))));

  const handleAdd = () => {
    if (!canAdd || !inventoryId) return;
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
      <AspectRatio ratio={4 / 3} bg="gray.50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
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
            {name}
          </Text>
          {(farmName || farmerName) && (
            <Text color="fg.muted" fontSize="sm" lineClamp={1}>
              {farmName ? `${farmName} ` : ""}
              {farmerName ? `by ${farmerName}` : ""}
            </Text>
          )}

          <HStack justify="space-between" w="full">
            <Text fontWeight="medium">{priceText}</Text>
            <Badge
              colorPalette={outOfStock ? "red" : "green"}
              variant="subtle"
            >
              {outOfStock ? "Out of stock" : `${available} in stock`}
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
