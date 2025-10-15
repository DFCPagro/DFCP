"use client";

import { useState } from "react";
import {
  Box,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Text,
  Button,
  VStack,
} from "@chakra-ui/react";
import { MapPin } from "lucide-react";
import ItemList from "@/components/common/ItemList";
import type { OrderRowAPI } from "../../../types/orders";
import OrderTimeline from "./OrderTimeline";
import {
  STATUS_EMOJI,
  STATUS_LABEL,
  formatDeliveryTime,
  normalizeStatus,
  pickCurrency,
  pickDeliveryPoint,
  toItemRows,
  isOldStatus,
  type LatLng,
} from "./helpers";

type Props = {
  order?: OrderRowAPI | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenMap: (pt: LatLng, onlyDelivery?: boolean) => void; // <- allow optional 2nd arg
  onOpenNote: () => void;
};

export default function OrderCard({
  order,
  isOpen,
  onToggleOpen,
  onOpenMap,
  onOpenNote,
}: Props) {
  if (!order) return null;

  const [timelineOpen, setTimelineOpen] = useState(false);

  const ui = normalizeStatus((order as any).status);
  const emoji = STATUS_EMOJI[ui];
  const statusLabel = STATUS_LABEL[ui];
  const onlyDelivery = isOldStatus((order as any).status);
  const deliveryTime = formatDeliveryTime(order);

  // rows mapped for ItemList; add currency symbol per row
  const currency = pickCurrency((order as any).items ?? []) ?? "₪";
  const rowsBase = toItemRows((order as any).items ?? []);
  const rows = rowsBase.map((r: any) => ({ ...r, currencySymbol: currency }));

  const dest = pickDeliveryPoint(order);

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Grid
        templateColumns={{ base: "1fr", md: "1fr auto 1fr" }}
        gap={3}
        alignItems="center"
      >
        <GridItem minW={0}>
          <HStack gap={2}>
            <Text fontWeight="bold">Delivery time:</Text>
            <Text
              as="span"
              maxW="100%"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              title={deliveryTime}
            >
              {deliveryTime}
            </Text>
          </HStack>
        </GridItem>

        <GridItem justifySelf="center" zIndex={10}>
          <HStack gap={3}>
            <HStack gap={2}>
              <Text
                fontWeight="bold"
                cursor="pointer"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setTimelineOpen((v) => !v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setTimelineOpen((v) => !v);
                  }
                }}
                title="Click to view status timeline"
              >
                Status
              </Text>
              <Text textTransform="capitalize">{statusLabel}</Text>
              <Text as="span" fontSize="xl">
                {emoji}
              </Text>
            </HStack>

            <IconButton
              aria-label="Open map"
              size="sm"
              variant="solid"
              disabled={!dest}
              onClick={(e) => {
                e.stopPropagation();
                if (!dest) return;
                onOpenMap(dest, onlyDelivery);
              }}
            >
              <MapPin size={16} />
            </IconButton>
          </HStack>
        </GridItem>

        <GridItem justifySelf="end">
          <HStack gap={2}>
            {(ui === "delivered" || ui === "received") && (
              <Button onClick={onOpenNote}>Delivery Note</Button>
            )}
            <Button variant="outline" onClick={onToggleOpen}>
              {isOpen ? "Close" : "Full order"}
            </Button>
          </HStack>
        </GridItem>
      </Grid>

      {timelineOpen && (
        <Box mt={3}>
          <OrderTimeline status={(order as any).status} />
        </Box>
      )}

      {isOpen && (
        <VStack align="stretch" mt={3} gap={3}>
          {rows.length ? (
            <ItemList items={rows} />
          ) : (
            <Text color="gray.600">No items attached.</Text>
          )}
        </VStack>
      )}
    </Box>
  );
}
