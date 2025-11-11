/** @jsxImportSource @emotion/react */
import { memo, useEffect, useMemo, useState } from "react";
import {
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  Button,
  Card,
  Separator,
  Portal,
  Tooltip,
} from "@chakra-ui/react";
import { MapPin, NotebookPen, OctagonAlert, List } from "lucide-react";
import type { OrderRowAPI } from "@/types/orders";
import {
  getEffectiveUIStatus,
  normalizeStatus,
  STATUS_LABEL,
  isOldStatus,
  pickDeliveryPoint,
  toItemRows,
  pickCurrency,
  formatDeliveryTimeParts,
} from "./helpers";
import OrderTimeline from "./OrderTimeline";
import ReportIssueDialog from "./ReportIssueDialog";
import ItemList from "@/components/common/ItemList";

type Props = {
  order: any;
  isOpen: boolean | null; // controls ItemList visibility
  onToggleOpen: () => void; // toggles ItemList
  onOpenMap: (point?: { lat: number; lng: number; address?: string }) => void;
  onOpenNote: () => void;
  onReportSubmit: (order: OrderRowAPI, payload: { subject: string; details: string }) => Promise<void> | void;
  /** if true, the status timeline is open by default */
  defaultTimelineOpen?: boolean;
};

function statusToPalette(statusRaw: string): string {
  const k = String(normalizeStatus(statusRaw));
  switch (k) {
    case "pending":
    case "confirmed":
    case "farmer":
      return "purple";
    case "intransit":
    case "out_for_delivery":
      return "cyan";
    case "packing":
    case "ready_for_pickup":
      return "teal";
    case "delivered":
    case "received":
      return "green";
    case "cancelled":
      return "gray";
    case "problem":
      return "red";
    default:
      return "gray";
  }
}

