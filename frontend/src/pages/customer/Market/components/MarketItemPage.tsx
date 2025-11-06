import { memo, useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Box, HStack, Icon, IconButton, Separator, Stack, Text,
  Avatar, Image, Badge, Button, Spinner, Flex, Dialog, Portal
} from "@chakra-ui/react";
import { FiX, FiChevronLeft, FiChevronRight, FiRefreshCw, FiLock } from "react-icons/fi";
import type { MarketItem } from "@/types/market";
import { getMarketItemPage, type MarketItemPageData } from "@/api/market";
import { qtyToUnits } from "@/utils/market/marketUnits";

export type MarketItemPageProps = {
  item: MarketItem;
  unit: boolean;                    // true = units, false = kg
  onUnitChange: (next: boolean) => void;
  onClose: () => void;
  onAddToCart?: (payload: { item: MarketItem; qty: number }) => void; // qty in UNITS
  onOpenItem?: (item: MarketItem) => void;
  title?: string;
  debugJson?: boolean;
  allItemsForRelated?: MarketItem[];
};

/* ------------------------------ helpers ------------------------------ */
function getImageUrl(it: MarketItem) {
  const anyIt = it as any;
  return anyIt.imageUrl ?? anyIt.imageUrl ?? anyIt.photo ?? anyIt.picture ?? undefined;
}

function avgWeightPerUnitKg(it: MarketItem): number {
  const anyIt = it as any;
  return (
    Number(anyIt.estimates?.avgWeightPerUnitKg) ||
    Number(anyIt.avgWeightPerUnitKg) ||
    0.25
  );
}

