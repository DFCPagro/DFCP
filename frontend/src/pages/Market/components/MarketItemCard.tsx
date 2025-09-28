import { memo, useMemo } from "react";
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
  onAdd?: (payload: { item: MarketItem }) => void;
  adding?: boolean;
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

function MarketItemCardBase({ item, onClick, onAdd, adding }: MarketItemCardProps) {
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
        </Stack>
      </Card.Body>

      {/* Footer: Add to cart */}
      <Card.Footer pt="0">
        <HStack w="full" justify="flex-end">
          <Button
            size="sm"
            colorPalette="teal"
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.({ item });
            }}
            loading={!!adding}
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
