// src/pages/.../components/MarketItemPage.tsx
import { memo, useMemo, useState, useCallback } from "react";
import {
  Box,
  HStack,
  Icon,
  IconButton,
  Separator,
  Stack,
  Text,
  Avatar,
  Image,
  Badge,
  Button,
} from "@chakra-ui/react";
import { FiX } from "react-icons/fi";
import type { MarketItem } from "@/types/market";
import { prettyJson } from "@/utils/prettyJson";

/* ------------------------------ props ------------------------------ */
export type MarketItemPageProps = {
  item: MarketItem;
  benefits?: string[];
  moreFromFarmer?: MarketItem[]; // (not shown now, but kept for future)
  onClose: () => void;
  onAddToCart?: (payload: { item: MarketItem; qty: number }) => void;
  title?: string;
  debugJson?: boolean;
};

/* ------------------------------ helpers ------------------------------ */
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
    anyIt.availableKg ??
    0;
  const n = Number(cand);
  return Number.isFinite(n) ? n : 0;
}

/* ------------- Right column: image + name + source + qty + add ----------- */
function RightPurchasePanel({
  item,
  onAddToCart,
}: {
  item: MarketItem;
  onAddToCart?: (payload: { item: MarketItem; qty: number }) => void;
}) {
  const img = getImageUrl(item);
  const name = (item as any).name ?? (item as any).displayName ?? "Item";
  const farmName = (item as any).farmName ?? "";
  const farmerName = (item as any).farmerName ?? (item as any).farmer ?? "";
  const available = getAvailableUnits(item);

  const [qty, setQty] = useState<number>(1);
  const minQty = 1;
  const maxQty = Math.max(1, Number.isFinite(available) && available > 0 ? available : 20);

  const inc = useCallback(() => setQty((q) => Math.min(maxQty, q + 1)), [maxQty]);
  const dec = useCallback(() => setQty((q) => Math.max(minQty, q - 1)), []);

  const handleAdd = useCallback(() => {
    const clamped = Math.max(minQty, Math.min(maxQty, qty));
    onAddToCart?.({ item, qty: clamped });
  }, [onAddToCart, item, qty, maxQty]);

  return (
    <Stack
      w={{ base: "100%", md: "340px" }}
      minW={{ base: "100%", md: "300px" }}
      gap="4"
      align="stretch"
    >
      <Box bg="bg.muted" rounded="lg" overflow="hidden">
        {img ? (
          <Image src={img} alt={name} w="100%" h="auto" objectFit="cover" />
        ) : (
          <Box w="100%" h="220px" />
        )}
      </Box>

      <Stack gap="1">
        <Text fontSize="xl" fontWeight="bold" lineClamp={2}>
          {name}
        </Text>
        <Text fontSize="sm" color="fg.muted">
          {farmName
            ? `from ${farmName}${farmerName ? ` by ${farmerName}` : ""}`
            : farmerName
            ? `by ${farmerName}`
            : ""}
        </Text>
        {Number.isFinite(available) && (
          <Text fontSize="xs" color="fg.muted">
            {available} units available
          </Text>
        )}
      </Stack>

      {/* qty row: [ + ] [ 0 ] [ - ] */}
      <HStack justify="space-between" align="center">
        <Button
          size="sm"
          variant="outline"
          onClick={inc}
          disabled={qty >= maxQty}
          aria-label="Increase quantity"
        >
          +
        </Button>

        <Box minW="48px" textAlign="center" fontWeight="semibold" aria-live="polite">
          {qty}
        </Box>

        <Button
          size="sm"
          variant="outline"
          onClick={dec}
          disabled={qty <= minQty}
          aria-label="Decrease quantity"
        >
          –
        </Button>
      </HStack>

      <Button
        size="md"
        colorPalette="teal"
        onClick={handleAdd}
        disabled={!onAddToCart}
      >
        Add to cart
      </Button>
    </Stack>
  );
}