function priceOf(it: MarketItem, unitMode: boolean): number {
  const anyIt = it as any;
  const pUnit = Number(anyIt.pricePerUnit);
  const pKg = Number(anyIt.pricePerKg);
  const per = avgWeightPerUnitKg(it);
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

function availableKg(it: MarketItem): number {
  const anyIt = it as any;
  const kg = Number(anyIt.currentAvailableQuantityKg ?? anyIt.availableKg ?? 0);
  return Number.isFinite(kg) && kg > 0 ? kg : 0;
}

function availableUnits(it: MarketItem): number {
  const anyIt = it as any;
  const est = Number(anyIt.estimates?.availableUnitsEstimate);
  if (Number.isFinite(est) && est > 0) return Math.floor(est);
  const per = avgWeightPerUnitKg(it);
  const kg = availableKg(it);
  if (!per || !kg) return 0;
  return Math.floor(kg / per);
}

function availableOf(it: MarketItem, unitMode: boolean): number {
  return unitMode ? availableUnits(it) : Math.floor(availableKg(it));
}

function effectiveUnitForItem(it: any, globalUnit: boolean): { unit: boolean; locked: boolean } {
  const raw = String(it?.unitMode ?? "").trim().toLowerCase(); // "unit" | "kg" | "mix"/empty
  if (raw === "unit") return { unit: true, locked: true };
  if (raw === "kg") return { unit: false, locked: true };
  return { unit: globalUnit, locked: false };
}

function weightPerUnitG(it: any): number {
  const g = Number(it?.weightPerUnitG);
  if (Number.isFinite(g) && g > 0) return Math.round(g);
  const kg = avgWeightPerUnitKg(it as any);
  return Math.round(kg * 1000);
}

/* --------------------------- reusable: Unit toggle --------------------------- */
function UnitToggleButton({
  value,
  onChange,
  locked,
}: {
  value: boolean;              // true = Units, false = Kg
  onChange: (next: boolean) => void;
  locked?: boolean;
}) {
  const label = value ? "Units" : "Kg";
  const aria = locked ? "Mode fixed for this item" : `Current: ${label}. Switch`;
  return (
    <Button
      size="xs"
      variant="outline"
      onClick={() => !locked && onChange(!value)}
      disabled={!!locked}
      aria-label={aria}
      title={aria}
      px="2"
    >
      <HStack gap="1">
        <Icon as={locked ? FiLock : FiRefreshCw} />
        <Text as="span" fontSize="xs">{label}</Text>
      </HStack>
    </Button>
  );
}

/* --------------------------- right purchase --------------------------- */
function RightPurchasePanel({
  item,
  unit: globalUnit,
  onUnitChange,
  onAddToCart,
}: {
  item: MarketItem;
  unit: boolean;
  onUnitChange: (next: boolean) => void;
  onAddToCart?: (p: { item: MarketItem; qty: number }) => void; // qty in UNITS
}) {
  const { unit, locked } = useMemo(() => effectiveUnitForItem(item as any, globalUnit), [item, globalUnit]);

  const name = (item as any).displayName ?? (item as any).name ?? "Item";
  const farmName = (item as any).farmName ?? "";
  const farmerName = (item as any).farmerName ?? (item as any).farmer ?? "";
  const imageUrl = (item as any).imageUrl ?? "";
  const perKg = avgWeightPerUnitKg(item);
  const perG = weightPerUnitG(item);
  const price = priceOf(item, unit);
  const priceOther = priceOf(item, !unit);
  const available = availableOf(item, unit);

  const priceLabel = `$${price.toFixed(2)}/${unit ? "unit" : "kg"}`;
  const altHint = priceOther > 0 ? ` · $${priceOther.toFixed(2)}/${unit ? "kg" : "unit"}` : "";
  const availLabel =
    available > 0
      ? unit
        ? `${available} units available`
        : `${Math.floor(available)} kg available`
      : "Out of stock";

  const STEP = 1;
  const [qty, setQty] = useState<number>(STEP);
  useEffect(() => setQty(STEP), [unit]);

  const minQty = STEP;
  const maxQty = Math.max(STEP, available || STEP);
  const clampQty = (q: number) => Math.max(minQty, Math.min(maxQty, q));

  const inc = useCallback(() => setQty((q) => clampQty(q + STEP)), [maxQty, minQty]);
  const dec = useCallback(() => setQty((q) => clampQty(q - STEP)), [maxQty, minQty]);

  // Always send UNITS to cart
  const handleAdd = useCallback(() => {
    const qEff = clampQty(qty);
    const qtyUnits = qtyToUnits(item as any, unit, qEff);
    if (qtyUnits > 0) onAddToCart?.({ item, qty: qtyUnits });
  }, [clampQty, qty, item, unit, onAddToCart]);

  return (
    <Stack w="100%" gap="4" align="stretch" pl="5" pt="5" borderLeft="2px solid" borderLeftColor="gray.200">
      <HStack justify="space-between" align="center">
        <Stack gap="1" minW={0} pr="2">
          <Image
            src={imageUrl}
            alt={name || "item image"}
            h="100%"
            w="100%"
            borderTopRadius="8px"
            objectFit="contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png"; }}
          />
          <Text fontSize="xl" fontWeight="bold" lineClamp={2}>{name}</Text>
          <Text fontSize="sm" color="fg.muted">
            {farmName ? `from ${farmName}${farmerName ? ` by ${farmerName}` : ""}` : farmerName ? `by ${farmerName}` : ""}
          </Text>
          <Text fontSize="sm" fontWeight="medium">
            {priceLabel}<Text as="span" color="fg.muted">{altHint}</Text>
          </Text>
          <Flex gap="2" align="center">
            <Text fontSize="xs" color="fg.muted">{availLabel}</Text>
            {unit ? (
              perG ? <Text fontSize="xs" color="fg.muted">~{perG} g per unit</Text> : null
            ) : (
              perKg ? <Text fontSize="xs" color="fg.muted">~{perKg} kg per unit</Text> : null
            )}
          </Flex>
        </Stack>
      </HStack>

      <HStack justify="space-between" align="center">
        <HStack gap="2" align="center">
          <Text fontSize="sm" color="fg.muted">Quantity {unit ? "(units)" : "(kg)"}</Text>
          <UnitToggleButton value={unit} onChange={onUnitChange} locked={locked} />
        </HStack>

        <HStack>
          <Button size="sm" variant="outline" onClick={inc} disabled={qty >= maxQty}>+</Button>
          <Box minW="56px" textAlign="center" fontWeight="semibold" aria-live="polite">
            {qty}{unit ? "" : " kg"}
          </Box>
          <Button size="sm" variant="outline" onClick={dec} disabled={qty <= minQty}>–</Button>
        </HStack>
      </HStack>

      <Button
        size="md"
        colorPalette="teal"
        onClick={handleAdd}
        disabled={!onAddToCart || available <= 0 || price <= 0}
      >
        Add to cart
      </Button>
    </Stack>
  );
}

