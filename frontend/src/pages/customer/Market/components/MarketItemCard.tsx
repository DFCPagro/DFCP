import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
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
  unit: boolean; // true=units, false=kg
    onUnitChange: (next: boolean) => void;   // <-- add

  onClick?: (item: MarketItem) => void;
  onAdd?: (payload: { item: MarketItem; qty: number }) => void; // qty matches mode
  adding?: boolean;

  /** Optional qty bounds for unit-mode; kg-mode clamps by available kg */
  minQty?: number;
  maxQty?: number;

  allItemsForRelated?: MarketItem[];
};

/* ------------------------------ helpers ------------------------------ */

const colorPalette = ["red", "blue", "green", "yellow", "purple", "orange"] as const;
const fallbackTemp = "https://cdn-icons-png.flaticon.com/128/7417/7417717.png";

const pickPalette = (name?: string | null) => {
  const n = name?.trim();
  if (!n) return "gray";
  const index = n.charCodeAt(0) % colorPalette.length;
  return colorPalette[index];
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

function priceOf(it: MarketItem, unitMode: boolean): number {
  return Number(unitMode ? it.pricePerUnit : (it as any).pricePerKg) || 0;
}

function availableOf(it: MarketItem, unitMode: boolean): number {
  const kg = Number((it as any).currentAvailableQuantityKg ?? (it as any).availableKg ?? 0);
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  if (!unitMode) return kg; // show kg
  const per = Number(it.avgWeightPerUnitKg);
  if (!Number.isFinite(per) || per <= 0) return 0;
  return Math.floor(kg / per); // show units
}

/* --------------------------------- UI --------------------------------- */

function MarketItemCardBase({
  item,
  unit,
  onUnitChange,
  onClick,
  onAdd,
  adding,
  minQty = 1,
  maxQty = 200,

  allItemsForRelated,
}: MarketItemCardProps) {
  const STEP_KG = 1;
  const DEFAULT_KG = 1;
const MAX_KG_FALLBACK = 100; // cap when available kg is unknown

  // qty is units when unit=true, else kg
  const [qty, setQty] = useState<number>(unit ? 1 : DEFAULT_KG);
  useEffect(() => setQty(unit ? 1 : DEFAULT_KG), [unit]);

  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openQuickView = useCallback(() => setIsOpen(true), []);
  const closeQuickView = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus?.();
  }, []);

  const img = item.imageUrl;
  const farmerIcon = item.farmLogo;
  const farmerName = item.farmerName;
  const name = item.name;
  const variety = (item as any).variety as string | undefined;

  const price = priceOf(item, unit);
  useEffect(() => {
  console.log(
    "mode", unit ? "units" : "kg",
    "pricePerUnit", item.pricePerUnit,
    "pricePerKg", (item as any).pricePerKg,
    "computed price", price
  );
}, [unit, item, price]);

  const available = availableOf(item, unit);
const LOW_STOCK_UNITS = 100;
const LOW_STOCK_KG = 10;
const showLowStock = unit
  ? available > 0 && available <= LOW_STOCK_UNITS
  : available > 0 && available <= LOW_STOCK_KG;



  const priceLabel = useMemo(
    () => `$${(Number.isFinite(price) ? price : 0).toFixed(2)}/${unit ? "unit" : "kg"}`,
    [price, unit]
  );

  const qtyLabel = unit ? String(qty) : `${qty} kg`;
const availLabel = unit
  ? `${available} units available`
  : `${Math.floor(available)} kg available`;

const ensureQtySafe = useCallback(
  (q: number) => {
    if (unit) {
      const maxUnits = available > 0 ? Math.floor(available) : Math.max(1, maxQty);
      return clamp(Math.floor(q) || 1, Math.max(1, minQty), Math.max(1, Math.min(maxQty, maxUnits)));
    }
    const maxKg = available > 0 ? Math.floor(available) : MAX_KG_FALLBACK;
    const stepped = roundTo(q, STEP_KG) || STEP_KG; // STEP_KG = 1
    return clamp(stepped, STEP_KG, maxKg);
  },
  [unit, minQty, maxQty, available]
);

  const dec = useCallback(() => {
    setQty((q) => (unit ? ensureQtySafe(q - 1) : ensureQtySafe(roundTo(q - STEP_KG, STEP_KG))));
  }, [unit, ensureQtySafe]);

  const inc = useCallback(() => {
    setQty((q) => (unit ? ensureQtySafe(q + 1) : ensureQtySafe(roundTo(q + STEP_KG, STEP_KG))));
  }, [unit, ensureQtySafe]);

  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const q = ensureQtySafe(qty);
      if (q > 0) onAdd?.({ item, qty: q });
    },
    [onAdd, item, qty, ensureQtySafe]
  );

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
                e.stopPropagation();
                openQuickView();
              }}
              style={{ display: "block", width: "100%", height: "100%", padding: 0, background: "transparent", border: "none", cursor: "pointer" }}
              aria-label="Open item preview"
            >
              <Image src={img} alt={name ?? "item"} objectFit="cover" w="100%" h="100%" />
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
              <Text fontWeight="semibold" lineClamp={1}>{name ?? "Item"}</Text>
              {variety ? <Text fontSize="sm" color="fg.muted" lineClamp={1}>{variety}</Text> : null}
            </Stack>

            {farmerIcon ? (
              <Avatar.Root size="sm">
                <Avatar.Image src={farmerIcon} alt={farmerName ?? "farmer"} />
              </Avatar.Root>
            ) : null}
          </HStack>

          {farmerName ? (
            <HStack justify="space-between">
              <Text fontSize="sm" color="fg.muted" lineClamp={1}>{farmerName}</Text>
              {farmerIcon ? (
                <Image src={farmerIcon ?? fallbackTemp} objectFit="cover" w="20%" h="20%" />
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
  {showLowStock ? (
    <Text fontSize="sm" color="fg.warning">{availLabel}</Text>
  ) : null}
</HStack>

          {/* Qty control */}
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="fg.muted">Quantity {unit ? "(units)" : "(kg)"}</Text>
            <HStack>
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); dec(); }}
                disabled={!!adding}
              >
                –
              </Button>
              <Box minW="48px" textAlign="center" fontWeight="semibold" aria-live="polite">
                {qtyLabel}
              </Box>
              <Button
                size="xs"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); inc(); }}
                disabled={!!adding}
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
            disabled={unit ? qty < Math.max(1, minQty) : qty < STEP_KG}
          >
            <FiShoppingCart />
            <Box as="span" ms="2">Add</Box>
          </Button>
        </HStack>
      </Card.Footer>

      {/* Quick View Dialog */}
      <Dialog.Root open={isOpen} onOpenChange={(e) => setIsOpen(e.open)} role="dialog">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content
              p="0"
              bg="transparent"
              shadow="none"
              _focusVisible={{ boxShadow: "none" }}
              w="100vw"
              maxW="100vw"
              h="100vh"
              display="flex"
              justifyContent="center"
              alignItems="center"
            >
         <MarketItemPage
      item={item}
      unit={unit}                        // <-- add
      onUnitChange={onUnitChange}        // <-- add
      onClose={closeQuickView}
      onAddToCart={({ item: it, qty }) => onAdd?.({ item: it, qty })}
      allItemsForRelated={allItemsForRelated}
    />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Card.Root>
  );
}

export const MarketItemCard = memo(MarketItemCardBase);