function labelForStatus(s: string): string {
  const k = String(normalizeStatus(s));
  const m = (STATUS_LABEL as any) ?? {};
  return m[k] ?? k.replace(/[_-]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function canShowNote(stageKey: string): boolean {
  const k = String(normalizeStatus(stageKey));
  return k === "ready_for_pickup" || k === "out_for_delivery" || k === "delivered";
}

function OrderCardBase({
  order,
  isOpen,
  onToggleOpen,
  onOpenMap,
  onOpenNote,
  onReportSubmit,
  defaultTimelineOpen = false,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState<boolean>(defaultTimelineOpen); // toggled by clicking the status badge

  // If parent changes the default after mount (e.g., list moves sections), sync once.
  useEffect(() => {
    setShowTimeline(defaultTimelineOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTimelineOpen]);

  const id = (order as any).id ?? (order as any).orderId ?? "—";
  const createdAt = (order as any).createdAt ? new Date((order as any).createdAt) : null;
  const customer = (order as any).customer ?? (order as any).user ?? {};
  const customerName =
    customer?.name ||
    customer?.fullName ||
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() ||
    "Customer";

  const items: any[] = Array.isArray((order as any).items) ? (order as any).items : [];
  const itemRows = useMemo(() => toItemRows(items), [items]);
  const currency = useMemo(() => pickCurrency(items) ?? "USD", [items]);

  const total =
    (order as any).total ??
    (order as any).amount ??
    (order as any).price ??
    (order as any).totalPrice ??
    null;
  const itemsCount = itemRows.length;

  const effectiveStatus: string = getEffectiveUIStatus(order);
  const palette = statusToPalette(effectiveStatus);
  const isDone = isOldStatus(effectiveStatus);
  const isProblem = effectiveStatus === "problem";
  const isDelivered = normalizeStatus(effectiveStatus) === "delivered";

  // Delivery time parts (date + shift)
  const { date: deliveryDateStr, shift: deliveryShift } = formatDeliveryTimeParts(order);

  const destinationPoint = useMemo(() => {
    const p = pickDeliveryPoint(order);
    if (!p) return undefined;
    const addrAny: any = (order as any).deliveryAddress;
    const address =
      (typeof addrAny === "string" && addrAny) ||
      addrAny?.address ||
      addrAny?.label ||
      `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    return { ...p, address };
  }, [order]);

  return (
    <>
      <Card.Root
        borderRadius="xl"
        overflow="hidden"
        _hover={{ transform: "translateY(-1px)" }}
        transition="transform 120ms"
        role="button"
        tabIndex={0}
        onClick={onToggleOpen} // click anywhere on card toggles ItemList
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleOpen();
          }
        }}
      >
        {/* Header */}
        <Card.Header px={4} py={3}>
          <HStack w="full" align="center" justify="space-between">
            {/* Left info area (root handles click) */}
            <VStack align="start" gap={1} minW={0}>
              <HStack gap={2} minW={0}>
                <Text
                  fontWeight="semibold"
                  maxW="240px"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  Order #{id}
                </Text>

                {/* Status badge toggles Timeline only */}
                <Badge
                  colorPalette={palette}
                  variant="solid"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation(); // prevent ItemList toggle
                    setShowTimeline((v) => !v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowTimeline((v) => !v);
                    }
                  }}
                  cursor="pointer"
                >
                  {labelForStatus(effectiveStatus)}
                </Badge>

                {isDone ? <Badge colorPalette="gray" variant="subtle">Archived</Badge> : null}
              </HStack>

              <HStack gap={3} fontSize="sm" color="fg.muted" wrap="wrap" minW={0}>
                <Text
                  maxW="200px"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  title={customerName}
                >
                  {customerName}
                </Text>

                {createdAt ? (
                  <>
                    <Separator orientation="vertical" />
                    <Text title={createdAt.toLocaleString()}>{createdAt.toLocaleDateString()}</Text>
                  </>
                ) : null}

                {typeof itemsCount === "number" ? (
                  <>
                    <Separator orientation="vertical" />
                    <Text>{itemsCount} items</Text>
                  </>
                ) : null}

                {typeof total === "number" ? (
                  <>
                    <Separator orientation="vertical" />
                    <Text fontWeight="medium">
                      {Number(total).toLocaleString(undefined, { style: "currency", currency })}
                    </Text>
                  </>
                ) : null}

                {/* Delivery date + shift */}
                <>
                  <Separator orientation="vertical" />
                  <Text title={`Delivery ${deliveryDateStr}${deliveryShift ? ` • ${deliveryShift}` : ""}`}>
                    Delivery {deliveryDateStr}
                    {deliveryShift ? ` • ${deliveryShift}` : ""}
                  </Text>
                </>

                {/* Always show destination address while card is closed (and open) */}
                {destinationPoint?.address ? (
                  <>
                    <Separator orientation="vertical" />
                    <HStack gap={1} minW={0}>
                      <MapPin size={14} />
                      <Text
                        maxW={{ base: "180px", md: "260px" }}
                        overflow="hidden"
                        textOverflow="ellipsis"
                        whiteSpace="nowrap"
                        title={destinationPoint.address}
                      >
                        {destinationPoint.address}
                      </Text>
                    </HStack>
                  </>
                ) : null}
              </HStack>
            </VStack>

            {/* Right-side controls — stop propagation so card doesn't toggle */}
            <HStack gap={2} flexShrink={0}>
              {/* Hide Report + Map when order is reported */}
              {!isProblem && (
                <>
                  <Tooltip.Root openDelay={200}>
                    <Tooltip.Trigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        colorPalette="red"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportOpen(true);
                        }}
                      >
                        <OctagonAlert size={16} style={{ marginRight: 6 }} />
                        Report issue
                      </Button>
                    </Tooltip.Trigger>
                    <Portal>
                      <Tooltip.Positioner>
                        <Tooltip.Content>Report a problem with this order</Tooltip.Content>
                      </Tooltip.Positioner>
                    </Portal>
                  </Tooltip.Root>

                  <Tooltip.Root openDelay={200}>
                    <Tooltip.Trigger asChild>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMap(destinationPoint);
                        }}
                        variant="solid"
                        colorPalette="teal"
                      >
                        <MapPin size={16} style={{ marginRight: 6 }} />
                        Map
                      </Button>
                    </Tooltip.Trigger>
                    <Portal>
                      <Tooltip.Positioner>
                        <Tooltip.Content>{destinationPoint?.address ?? "Open map"}</Tooltip.Content>
                      </Tooltip.Positioner>
                    </Portal>
                  </Tooltip.Root>
                </>
              )}

              {/* Note/Invoice only for select stages */}
              {canShowNote(effectiveStatus) && (
                <Tooltip.Root openDelay={200}>
                  <Tooltip.Trigger asChild>
                    <Button
                      size="sm"
                      variant="solid"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenNote();
                      }}
                    >
                      <NotebookPen size={16} style={{ marginRight: 6 }} />
                      {isDelivered ? "Invoice" : "Delivery note"}
                    </Button>
                  </Tooltip.Trigger>
                  <Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Content>{isDelivered ? "View invoice" : "View delivery note"}</Tooltip.Content>
                    </Tooltip.Positioner>
                  </Portal>
                </Tooltip.Root>
              )}
            </HStack>
          </HStack>
        </Card.Header>

        {/* Timeline toggled by status badge */}
        {showTimeline && (
          <>
            <Separator />
            <Card.Body px={4} py={3}>
              <OrderTimeline stageKey={effectiveStatus} />
            </Card.Body>
          </>
        )}

        {/* Items list toggled by clicking the card (any non-button area) */}
        {Boolean(isOpen) && (
          <>
            <Separator />
            <Card.Body px={4} py={3}>
              <HStack gap={2} mb={2}>
                <List size={16} />
                <Text fontWeight="semibold">Items</Text>
                <Badge colorPalette="gray">{itemRows.length}</Badge>
              </HStack>
              <ItemList items={itemRows} />
            </Card.Body>
          </>
        )}

        {Boolean(isOpen) && (
          <>
            <Separator />
            <Card.Footer px={4} py={3}>
              <Box w="full">
                <HStack wrap="wrap" gap={3} fontSize="sm">
                  {"paymentMethod" in (order as any) ? (
                    <Badge colorPalette="gray" variant="surface">
                      Payment: {(order as any).paymentMethod}
                    </Badge>
                  ) : null}
                  {"shippingMethod" in (order as any) ? (
                    <Badge colorPalette="gray" variant="surface">
                      Shipping: {(order as any).shippingMethod}
                    </Badge>
                  ) : null}
                  {"priority" in (order as any) ? (
                    <Badge colorPalette="orange" variant="surface">
                      Priority: {(order as any).priority}
                    </Badge>
                  ) : null}
                </HStack>
              </Box>
            </Card.Footer>
          </>
        )}
      </Card.Root>

      {/* Report dialog */}
      <ReportIssueDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        orderId={id}
        onSubmit={async ({ subject, details }) => {
          await onReportSubmit(order as OrderRowAPI, { subject, details });
          setReportOpen(false);
        }}
      />
    </>
  );
}

export default memo(OrderCardBase);
