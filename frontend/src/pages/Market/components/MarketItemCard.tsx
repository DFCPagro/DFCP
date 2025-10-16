import { memo, useMemo, useState, useCallback, useRef } from "react";
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
  Dialog,
  Portal,
} from "@chakra-ui/react";
import { FiShoppingCart } from "react-icons/fi";
import type { MarketItem } from "@/types/market";
import { MarketItemPage } from "./MarketItemPage";

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

const colorPalette = ["red", "blue", "green", "yellow", "purple", "orange"] as const;

const fallbackTemp = "https://cdn-icons-png.flaticon.com/128/7417/7417717.png"; // temporary fallback image

const pickPalette = (name?: string | null) => {
  const n = name?.trim();
  if (!n) return "gray";
  const index = n.charCodeAt(0) % colorPalette.length;
  return colorPalette[index];
};

function getUnitPriceUSD(it: MarketItem): number {
  const n = Number(it.pricePerUnit);
  return Number.isFinite(n) ? n : 0;
}


function getImageUrl(it: MarketItem): string | undefined {
  return it.imageUrl;
}


function getFarmerIconUrl(it: MarketItem): string | undefined {
  return it.farmLogo;
}


function getAvailableUnits(it: MarketItem): number {
  const n = Number(it.availableKg);
  const units = n / Number(it.avgWeightPerUnitKg);
  if (!Number.isFinite(units)) return 0;
  return Math.floor(units);
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
  const [isOpen, setIsOpen] = useState(false);                 // + add
  const triggerRef = useRef<HTMLButtonElement | null>(null);   // + add

  const openQuickView = useCallback(() => setIsOpen(true), []);         // + add
  const closeQuickView = useCallback(() => {
    setIsOpen(false);
    // restore focus to the trigger for a11y (safe-guard)
    triggerRef.current?.focus?.();
  }, []);                                                               // + add

  const img = getImageUrl(item);

  const farmerIcon = getFarmerIconUrl(item);
  const farmerName = item.farmerName;
  const name = item.name;
  // If you don't actually have "variety" on MarketItem, keep this optional read guarded:
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
            <button
              type="button"
              ref={triggerRef}
              onClick={(e) => {
                e.stopPropagation(); // prevent bubbling to Card onClick if used later
                openQuickView();
              }}
              style={{ display: "block", width: "100%", height: "100%", padding: 0, background: "transparent", border: "none", cursor: "pointer" }}
              aria-label="Open item preview"
            >
              <Image
                src={img}
                alt={name ?? "item"}
                objectFit="cover"
                w="100%"
                h="100%"
              />
            </button>
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
            <HStack justify="space-between">
              <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                {farmerName}
              </Text>
              {farmerIcon ? (
                <Image
                  src={farmerIcon ?? fallbackTemp}
                  objectFit="cover"
                  w="20%"
                  h="20%"
                />
              ) : (
                <Avatar.Root colorPalette={pickPalette(farmerName)}>
                  <Avatar.Fallback name={farmerName ?? "Farmer"} />
                </Avatar.Root>
              )}
            </HStack>

          ) : null}

          {/* Price + availability */}

          <HStack justify="space-between">
            <Text fontWeight="medium">{priceLabel}</Text>
            {availableUnits < 100 ? (
              <Text fontSize="sm" color="fg.muted">
                {availableUnits} units available
              </Text>
            ) : null}
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

      {/* Quick View Dialog */}
      <Dialog.Root
        open={isOpen}
        onOpenChange={(e) => setIsOpen(e.open)}
        role="dialog"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <MarketItemPage
                item={item}
                onClose={closeQuickView}
              />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Card.Root>
  );
}

export const MarketItemCard = memo(MarketItemCardBase);