/* --------------------------------- UI --------------------------------- */
function MarketItemPageBase({
  item,
  onClose,
  onAddToCart,
  title,
  benefits,
  debugJson = false,
}: MarketItemPageProps) {
  const itemName = useMemo(() => {
    const anyIt = item as any;
    return title ?? anyIt.name ?? anyIt.displayName ?? anyIt.title ?? "Item";
  }, [item, title]);

  const farmName = useMemo(() => (item as any).farmName ?? "", [item]);
  const farmerName = useMemo(() => (item as any).farmerName ?? (item as any).farmer ?? "", [item]);
  const farmerLogo = useMemo(() => getFarmerIconUrl(item), [item]);
  const farmerBio = useMemo(
    () => (item as any).farmerBio ?? (item as any).farmBio ?? "",
    [item]
  );

  const benefitList = useMemo<string[]>(() => {
    if (Array.isArray(benefits) && benefits.length) return benefits;
    const anyIt = item as any;
    const inferred: string[] = [];
    if (anyIt.organic) inferred.push("Organic");
    if (anyIt.locallyGrown || anyIt.local) inferred.push("Locally grown");
    if (anyIt.nonGMO) inferred.push("Non-GMO");
    if (anyIt.freshnessScore >= 90) inferred.push("Picked today");
    if ((anyIt.tags ?? []).includes("pesticide-free")) inferred.push("Pesticide-free");
    return inferred.length ? inferred : ["Farm fresh", "Supports local farmers"];
  }, [benefits, item]);

  const json = useMemo(() => (debugJson ? prettyJson(item) : ""), [item, debugJson]);

  return (
    <Box
      position="relative"
      width="full"
      maxW="960px"
      bg="bg"
      borderRadius="xl"
      borderWidth="1px"
      boxShadow="xl"
      p={{ base: 4, md: 6 }}
    >
      {/* Close */}
      <IconButton
        aria-label="Close"
        onClick={onClose}
        variant="ghost"
        size="sm"
        position="absolute"
        top="2"
        right="2"
      >
        <Icon as={FiX} />
      </IconButton>

      <Stack gap={{ base: 4, md: 6 }}>
        {/* ================ TWO-COLUMN LAYOUT (bio+benefits | purchase) ================ */}
        <Stack
  direction={{ base: "column", md: "row" }}
  align={{ base: "stretch", md: "flex-start" }}
  gap={{ base: 4, md: 6 }}
>
  {/* LEFT: Farmer bio + Item benefits (55%) */}
  <Stack flex={{ base: "1", md: "0 0 55%" }} gap="4" minW="0">
    {/* Header: farm + farmer */}
    <Stack gap="1">
      <HStack wrap="wrap" gap="2">
        <Text fontSize="lg" fontWeight="semibold" lineClamp={2}>
          {farmName ? `${farmName} by ${farmerName || "Farmer"}` : (farmerName || "Farmer")}
        </Text>
        {farmerLogo ? (
          <Avatar.Root size="sm">
            <Avatar.Image src={farmerLogo} alt={farmerName || "farmer logo"} />
          </Avatar.Root>
        ) : null}
      </HStack>
      <Text fontSize="xl" fontWeight="bold" lineClamp={2}>
        {itemName}
      </Text>
    </Stack>

    {/* Farmer bio */}
    <Stack gap="2">
      <Text fontWeight="semibold">Farmer bio</Text>
      {farmerBio ? (
        <Text color="fg.muted" lineHeight="tall">
          {farmerBio}
        </Text>
      ) : (
        <Text color="fg.muted" fontStyle="italic">
          Learn more about our farmer’s practices and story.
        </Text>
      )}
    </Stack>

    {/* Item benefits */}
    <Stack gap="2">
      <Text fontWeight="semibold">Item benefits</Text>
      <HStack wrap="wrap" gap="2">
        {benefitList.map((b, i) => (
          <Badge key={`${b}-${i}`} variant="subtle" rounded="lg" px="2" py="1">
            {b}
          </Badge>
        ))}
      </HStack>
    </Stack>
  </Stack>

  {/* RIGHT: Purchase panel (45%) */}
  <Box flex={{ base: "1", md: "0 0 45%" }}>
    <RightPurchasePanel item={item} onAddToCart={onAddToCart} />
  </Box>
</Stack>


        {/* Optional separator and debug JSON */}
        {debugJson ? (
          <>
            <Separator />
            <Box
              as="pre"
              fontFamily="mono"
              fontSize="sm"
              whiteSpace="pre-wrap"
              overflow="auto"
              maxH="40vh"
              borderRadius="md"
              borderWidth="1px"
              p="3"
              bg="bg.subtle"
            >
              {json}
            </Box>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}

export const MarketItemPage = memo(MarketItemPageBase);
