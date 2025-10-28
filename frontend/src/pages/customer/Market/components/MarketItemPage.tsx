import { memo, useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Box, HStack, Icon, IconButton, Separator, Stack, Text,
  Avatar, Image, Badge, Button, Spinner
} from "@chakra-ui/react";
import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import type { MarketItem } from "@/types/market";
import { getMarketItemPage, type MarketItemPageData } from "@/api/market";

export type MarketItemPageProps = {
  item: MarketItem;
  unit: boolean;                    // true = units, false = kg
  onUnitChange: (next: boolean) => void;
  onClose: () => void;
  onAddToCart?: (payload: { item: MarketItem; qty: number }) => void; // qty matches mode
  onOpenItem?: (item: MarketItem) => void;
  title?: string;
  debugJson?: boolean;
  allItemsForRelated?: MarketItem[];
};

/* ------------------------------ helpers ------------------------------ */
function getImageUrl(it: MarketItem) {
  const anyIt = it as any;
  return anyIt.imageUrl ?? anyIt.img ?? anyIt.photo ?? anyIt.picture ?? undefined;
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
  return unitMode ? Number(anyIt.pricePerUnit) || 0 : Number(anyIt.pricePerKg) || 0;
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

/* --------------------------- right purchase --------------------------- */
function RightPurchasePanel({
  item,
  unit,
  onUnitChange,
  onAddToCart,
}: {
  item: MarketItem;
  unit: boolean;
  onUnitChange: (next: boolean) => void;
  onAddToCart?: (p: { item: MarketItem; qty: number }) => void;
}) {
  const img = getImageUrl(item);
  const name = (item as any).displayName ?? (item as any).name ?? "Item";
  const farmName = (item as any).farmName ?? "";
  const farmerName = (item as any).farmerName ?? (item as any).farmer ?? "";

  const per = avgWeightPerUnitKg(item);
  const price = priceOf(item, unit);
  const priceOther = priceOf(item, !unit);
  const available = availableOf(item, unit);

  const priceLabel = `$${price.toFixed(2)}/${unit ? "unit" : "kg"}`;
  const altHint =
    priceOther > 0 ? ` · $${priceOther.toFixed(2)}/${unit ? "kg" : "unit"}` : "";
  const availLabel =
    available > 0
      ? unit
        ? `${available} units available`
        : `${Math.floor(available)} kg available`
      : "Out of stock";

  // qty is units when unit=true, else kg
  const STEP_UNITS = 1;
  const STEP_KG = 1;
  const STEP = unit ? STEP_UNITS : STEP_KG;

  const [qty, setQty] = useState<number>(STEP);
  useEffect(() => setQty(STEP), [unit]);

  const minQty = STEP;
  const maxQty = Math.max(STEP, available || STEP);

  const inc = useCallback(() => setQty((q) => Math.min(maxQty, q + STEP)), [maxQty, STEP]);
  const dec = useCallback(() => setQty((q) => Math.max(minQty, q - STEP)), [minQty, STEP]);

  const handleAdd = useCallback(() => {
    const clamped = Math.max(minQty, Math.min(maxQty, qty));
    // qty matches current mode: units if unit=true, kg if unit=false
    onAddToCart?.({ item, qty: clamped });
  }, [onAddToCart, item, qty, maxQty, minQty]);

  return (
    <Stack w="100%" gap="4" align="stretch">
      <Box bg="bg.muted" rounded="lg" overflow="hidden">
        {img ? <Image src={img} alt={name} w="100%" h="auto" objectFit="cover" /> : <Box w="100%" h="220px" />}
      </Box>

      <HStack justify="space-between" align="center">
        <Stack gap="1" minW={0}>
          <Text fontSize="xl" fontWeight="bold" lineClamp={2}>{name}</Text>
          <Text fontSize="sm" color="fg.muted">
            {farmName ? `from ${farmName}${farmerName ? ` by ${farmerName}` : ""}` : farmerName ? `by ${farmerName}` : ""}
          </Text>
          <Text fontSize="sm" fontWeight="medium">{priceLabel}<Text as="span" color="fg.muted">{altHint}</Text></Text>
          <Text fontSize="xs" color="fg.muted">{availLabel}</Text>
          {!unit && per ? (
            <Text fontSize="xs" color="fg.muted">~{per} kg per unit</Text>
          ) : null}
        </Stack>

        <Button size="xs" variant="outline" onClick={() => onUnitChange(!unit)} aria-pressed={unit}>
          {unit ? "Units" : "Kg"}
        </Button>
      </HStack>

      <HStack justify="space-between" align="center">
        <Text fontSize="sm" color="fg.muted">Quantity {unit ? "(units)" : "(kg)"}</Text>
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

/* ------------------------------ main page ----------------------------- */
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
        rowRef.current?.closest("[data-item-page-root]")?.scrollTo?.({ top: 0, behavior: "smooth" });
      });
    },
    [onOpenItem]
  );

  return (
    <Box
      data-item-page-root
      position="relative"
      w={{ base: "92vw", md: "72vw" }}
      maxW="900px"
      bg="bg"
      borderRadius="xl"
      borderWidth="1px"
      boxShadow="xl"
      p={{ base: 4, md: 6 }}
      mx="auto"
      alignSelf="center"
      maxH="85vh"
      overflowY="auto"
    >
      <IconButton aria-label="Close" onClick={onClose} variant="ghost" size="sm" position="absolute" top="2" right="2">
        <Icon as={FiX} />
      </IconButton>

      <Stack gap={{ base: 4, md: 6 }}>
        <Stack direction={{ base: "column", md: "row" }} align={{ base: "stretch", md: "flex-start" }} gap={{ base: 4, md: 6 }}>
          <Stack flex={{ base: "1", md: "0 0 55%" }} gap="4" minW="0">
            <Stack gap="1">
              <HStack wrap="wrap" gap="4" align="center">
                {logoSrc ? (
                  <Avatar.Root size="2xl" shape="full" shadow="md" boxSize="120px" flexShrink={0}>
                    <Avatar.Image src={logoSrc} alt={farmName || "logo"} />
                    <Avatar.Fallback name={farmName || "Farmer"} />
                  </Avatar.Root>
                ) : null}
                <Stack gap="0" minW="0">
                  <Text fontSize="2xl" fontWeight="bold" lineHeight="1.25" pb="1px">
                    {farmName || itemName}
                  </Text>
                  <Text fontSize="md" color="fg.muted" lineHeight="1.4">
                    by {farmerName || "Farmer"}
                  </Text>
                </Stack>
              </HStack>
            </Stack>

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
    </Box>
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
  onAddToCart?: (p: { item: MarketItem; qty: number }) => void;
  onOpenItem?: (item: MarketItem) => void;
}) {
  const img = getImageUrl(it);
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

  // qty=1 means 1 unit in unit-mode, or 1 kg in kg-mode
  const qty = 1;

  return (
    <Stack borderWidth="1px" borderRadius="lg" overflow="hidden" minW="180px" maxW="180px" gap="2" p="2" bg="bg">
      <Stack gap="2" role="button" tabIndex={0} onClick={open} onKeyDown={onKeyDown} cursor="pointer">
        <Box bg="bg.muted" rounded="md" overflow="hidden">
          {img ? <Image src={img} alt={name} w="100%" h="120px" objectFit="cover" /> : <Box h="120px" />}
        </Box>
        <Text fontWeight="semibold" fontSize="sm" lineClamp={2}>{name}</Text>
        {farmerName ? <Text fontSize="xs" color="fg.muted" lineClamp={1}>{farmerName}</Text> : null}
        <Text fontSize="xs">${price.toFixed(2)}/{unit ? "unit" : "kg"}</Text>
      </Stack>

      <Button size="xs" variant="outline" onClick={() => onAddToCart?.({ item: it, qty })} disabled={price <= 0}>
        Add
      </Button>
    </Stack>
  );
}

export const MarketItemPage = memo(MarketItemPageBase);
