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
  Code,
  Badge,
  Stack,
  IconButton,
} from "@chakra-ui/react";
import { Copy, Printer, ArrowLeft,Download} from "lucide-react";
import type { OrderRowAPI } from "@/types/orders";
import ItemList from "@/components/common/ItemList";
import { fetchOrders } from "@/api/orders";
import { toItemRows, pickCurrency } from "@/pages/customer/customerOrders/components/helpers";
import TokenQR from "@/components/common/TokenQR";

// Demo token (replace when wired)
const DEMO_TOKEN = "QR-b97ce09d-a4a0-45ca-93cf-5170f73d26c0";

// statuses
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "farmer",
  "in-transit",
  "packing",
  "ready_for_pickUp",
  "out_for_delivery",
  "delivered",
  "received",
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
  delivered: "Delivered",
  received: "Received",
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
  delivered: "📬",
  received: "🏠",
  canceled: "⛔",
  problem: "⚠️",
};
const STATUS_COLOR: Record<UIStatus, string> = {
  pending: "gray",
  confirmed: "blue",
  farmer: "green",
  "in-transit": "purple",
  packing: "orange",
  ready_for_pickUp: "teal",
  out_for_delivery: "cyan",
  delivered: "green",
  received: "green",
  canceled: "red",
  problem: "red",
};

function normalizeStatus(s: string): UIStatus {
  const key = s?.toLowerCase?.().replaceAll(/\s+/g, "_");
  if (ORDER_STATUSES.includes(key as UIStatus)) return key as UIStatus;
  switch (key) {
    case "ready_for_delivery":
    case "ready_for_pickup":
      return "ready_for_pickUp";
    case "received":
    case "recieved":
      return "received";
    case "delivering":
    case "lc_to_customer":
      return "in-transit";
    default:
      return "pending";
  }
}

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso ?? "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

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
  const line = [a.street, a.houseNumber, a.apartment, a.city].filter(Boolean).join(" ");
  const line2 = [a.region, a.state, a.postalCode, a.country].filter(Boolean).join(", ");
  return [line, line2].filter(Boolean).join(", ") || "—";
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
    if (fromState || !id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const items = await fetchOrders(200);
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
    () => (order ? normalizeStatus((order as any).stageKey) : "pending"),
    [order]
  );
  const isInvoice = new Set<UIStatus>(["received", "delivered"]).has(ui);
  const currency = useMemo(
    () => pickCurrency((order as any)?.items ?? []) ?? "$",
    [order]
  );
  const address = useMemo(() => (order ? getAddress(order as any) : "—"), [order]);
  const shiftLabel = useMemo(() => (order ? getShiftLabel(order as any) : "—"), [order]);
  const rows = useMemo(() => {
    const base = toItemRows(((order as any)?.items ?? []) as any[]);
    return base.map((r) => ({ ...r, currencySymbol: currency }));
  }, [order, currency]);

  if (loading) {
    return (
      <Container maxW="4xl" py={10}>
        <HStack justify="center" py={16}>
          <Spinner />
          <Text color="fg.muted">Loading delivery note…</Text>
        </HStack>
      </Container>
    );
  }

  if (!order) {
    return (
      <Container maxW="4xl" py={10}>
        <VStack align="stretch" gap={4}>
          <Heading size="lg">Delivery Note</Heading>
          <Box p={4} borderWidth="1px" borderRadius="lg">
            <Text color="fg.muted">Order not found.</Text>
          </Box>
<Button onClick={() => nav(-1)}>
  <HStack gap={2}>
    <ArrowLeft size={16} />
    <Text>Back</Text>
  </HStack>
</Button>
        </VStack>
      </Container>
    );
  }

  const orderId = (order as any).orderId ?? order.id;
const handleDownload = () => {
  const prev = document.title;
  document.title = `DeliveryNote-${orderId}`;
  window.print();
  // restore title after print
  setTimeout(() => (document.title = prev), 500);
};
  return (
    <Container maxW="4xl" py={8}>
      {/* Page header */}
<HStack justify="space-between" mb={4} className="no-print">
  <HStack>
<Button size="sm" variant="ghost" onClick={() => nav(-1)}>
  <HStack gap={2}>
    <ArrowLeft size={16} />
    <Text>Back</Text>
  </HStack>
</Button>

    <Heading size="lg">Delivery Note</Heading>
  </HStack>

  <HStack gap={2}>
    <IconButton
      aria-label="Download PDF"
      size="sm"
      variant="solid"
      onClick={handleDownload}
    >
      <Download size={16} />
    </IconButton>
    <IconButton
      aria-label="Print"
      size="sm"
      variant="outline"
      onClick={() => window.print()}
    >
      <Printer size={16} />
    </IconButton>
    <IconButton
      aria-label="Copy ID"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(orderId));
        } catch {}
      }}
    >
      <Copy size={16} />
    </IconButton>
  </HStack>
</HStack>

      {/* Top summary */}
      <Box
        borderWidth="1px"
        borderRadius="xl"
        p={4}
        bgGradient="linear(to-r, gray.50, transparent)"
        _dark={{ bgGradient: "linear(to-r, gray.800, transparent)" }}
      >
        <Stack direction={{ base: "column", md: "row" }} gap={4} align="stretch">
          {/* Left: meta */}
          <VStack align="start" flex="1" gap={1}>
            <HStack gap={3} wrap="wrap">
              <Badge colorPalette={STATUS_COLOR[ui] as any} size="md" borderRadius="full" px={3} py={1}>
                <Text as="span" mr={1}>
                  {STATUS_EMOJI[ui]}
                </Text>
                {STATUS_LABEL[ui]}
              </Badge>

              <Badge variant="subtle" borderRadius="full" px={3} py={1}>
                {isInvoice ? "Invoice" : "Order"} #{orderId}
              </Badge>
            </HStack>

            <Text color="fg.muted" mt={2}>
              Created: {fmtDateShort(order.createdAt)}
            </Text>
            <Text color="fg.muted">Address: {address}</Text>
            <Text color="fg.muted">Shift: {shiftLabel}</Text>
          </VStack>

          {/* Right: QR card */}
          <Box
            borderWidth="1px"
            borderRadius="lg"
            p={3}
            w={{ base: "100%", md: "280px" }}
            alignSelf={{ base: "stretch", md: "center" }}
          >
            <Text fontWeight="semibold" fontSize="sm" color="fg.muted" mb={2}>
              Scan to verify
            </Text>
            <VStack>
              <TokenQR token={DEMO_TOKEN} />
              <Text fontSize="xs" color="fg.muted">
                Demo token
              </Text>
            </VStack>
          </Box>
        </Stack>
      </Box>

      <Separator my={5} />

      {/* Items */}
      <Box borderWidth="1px" borderRadius="xl" p={4}>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="semibold">Items</Text>
          <Text color="fg.muted" fontSize="sm">
            Currency: {currency}
          </Text>
        </HStack>
        <ItemList items={rows} />
      </Box>

      {/* Footer help */}
      <VStack align="start" mt={6} color="fg.muted" fontSize="sm">
        <Text>
          Need help? Provide your {isInvoice ? "invoice" : "order"} #{orderId}.
        </Text>
      </VStack>
    </Container>
  );
}
