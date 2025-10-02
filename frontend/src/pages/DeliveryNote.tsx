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
import ItemList, { type ItemRow } from "@/components/common/ItemList";
import { fetchOrders } from "@/api/orders";

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
function toItemRows(items: any[]): ItemRow[] {
  return (items ?? []).map((it: any, idx: number): ItemRow => ({
    id: it.id ?? it.productId ?? String(idx),
    name: it.name ?? it.displayName ?? it.productName ?? it.productId ?? "item",
    farmer: it.farmerName ?? it.farmer ?? "—",
    imageUrl: it.imageUrl ?? it.image ?? undefined,
    qty: Number(it.quantity ?? it.qty ?? 0),
    unitLabel: it.unit ?? it.unitLabel ?? "unit",
    unitPrice: Number(it.unitPrice ?? it.pricePerUnit ?? it.price ?? 0),
    currency: it.currency ?? undefined,
  }));
}
function pickCurrency(items: any[]): string | undefined {
  for (const it of items ?? []) if (it?.currency) return it.currency;
  return undefined;
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

        <Text color="gray.600" mb={2}>
          Created: {fmtDateShort(order.createdAt)}
        </Text>

        <Separator my={3} />

        <ItemList
          items={toItemRows((order as any).items ?? [])}
          currency={currency}
        />
      </Box>
    </Container>
  );
}
