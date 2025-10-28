import { memo } from "react";
import {
  Alert,
  Box,
  Grid,
  GridItem,
  HStack,
  Icon,
  IconButton,
  Skeleton,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import type { MarketItem } from "@/types/market";
import { MarketItemCard } from "./MarketItemCard";

export type ItemsGridProps = {
  /** Items to render on the current page */
  items: MarketItem[];

  /** Units mode: true=units, false=kg */
  unit: boolean;
  onUnitChange: (next: boolean) => void;

  /** Loading flags (first load vs subsequent) */
  isLoading?: boolean;
  isFetching?: boolean;

  /** Error message to show as an inline alert */
  error?: string | null;

  /** Paging */
  page: number; // 1-based
  totalPages: number; // >= 1
  totalItems?: number; // optional for small summary
  onPageChange: (p: number) => void;

  /** Add handler; qty matches mode (units or kg) */
  onAdd?: (payload: { item: MarketItem; qty: number }) => void;

  /** Layout */
  minCardHeight?: string; // default "280px"
  columns?: { base?: number; sm?: number; md?: number; lg?: number; xl?: number };
  gutter?: string; // grid gap; default "4"

  allItemsForRelated?: MarketItem[];
};

/**
 * Paged grid of market items (Chakra UI v3).
 * Uses backend fields:
 * - pricePerKg
 * - pricePerUnit
 * - currentAvailableQuantityKg
 * Cards switch display/qty logic by `unit`.
 */
function ItemsGridBase({
  items,
  unit,
  onUnitChange,
  isLoading = false,
  isFetching = false,
  error = null,
  page,
  totalPages,
  totalItems,
  onPageChange,
  onAdd,
  allItemsForRelated,
  minCardHeight = "280px",
  columns = { base: 2, md: 3, lg: 5 },
  gutter = "4",
}: ItemsGridProps) {
  const renderSkeletons = isLoading;
  const showEmpty = !isLoading && !error && items.length === 0;

  return (
    <Stack gap="4" width="full">
      {error ? (
        <Alert.Root status="error" borderRadius="md">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              <Text fontSize="sm">{error}</Text>
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      ) : null}

      <Grid
        templateColumns={{
          base: `repeat(${columns.base ?? 2}, minmax(0, 1fr))`,
          sm: columns.sm ? `repeat(${columns.sm}, minmax(0, 1fr))` : undefined,
          md: columns.md ? `repeat(${columns.md}, minmax(0, 1fr))` : undefined,
          lg: columns.lg ? `repeat(${columns.lg}, minmax(0, 1fr))` : undefined,
          xl: columns.xl ? `repeat(${columns.xl}, minmax(0, 1fr))` : undefined,
        }}
        gap={gutter}
      >
        {renderSkeletons
          ? Array.from({ length: (columns.lg ?? 4) * 2 }).map((_, i) => (
              <GridItem key={`s-${i}`}>
                <Box borderWidth="1px" borderRadius="lg" overflow="hidden" minH={minCardHeight} p="0">
                  <Skeleton height="80px" />
                  <Stack gap="2" p="3">
                    <Skeleton height="18px" />
                    <Skeleton height="14px" />
                    <Skeleton height="10px" />
                    <Skeleton height="36px" />
                  </Stack>
                </Box>
              </GridItem>
            ))
          : items.map((it) => (
              <GridItem key={`${unit ? "u" : "k"}-${itemKey(it)}`}>
                <MarketItemCard
                  item={it}
                  unit={unit}
                  onUnitChange={onUnitChange}
                  onAdd={onAdd}
                  allItemsForRelated={allItemsForRelated}
                />
              </GridItem>
            ))}
      </Grid>

      {showEmpty ? (
        <Box py="10" textAlign="center" color="fg.muted">
          <Text>No items match your filters.</Text>
        </Box>
      ) : null}

      <HStack justifyContent="center" gap="3" py="2">
        <IconButton
          aria-label="Previous page"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <Icon as={FiChevronLeft} />
        </IconButton>
        <HStack gap="2" minW="120px" justifyContent="center">
          <Text fontSize="sm">
            Page {page}/{Math.max(1, totalPages)}
          </Text>
          {typeof totalItems === "number" ? (
            <Text fontSize="sm" color="fg.muted">
              • {totalItems} items
            </Text>
          ) : null}
          {isFetching && !isLoading ? <Spinner size="xs" /> : null}
        </HStack>
        <IconButton
          aria-label="Next page"
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          <Icon as={FiChevronRight} />
        </IconButton>
      </HStack>
    </Stack>
  );
}

/** Defensive unique key for a MarketItem */
function itemKey(it: MarketItem): string {
  const anyIt = it as any;
  if (anyIt.stockId) return anyIt.stockId;
  if (anyIt.docId) return String(anyIt.docId);
  return `${anyIt.itemId ?? anyIt.id ?? anyIt.name}:${anyIt.farmerId ?? anyIt.farmerName ?? "unknown"}`;
}

export const ItemsGrid = memo(ItemsGridBase);
