import { memo, useMemo, useState, useCallback } from "react";
import {
  AspectRatio,
  Avatar,
  Box,
  Button,
  Card,
  HStack,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FiShoppingCart } from "react-icons/fi";
import type { MarketItem } from "@/types/market";

export type MarketItemCardProps = {
  item: MarketItem;
  onClick?: (item: MarketItem) => void;
  onAdd?: (payload: { item: MarketItem; qty: number }) => void;
  adding?: boolean;

  /** Optional qty bounds; default 1..20 */
  minQty?: number;
  maxQty?: number;
};

/* ------------------------------ helpers ------------------------------ */

function getUnitPriceUSD(it: MarketItem): number {
  const anyIt = it as any;
  const cand =
    anyIt.priceUsd ??
    anyIt.usd ??
    anyIt.price ??
    anyIt.unitPrice ??
    anyIt.pricePerUnit ??
    0;
  const n = Number(cand);
  return Number.isFinite(n) ? n : 0;
}

function getImageUrl(it: MarketItem): string | undefined {
  const anyIt = it as any;
  return anyIt.imageUrl ?? anyIt.img ?? anyIt.photo ?? anyIt.picture ?? undefined;
}

function getFarmerIconUrl(it: MarketItem): string | undefined {
  const anyIt = it as any;
  return anyIt.farmerIconUrl ?? anyIt.farmerAvatarUrl ?? anyIt.farmerImageUrl ?? undefined;
}

function getAvailableUnits(it: MarketItem): number {
  const anyIt = it as any;
  const cand =
    anyIt.availableUnits ??
    anyIt.availableQty ??
    anyIt.availableQuantity ??
    anyIt.availableKg ?? // treat same as units for display
    0;
  const n = Number(cand);
  return Number.isFinite(n) ? n : 0;
}

/* --------------------------------- UI --------------------------------- */

function MarketItemCardBase({
  item,
  onClick,
  onAdd,
  adding,
  minQty = 1,
  maxQty = 20,
}: MarketItemCardProps) {
  const [qty, setQty] = useState<number>(1);
  const img = getImageUrl(item);
  const farmerIcon = getFarmerIconUrl(item);
  const farmerName = (item as any).farmerName as string | undefined;
  const name = (item as any).name as string | undefined;
  const variety = (item as any).variety as string | undefined;

  const price = getUnitPriceUSD(item);
  const availableUnits = getAvailableUnits(item);

  const priceLabel = useMemo(() => {
    return `$${(Number.isFinite(price) ? price : 0).toFixed(2)}/unit`;
  }, [price]);

  const dec = useCallback(() => {
    setQty((q) => Math.max(minQty, Math.min(maxQty, q - 1)));
  }, [minQty, maxQty]);

  const inc = useCallback(() => {
    setQty((q) => Math.max(minQty, Math.min(maxQty, q + 1)));
  }, [minQty, maxQty]);

  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const q = Math.max(minQty, Math.min(maxQty, qty));
    if (q > 0) onAdd?.({ item, qty: q });
  }, [onAdd, item, qty, minQty, maxQty]);

  return (
    <Card.Root
      variant="outline"
      rounded="2xl"
      overflow="hidden"
      _hover={{ shadow: onClick ? "md" : undefined, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick ? () => onClick(item) : undefined}
    >
      {/* Image */}
      <AspectRatio ratio={4 / 3}>
        <Box bg="bg.muted">
          {img ? (
            <Image src={img} alt={name ?? "item"} objectFit="cover" w="100%" h="100%" />
          ) : (
            <Box w="100%" h="100%" />
          )}
        </Box>
      </AspectRatio>

      {/* Body */}
      <Card.Body>
        <Stack gap="2">
          <HStack justify="space-between" align="start">
            <Stack gap="0" minW="0">
              <Text fontWeight="semibold" lineClamp={1}>
                {name ?? "Item"}
              </Text>
              {variety ? (
                <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                  {variety}
                </Text>
              ) : null}
            </Stack>

            {/* Optional farmer icon (only if provided) */}
            {farmerIcon ? (
              <Avatar.Root size="sm">
                <Avatar.Image src={farmerIcon} alt={farmerName ?? "farmer"} />
              </Avatar.Root>
            ) : null}
          </HStack>

          {/* Farmer name (text) */}
          {farmerName ? (
            <Text fontSize="sm" color="fg.muted" lineClamp={1}>
              {farmerName}
            </Text>
          ) : null}

          {/* Price + availability */}
          <HStack justify="space-between">
            <Text fontWeight="medium">{priceLabel}</Text>
            <Text fontSize="sm" color="fg.muted">
              {availableUnits} units available
            </Text>
          </HStack>

          {/* Qty control */}
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="fg.muted">Quantity</Text>
            <HStack>
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  dec();
                }}
                disabled={adding || qty <= minQty}
              >
                –
              </Button>
              <Box minW="32px" textAlign="center" fontWeight="semibold" aria-live="polite">
                {qty}
              </Box>
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  inc();
                }}
                disabled={adding || qty >= maxQty}
              >
                +
              </Button>
            </HStack>
          </HStack>

        </Stack>
      </Card.Body>

      {/* Footer: Add to cart */}
      <Card.Footer pt="0">
        <HStack w="full" justify="flex-end">
          <Button
            size="sm"
            colorPalette="teal"
            onClick={handleAdd}
            loading={!!adding}
            disabled={qty < minQty || qty > maxQty}
          >
            <FiShoppingCart />
            <Box as="span" ms="2">
              Add
            </Box>
          </Button>
        </HStack>
      </Card.Footer>
    </Card.Root>
  );
}

export const MarketItemCard = memo(MarketItemCardBase);
