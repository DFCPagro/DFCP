// src/pages/DeliveryNote.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Separator,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { OrderRowAPI } from "@/types/orders";
import ItemList from "@/components/common/ItemList";
import { fetchOrders } from "@/api/orders";

// reuse the same helpers used by Orders
import { toItemRows, pickCurrency } from "@/pages/customer/customerOrders/components/helpers";


// canonical statuses
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "farmer",
  "in-transit",
  "packing",
  "ready_for_pickUp",
  "out_for_delivery",
  "recived",
  "canceled",
  "problem",
] as const;
type UIStatus = (typeof ORDER_STATUSES)[number];

const STATUS_LABEL: Record<UIStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  farmer: "Farmer",
  "in-transit": "In transit",
  packing: "Packing",
  ready_for_pickUp: "Ready for pick-up",
  out_for_delivery: "Out for delivery",
  recived: "Received",
  canceled: "Canceled",
  problem: "Problem",
};
const STATUS_EMOJI: Record<UIStatus, string> = {
  pending: "⏳",
  confirmed: "👍",
  farmer: "👨‍🌾",
  "in-transit": "🚚",
  packing: "📦",
  ready_for_pickUp: "✅",
  out_for_delivery: "🛵",
  recived: "🏠",
  canceled: "⛔",
  problem: "⚠️",
};

function normalizeStatus(s: string): UIStatus {
  const key = s.toLowerCase().replaceAll(/\s+/g, "_");
  if (ORDER_STATUSES.includes(key as UIStatus)) return key as UIStatus;
  switch (key) {
    case "ready_for_delivery":
    case "ready_for_pickup":
      return "ready_for_pickUp";
    case "delivered":
    case "received":
    case "recieved":
      return "recived";
    case "delivering":
    case "lc_to_customer":
      return "in-transit";
    default:
      return "pending";
  }
}

// formatting
function fmtDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

// address + shift helpers
function getAddress(o: any): string {
  if (typeof o?.deliveryAddress === "string") return o.deliveryAddress;
  if (o?.deliveryAddress?.address) return o.deliveryAddress.address;

  const tryStrings = [
    o?.address?.label,
    o?.shippingAddress?.label,
    o?.addressFull,
    o?.deliveryAddressFull,
    typeof o?.address === "string" ? o.address : null,
    typeof o?.shippingAddress === "string" ? o.shippingAddress : null,
  ].filter(Boolean) as string[];
  if (tryStrings.length) return tryStrings[0]!;

  const a = o?.deliveryAddress ?? o?.address ?? o?.shippingAddress ?? {};
  const line = [a.street, a.houseNumber, a.apartment, a.city]
    .filter(Boolean)
    .join(" ");
  const line2 = [a.region, a.state, a.postalCode, a.country]
    .filter(Boolean)
    .join(", ");
  const built = [line, line2].filter(Boolean).join(", ");
  return built || "—";
}

const SHIFT_NAME: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

function getShiftLabel(o: any): string {
  const s =
    o?.deliverySlot ??
    o?.shiftKey ??
    o?.shift ??
    o?.shiftName ??
    o?.deliveryShift ??
    o?.timeSlot ??
    o?.deliveryTimeWindow ??
    o?.timeWindow;

  if (typeof s === "string") return SHIFT_NAME[s] ?? s;

  const key = s?.key ?? s?.name ?? s?.id;
  const label = s?.label ?? (key ? SHIFT_NAME[key] : undefined);
  const from = s?.from ?? s?.start ?? s?.startTime;
  const to = s?.to ?? s?.end ?? s?.endTime;

  if (label && from && to) return `${label} ${from}-${to}`;
  if (label) return label;
  if (key) return String(key);
  return "—";
}

export default function DeliveryNotePage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { order?: OrderRowAPI } };

  const fromState: OrderRowAPI | null = (loc.state as any)?.order ?? null;

  const [order, setOrder] = useState<OrderRowAPI | null>(fromState);
  const [loading, setLoading] = useState(!fromState);

  useEffect(() => {
    if (fromState) return;
    if (!id) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const items = await fetchOrders(200); // latest, then find by id
        const found =
          items.find((o) => o.id === id) ||
          items.find((o) => (o as any).orderId === id) ||
          null;
        if (mounted) setOrder(found);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, fromState]);

  const ui = useMemo(
    () => (order ? normalizeStatus((order as any).status) : "pending"),
    [order]
  );

  const currency = useMemo(
    () => pickCurrency((order as any)?.items ?? []) ?? "$",
    [order]
  );

  const address = useMemo(() => (order ? getAddress(order as any) : "—"), [order]);
  const shiftLabel = useMemo(() => (order ? getShiftLabel(order as any) : "—"), [order]);

  // prepare rows for ItemList v2 (and inject currency symbol)
  const rows = useMemo(() => {
    const base = toItemRows(((order as any)?.items ?? []) as any[]);
    return base.map((r) => ({ ...r, currencySymbol: currency }));
  }, [order, currency]);

  if (loading) {
    return (
      <Container maxW="3xl" py={8}>
        <HStack justify="center" py={12}>
          <Spinner />
        </HStack>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxW="3xl" py={8}>
        <VStack align="stretch" gap={3}>
          <Heading size="lg">Delivery Note</Heading>
          <Text color="gray.600">Order not found.</Text>
          <Button onClick={() => nav(-1)}>Back</Button>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="3xl" py={8}>
      <HStack justify="space-between" mb={4}>
        <Heading size="lg">Delivery Note</Heading>
        <Button variant="outline" onClick={() => nav(-1)}>
          Back
        </Button>
      </HStack>

      <Box borderWidth="1px" borderRadius="md" p={4}>
        <HStack justify="space-between" mb={2}>
          <Text>Order: {(order as any).orderId ?? order.id}</Text>
          <HStack>
            <Text as="span" fontSize="xl">{STATUS_EMOJI[ui]}</Text>
            <Text>{STATUS_LABEL[ui]}</Text>
          </HStack>
        </HStack>

        <VStack align="start" gap={1} mb={2}>
          <Text color="gray.600">Created: {fmtDateShort(order.createdAt)}</Text>
          <Text color="gray.600">Address: {address}</Text>
          <Text color="gray.600">Shift: {shiftLabel}</Text>
        </VStack>

        <Separator my={3} />

        <ItemList items={rows} />
      </Box>
    </Container>
  );
}
