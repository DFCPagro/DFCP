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
import { qtyToUnits } from "@/utils/marketUnits";

export type MarketItemCardProps = {
  item: MarketItem;
  unit: boolean; // true=units, false=kg
  onUnitChange: (next: boolean) => void;
  onClick?: (item: MarketItem) => void;
  onAdd?: (payload: { item: MarketItem; qty: number }) => void; // qty in UNITS
  adding?: boolean;
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

/** avg weight per unit from backend, fallback to 0.25 kg */
function avgPerUnitKg(it: any): number {
  return (
    Number(it?.estimates?.avgWeightPerUnitKg) ||
    Number(it?.avgWeightPerUnitKg) ||
    0.25
  );
}

/** price from backend: pricePerKg | pricePerUnit */
function priceOf(it: MarketItem, unitMode: boolean): number {
  const anyIt = it as any;
  const pUnit = Number(anyIt.pricePerUnit);
  const pKg = Number(anyIt.pricePerKg);
  const per = avgPerUnitKg(anyIt);

  if (unitMode) {
    if (Number.isFinite(pUnit) && pUnit > 0) return pUnit;
    if (Number.isFinite(pKg) && pKg > 0 && per > 0) return pKg * per;
    return 0;
  } else {
    if (Number.isFinite(pKg) && pKg > 0) return pKg;
    if (Number.isFinite(pUnit) && pUnit > 0 && per > 0) return pUnit / per;
    return 0;
  }
}

/** available kg straight from backend: currentAvailableQuantityKg */
function availableKg(it: MarketItem): number {
  const anyIt = it as any;
  const kg = Number(anyIt.currentAvailableQuantityKg ?? anyIt.availableKg ?? 0);
  return Number.isFinite(kg) && kg > 0 ? kg : 0;
}

/** available units from backend estimate if present else derive from kg/per */
function availableUnits(it: MarketItem): number {
  const anyIt = it as any;
  const estUnits = Number(anyIt?.estimates?.availableUnitsEstimate);
  if (Number.isFinite(estUnits) && estUnits > 0) return Math.floor(estUnits);
  const per = avgPerUnitKg(anyIt);
  const kg = availableKg(anyIt);
  if (!per || !kg) return 0;
  return Math.floor(kg / per);
}

function availableOf(it: MarketItem, unitMode: boolean): number {
  return unitMode ? availableUnits(it) : Math.floor(availableKg(it));
}

// true=unit, false=kg, and whether user can toggle
function effectiveUnitForItem(it: any, globalUnit: boolean): { unit: boolean; locked: boolean } {
  const raw = String(it?.unitMode ?? "").trim().toLowerCase(); // "mix" | "unit" | "kg"
  if (raw === "unit") return { unit: true, locked: true };
  if (raw === "kg") return { unit: false, locked: true };
  return { unit: globalUnit, locked: false };
}

/** weight per unit in grams; fallback to avgPerUnitKg*1000 */
function weightPerUnitG(it: any): number {
  const g = Number(it?.weightPerUnitG);
  if (Number.isFinite(g) && g > 0) return Math.round(g);
  const kg = avgPerUnitKg(it);
  return Math.round(kg * 1000);
}

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
  const MAX_KG_FALLBACK = 100;

  const { unit: effUnit, locked } = useMemo(
    () => effectiveUnitForItem(item as any, unit),
    [item, unit]
  );

  const [qty, setQty] = useState<number>(effUnit ? 1 : DEFAULT_KG);
  useEffect(() => setQty(effUnit ? 1 : DEFAULT_KG), [effUnit]);

  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const openQuickView = useCallback(() => setIsOpen(true), []);
  const closeQuickView = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus?.();
  }, []);

  const img = (item as any).imageUrl;
  const farmerIcon = (item as any).farmLogo;
  const farmerName = (item as any).farmerName;
  const name = (item as any).displayName ?? (item as any).name;
  const variety = (item as any).variety as string | undefined;

  const price = priceOf(item, effUnit);
  const per = avgPerUnitKg(item as any);
  const perG = weightPerUnitG(item as any);
  const available = availableOf(item, effUnit);

  const LOW_STOCK_UNITS = 100;
  const LOW_STOCK_KG = 10;
  const showLowStock = effUnit
    ? available > 0 && available <= LOW_STOCK_UNITS
    : available > 0 && available <= LOW_STOCK_KG;

  const priceLabel = useMemo(
    () => `$${(Number.isFinite(price) ? price : 0).toFixed(2)}/${effUnit ? "unit" : "kg"}`,
    [price, effUnit]
  );

  const availLabel = effUnit
    ? `${available} units available`
    : `${Math.floor(available)} kg available`;

  const ensureQtySafe = useCallback(
    (q: number) => {
      if (effUnit) {
        const maxUnits = available > 0 ? Math.floor(available) : Math.max(1, maxQty);
        return clamp(Math.floor(q) || 1, Math.max(1, minQty), Math.max(1, Math.min(maxQty, maxUnits)));
      }
      const maxKg = available > 0 ? Math.floor(available) : MAX_KG_FALLBACK;
      const stepped = roundTo(q, STEP_KG) || STEP_KG;
      return clamp(stepped, STEP_KG, maxKg);
    },
    [effUnit, minQty, maxQty, available]
  );

  const dec = useCallback(() => {
    setQty((q) => (effUnit ? ensureQtySafe(q - 1) : ensureQtySafe(roundTo(q - STEP_KG, STEP_KG))));
  }, [effUnit, ensureQtySafe]);

  const inc = useCallback(() => {
    setQty((q) => (effUnit ? ensureQtySafe(q + 1) : ensureQtySafe(roundTo(q + STEP_KG, STEP_KG))));
  }, [effUnit, ensureQtySafe]);

  // Always send UNITS to cart
  const handleAdd = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
   const qEff = ensureQtySafe(qty);
const sellsInUnitOnly =
  String((item as any).unitMode ?? "").trim().toLowerCase() === "unit";
const qtyToSend = sellsInUnitOnly ? Math.max(1, Math.floor(qEff)) : qtyToUnits(item as any, effUnit, qEff);
if (qtyToSend > 0) onAdd?.({ item, qty: qtyToSend });

    },
    [onAdd, item, qty, ensureQtySafe, effUnit]
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
              <Text fontWeight="semibold" whiteSpace="normal" wordBreak="normal" overflowWrap="break-word">
                {name ?? "Item"}
              </Text>
              {variety ? (
                <Text fontSize="sm" color="fg.muted" whiteSpace="normal" wordBreak="normal" overflowWrap="break-word">
                  {variety}
                </Text>
              ) : null}
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
          <HStack justify="space-between" align="center">
            <Text fontWeight="medium">{priceLabel}</Text>
            <Stack gap="0" align="end">
              {showLowStock ? <Text fontSize="sm" color="fg.warning">{availLabel}</Text> : null}
              {effUnit ? (
                <Text fontSize="xs" color="fg.muted">~{perG} g per unit</Text>
              ) : per ? (
                <Text fontSize="xs" color="fg.muted">~{per} kg per unit</Text>
              ) : null}
            </Stack>
          </HStack>

          {/* Qty control */}
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="fg.muted">Quantity {effUnit ? "(units)" : "(kg)"}</Text>
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
                {effUnit ? qty : `${qty} kg`}
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
            disabled={price <= 0 || available <= 0 || qty <= 0}
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
                unit={effUnit}
                onUnitChange={locked ? () => {} : onUnitChange}
                onClose={closeQuickView}
                // MarketItemPage already normalizes to UNITS
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
