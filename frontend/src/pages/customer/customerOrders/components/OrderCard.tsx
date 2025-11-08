"use client";

import { useEffect, useState } from "react";
import {
  Box, Grid, GridItem, HStack, IconButton, Text, Button, VStack, Badge,
} from "@chakra-ui/react";
import { MapPin, CircleX } from "lucide-react";
import ItemList from "@/components/common/ItemList";
import type { OrderRowAPI } from "@/types/orders";
import OrderTimeline from "./OrderTimeline";
import RouteLocationDialog, { type PointValue, type TravelMode } from "@/components/common/RouteLocationPicker";
import {
  STATUS_EMOJI, STATUS_LABEL, formatDeliveryTimeParts, normalizeStatus,
  pickCurrency, pickDeliveryPoint, toItemRows, isOldStatus, type LatLng,
} from "./helpers";
import StyledIconButton from "@/components/ui/IconButton";
import { Portal } from "@chakra-ui/react";

type Props = {
  order?: OrderRowAPI | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenMap: (pt: LatLng, onlyDelivery?: boolean) => void;
  onOpenNote: () => void;
};

const toPoint = (p: LatLng | PointValue, fallbackAddress = ""): PointValue =>
  "address" in p ? p : { ...p, address: fallbackAddress };

export default function OrderCard({
  order, isOpen, onToggleOpen, onOpenNote,
}: Props) {
  if (!order) return null;

  const onlyDelivery = isOldStatus((order as any).stageKey);
  const [timelineOpen, setTimelineOpen] = useState(!onlyDelivery);

  // Map dialogs state
  const [openPointView, setOpenPointView] = useState(false);
  const [openRouteView, setOpenRouteView] = useState(false);

  useEffect(() => {
    setTimelineOpen(!onlyDelivery);
  }, [onlyDelivery, order?.id]);

  const ui = normalizeStatus((order as any).stageKey);
  const emoji = STATUS_EMOJI[ui];
  const statusLabel = STATUS_LABEL[ui];
const SHOW_NOTE_STATES = new Set([
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
  "received",           // keep existing behavior
]);
const isNoteState = SHOW_NOTE_STATES.has(ui);
const isReceived = new Set(["received", "delivered"]).has(ui);
// utils (local to file is fine)
const fallbackAddressFrom = (o: OrderRowAPI): string => {
  const anyO = o as any;
  if (anyO?.deliveryAddress?.address) return anyO.deliveryAddress.address;
  if (typeof anyO?.address === "string") return anyO.address;
  if (anyO?.dropoff?.address) return anyO.dropoff.address;
  return "";
};

// …


  const { date: deliveryDate, shift: deliveryShift } = formatDeliveryTimeParts(order);

  // Order created datetime
  const orderTime = order.createdAt ? (formatDeliveryTimeParts(order).date)+" " +new Date(order.createdAt).toLocaleTimeString([], {  hour: "2-digit", minute: "2-digit" }) : "";


  const currency = pickCurrency((order as any).items ?? []) ?? "$";
  const rows = toItemRows((order as any).items ?? []).map((r: any) => ({ ...r, currencySymbol: currency }));

const destLatLng = pickDeliveryPoint(order);
const destPoint = destLatLng ? toPoint(destLatLng, fallbackAddressFrom(order)) : null;
  const homePoint: PointValue = {
    lat: 32.0853,
    lng: 34.7818,
    address: "Tel Aviv-Yafo, Israel",
  };

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Grid templateColumns={{ base: "1fr", md: "1fr auto 1fr" }} gap={3} alignItems="center">
        <GridItem minW={0}>
          <VStack align="start" gap={1}>
            <HStack gap={2} maxW="100%">
              <Text as="span" fontWeight="bold">Order time:</Text>
              <Text as="span" maxW="70%" overflow="hidden" textOverflow="clip" whiteSpace="nowrap" title={orderTime}>
                {orderTime}
              </Text>
            </HStack>

            <HStack gap={2} maxW="100%">
              <Text as="span" fontWeight="bold">Expected delivery:</Text>
              <HStack as="span" maxW="70%" overflow="hidden" whiteSpace="nowrap"
                title={`${deliveryDate}${deliveryShift ? ` ${deliveryShift}` : ""}`} gap={2}>
                <Text as="span">{deliveryDate}</Text>
                {!!deliveryShift && (
                  <Badge as="span" variant="subtle" borderRadius="md" px="2" py="0.5" backgroundColor="pink">
                    {deliveryShift}
                  </Badge>
                )}
              </HStack>
            </HStack>
          </VStack>
        </GridItem>

        <GridItem justifySelf="center" zIndex={10}>
          <HStack gap={3}>
            <HStack gap={2}>
              <Text
                fontWeight="bold"
                cursor="pointer"
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setTimelineOpen(v => !v); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTimelineOpen(v => !v); }
                }}
                title="Click to view status timeline"
              >
                Status
              </Text>
              <Text textTransform="capitalize">{statusLabel}</Text>
              <Text as="span" fontSize="xl">{emoji}</Text>
            </HStack>

            <IconButton
              aria-label="Open map"
              size="sm"
              variant="solid"
              // enable even when no dest: show single-point view
              onClick={(e) => {
                e.stopPropagation();
                if (destPoint) setOpenRouteView(true);
                else setOpenPointView(true);
              }}
            >
              <MapPin size={16} />
            </IconButton>
          </HStack>
        </GridItem>
<GridItem justifySelf="end">
  <HStack gap={2}>
    {isNoteState && (
      <Button
        onClick={onOpenNote}
        aria-label={isReceived ? "Open invoice" : "Open delivery note"}
      >
        {isReceived ? "Invoice" : "Delivery Note"}
      </Button>
    )}

    {isOpen ? (
      <StyledIconButton aria-label="Close" variant="outline" onClick={onToggleOpen}>
        <CircleX size={16} />
      </StyledIconButton>
    ) : (
      <Button variant="outline" onClick={onToggleOpen}>Full order</Button>
    )}
  </HStack>
</GridItem>

      </Grid>

      {timelineOpen && (
        <Box mt={3}>
          <OrderTimeline stageKey={(order as any).stageKey} />
        </Box>
      )}

      {isOpen && (
        <VStack align="stretch" mt={3} gap={3}>
          {rows.length ? <ItemList items={rows} /> : <Text color="gray.600">No items attached.</Text>}
        </VStack>
      )}

      {/* View-only dialogs rendered outside the button */}

<Portal  >
  <RouteLocationDialog
    open={openPointView}
    onClose={() => setOpenPointView(false)}
    mode="point"
    viewMode="view"
    countries="IL"
    initialPoint={homePoint}
    markerLabels={{ point: "H" }}
    markerTitles={{ point: "Home" }}
  />
</Portal>

<Portal>
  <RouteLocationDialog
    open={openRouteView}
    onClose={() => setOpenRouteView(false)}
    mode="route"
    viewMode="view"
    countries="IL"
    initialTravelMode="DRIVING"
    initialOrigin={homePoint}
    initialDestination={destPoint ?? homePoint}
    markerLabels={{ origin: "H", destination: "LG" }}
    markerTitles={{ origin: "Home", destination: "Logistics Hub" }}
  />
</Portal>
    </Box>
  );
}
