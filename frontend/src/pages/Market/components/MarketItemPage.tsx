// src/pages/.../components/MarketItemPage.tsx
import { memo, useMemo } from "react";
import {
  Box,
  HStack,
  Icon,
  IconButton,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FiX } from "react-icons/fi";
import type { MarketItem } from "@/types/market";
import { prettyJson } from "@/utils/prettyJson";

export type MarketItemPageProps = {
  /** Full item object to display */
  item: MarketItem;
  /** Close handler (wired to [×]) */
  onClose: () => void;
  /** Optional heading override; if not provided, we’ll show item name (when available) */
  title?: string;
};

/**
 * MarketItemPage
 * Minimal, centered content for a popup:
 * - Top-right [×] to close
 * - Item name (if present)
 * - Farmer name (if present)
 * - Pretty-printed JSON dump of the entire item (fallback info)
 *
 * NOTE: This is the *content* used inside a Dialog. It does not render an overlay itself.
 */
function MarketItemPageBase({ item, onClose, title }: MarketItemPageProps) {
  // Defensive name lookups (we still print raw JSON below for full visibility)
  const itemName = useMemo(() => {
    const anyIt = item as any;
    return anyIt.name ?? anyIt.displayName ?? anyIt.title ?? "";
  }, [item]);

  const farmerName = useMemo(() => {
    const anyIt = item as any;
    return anyIt.farmerName ?? anyIt.farmName ?? anyIt.farmer ?? "";
  }, [item]);

  const json = useMemo(() => prettyJson(item), [item]);

  return (
    <Box
      position="relative"
      width="full"
      maxW="560px"
      bg="bg"
      borderRadius="xl"
      borderWidth="1px"
      boxShadow="lg"
      p="4"
    >
      {/* Close button (top-right) */}
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

      <Stack gap="3">
        {/* Heading */}
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="semibold">
            {title || itemName || "Item"}
          </Text>
        </HStack>

        {/* Secondary line (farmer name) */}
        {farmerName ? (
          <Text color="fg.muted" fontSize="sm">
            {farmerName}
          </Text>
        ) : null}

        <Separator />

        {/* Raw JSON dump of the item as fallback/full detail */}
        <Box
          as="pre"
          fontFamily="mono"
          fontSize="sm"
          whiteSpace="pre-wrap"
          overflow="auto"
          maxH="50vh"
          borderRadius="md"
          borderWidth="1px"
          p="3"
          bg="bg.subtle"
        >
          {json}
        </Box>
      </Stack>
    </Box>
  );
}

export const MarketItemPage = memo(MarketItemPageBase);