/* ------------------------------ main page in a Dialog (outside scroll) ----------------------------- */
function MarketItemPageBase({
  item,
  unit,
  onUnitChange,
  onClose,
  onAddToCart,
  onOpenItem,
  title,
  allItemsForRelated,
}: MarketItemPageProps) {
  const [activeItem, setActiveItem] = useState<MarketItem>(item);
  const cacheRef = useRef<Map<string, MarketItemPageData>>(new Map());
  useEffect(() => setActiveItem(item), [item]);

  const itemName = useMemo(
    () => title ?? (activeItem as any).displayName ?? (activeItem as any).name ?? "Item",
    [activeItem, title]
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [server, setServer] = useState<{
    benefits: string[];
    farmName?: string;
    farmerBio?: string;
    farmerLogo?: string;
    farmLogo?: string;
    caloriesPer100g?: number;
  } | null>(null);

  useEffect(() => {
    const itemId = (activeItem as any).itemId ?? (activeItem as any).id;
    const farmerUserId = (activeItem as any).farmerId;
    if (!itemId || !farmerUserId) return;

    const key = `${itemId}_${farmerUserId}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setServer({
        benefits: cached.benefits ?? [],
        farmName: cached.farmName,
        farmerBio: cached.farmerBio,
        farmerLogo: cached.farmerLogo,
        farmLogo: cached.farmLogo,
        caloriesPer100g: cached.caloriesPer100g,
      });
      return;
    }

    let cancelled = false;
    setLoading(true);
    getMarketItemPage(itemId, farmerUserId)
      .then((data) => {
        if (cancelled) return;
        cacheRef.current.set(key, data);
        setServer({
          benefits: data.benefits ?? [],
          farmName: data.farmName,
          farmerBio: data.farmerBio,
          farmerLogo: data.farmerLogo,
          farmLogo: data.farmLogo,
          caloriesPer100g: data.caloriesPer100g,
        });
        setErr(null);
      })
      .catch((e) => !cancelled && setErr(String(e?.message ?? e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [activeItem]);

  const farmName = server?.farmName ?? (activeItem as any).farmName ?? "";
  const farmerName = (activeItem as any).farmerName ?? (activeItem as any).farmer ?? "";
  const farmerBio = server?.farmerBio ?? (activeItem as any).farmerBio ?? (activeItem as any).farmBio ?? "";
  const logoSrc = server?.farmLogo || server?.farmerLogo || "";

  const benefitList = server?.benefits?.length ? server.benefits : ["Farm fresh", "Supports local farmers"];
  const calories = server?.caloriesPer100g;

  const related = useMemo(() => {
    const fid = (activeItem as any).farmerId;
    const currStockId = (activeItem as any).stockId;
    return (allItemsForRelated ?? [])
      .filter((x: any) => x?.farmerId === fid && x?.stockId !== currStockId)
      .slice(0, 20);
  }, [allItemsForRelated, activeItem]);

  const rowRef = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dx: number) => rowRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  const handleOpenItem = useCallback(
    (next: MarketItem) => {
      setActiveItem(next);
      onOpenItem?.(next);
      requestAnimationFrame(() => {
        rowRef.current?.scrollTo?.({ left: 0, behavior: "smooth" });
      });
    },
    [onOpenItem]
  );

  return (
    <Dialog.Root
      open
      scrollBehavior="outside"
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Positioner>
          <Dialog.Content
            maxW="900px"
            w={{ base: "92vw", md: "72vw" }}
            rounded="xl"
            shadow="xl"
            p={{ base: 4, md: 6 }}
          >
            <Dialog.CloseTrigger asChild>
              <IconButton aria-label="Close" variant="ghost" size="sm" position="absolute" top="2" right="2" h="8" w="8">
                <Icon as={FiX} />
              </IconButton>
            </Dialog.CloseTrigger>

            {/* Keep header minimal. Move logo and names to the LEFT column below. */}
       

            <Dialog.Body>
              <Stack gap={{ base: 4, md: 6 }}>
                <Stack direction={{ base: "column", md: "row" }} align={{ base: "stretch", md: "flex-start" }} gap={{ base: 4, md: 6 }}>
                  {/* LEFT SIDE: Logo + Farm/Farmer names */}
                  <Stack flex={{ base: "1", md: "0 0 55%" }} gap="4" minW="0">
                    <HStack wrap="wrap" gap="4" align="center">
                      {logoSrc ? (
                        <Avatar.Root size="2xl" shape="full" boxSize={{ base: "96px", md: "128px" }} shadow="md">
                          <Avatar.Image src={logoSrc} alt={farmName || "logo"} />
                          <Avatar.Fallback name={farmName || "Farmer"} />
                        </Avatar.Root>
                      ) : null}
                      <Stack gap="0" minW={0}>
                        <Text fontSize="2xl" fontWeight="bold" lineHeight="1.25" pb="1px">
                          {farmName || itemName}
                        </Text>
                        <Text fontSize="md" color="fg.muted" lineHeight="1.4">
                          by {farmerName || "Farmer"}
                        </Text>
                      </Stack>
                    </HStack>

                    <Stack gap="2">
                      <Text fontWeight="semibold">Farmer bio</Text>
                      {loading ? (
                        <Spinner size="sm" />
                      ) : farmerBio ? (
                        <Text color="fg.muted" lineHeight="tall">{farmerBio}</Text>
                      ) : (
                        <Text color="fg.muted" fontStyle="italic">
                          Learn more about our farmer’s practices and story.
                        </Text>
                      )}
                      {err ? <Text color="red.500" fontSize="sm">Couldn’t load extra info: {err}</Text> : null}
                    </Stack>

                    <Stack gap="2">
                      <Text fontWeight="semibold">Item benefits</Text>
                      <HStack wrap="wrap" gap="2">
                        {benefitList.map((b, i) => (
                          <Badge key={`${b}-${i}`} variant="subtle" rounded="lg" px="2" py="1">
                            {b}
                          </Badge>
                        ))}
                      </HStack>
                      {typeof calories === "number" && (
                        <Text fontSize="xs" color="fg.muted">{calories} kcal / 100g</Text>
                      )}
                    </Stack>

                    <Stack gap="2">
                      <Text fontWeight="semibold">Recepies Suggestion</Text>
                    </Stack>
                  </Stack>

                  {/* RIGHT SIDE: Purchase panel */}
                  <Box flex={{ base: "1", md: "0 0 45%" }}>
                    <RightPurchasePanel item={activeItem} unit={unit} onUnitChange={onUnitChange} onAddToCart={onAddToCart} />
                  </Box>
                </Stack>

                <Separator />

                <Stack gap="3">
                  <HStack justify="space-between" align="center">
                    <Text fontWeight="semibold">More from this farmer</Text>
                    <HStack gap="1">
                      <IconButton aria-label="Scroll left" size="xs" variant="ghost" onClick={() => scrollBy(-280)}>
                        <Icon as={FiChevronLeft} />
                      </IconButton>
                      <IconButton aria-label="Scroll right" size="xs" variant="ghost" onClick={() => scrollBy(280)}>
                        <Icon as={FiChevronRight} />
                      </IconButton>
                    </HStack>
                  </HStack>

                  <HStack ref={rowRef} gap="3" overflowX="auto" py="2" pe="1" css={{ scrollSnapType: "x proximity" }}>
                    {related.length ? (
                      related.map((rel) => (
                        <Box key={(rel as any).stockId ?? (rel as any).itemId} scrollSnapAlign="start">
                          <CompactItemCard it={rel} unit={unit} onAddToCart={onAddToCart} onOpenItem={handleOpenItem} />
                        </Box>
                      ))
                    ) : (
                      <Text color="fg.muted" fontSize="sm">No other items from this farmer right now.</Text>
                    )}
                  </HStack>
                </Stack>
              </Stack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

/* --------------------------- tiny compact card --------------------------- */
function CompactItemCard({
  it,
  unit,
  onAddToCart,
  onOpenItem,
}: {
  it: MarketItem;
  unit: boolean;
  onAddToCart?: (p: { item: MarketItem; qty: number }) => void; // qty in UNITS
  onOpenItem?: (item: MarketItem) => void;
}) {
  const imageUrl = getImageUrl(it);
  console.log(imageUrl, "sssssssssssssssssssssssssssss");
  console.log(it, "..........................");
  const name = (it as any).displayName ?? (it as any).name ?? "Item";
  const price = priceOf(it, unit);
  const farmerName = (it as any).farmerName;

  const open = useCallback(() => onOpenItem?.(it), [onOpenItem, it]);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    },
    [open]
  );

  return (
    <Stack borderWidth="1px" borderRadius="lg" overflow="hidden" minW="180px" maxW="180px" gap="2" p="2" bg="bg" >
      <Stack gap="2" role="button" tabIndex={0} onClick={open} onKeyDown={onKeyDown} cursor="pointer">
        <Box
          bg="bg.muted"
          rounded="md"
          overflow="hidden"
          h="120px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Image
            src={imageUrl}
            alt={name || "item image"}
            h="100%"
            w="100%"
            objectFit="contain"
            loading="lazy"
            borderRadius="8px"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/images/placeholder.png"; }}
          />
        </Box>

        <Text fontWeight="semibold" fontSize="sm" lineClamp={2}>{name}</Text>
        {farmerName ? <Text fontSize="xs" color="fg.muted" lineClamp={1}>{farmerName}</Text> : null}
        <Text fontSize="xs">${price.toFixed(2)}/{unit ? "unit" : "kg"}</Text>
      </Stack>

      <Button
        size="xs"
        variant="outline"
        onClick={() => {
          const { unit: eff } = effectiveUnitForItem(it as any, unit);
          const qUnits = qtyToUnits(it as any, eff, 1);
          onAddToCart?.({ item: it, qty: qUnits });
        }}
        disabled={price <= 0}
      >
        Add
      </Button>
    </Stack>
  );
}

export const MarketItemPage = memo(MarketItemPageBase);
