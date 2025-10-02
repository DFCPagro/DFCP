// src/pages/DeliveryNote.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
import LocationMapModal from "@/components/feature/orders/LocationMapModal";

// types
type UIStatus =
  | "pending"
  | "accepted"
  | "farmer"
  | "farm_to_lc"
  | "logistic_center"
  | "packed"
  | "ready_for_delivery"
  | "lc_to_customer"
  | "delivered"
  | "confirm_receiving";

type LatLng = { lat: number; lng: number };

// LC
const LOGISTIC_CENTER: LatLng = { lat: 32.733459, lng: 35.218805 };

// status helpers
const STATUS_LABEL: Record<UIStatus, string> = {
  pending: "pending",
  accepted: "accepted",
  farmer: "farmer",
  farm_to_lc: "from farmer to logistic center",
  logistic_center: "logistic center",
  packed: "packed",
  ready_for_delivery: "ready for delivery",
  lc_to_customer: "delivering",
  delivered: "delivered",
  confirm_receiving: "confirm receiving",
};
const STATUS_EMOJI: Record<UIStatus, string> = {
  pending: "⏳",
  accepted: "👍",
  farmer: "👨‍🌾",
  farm_to_lc: "🚚",
  logistic_center: "🏬",
  packed: "📦",
  ready_for_delivery: "✅",
  lc_to_customer: "🛵",
  delivered: "🏠",
  confirm_receiving: "🧾",
};
function normalizeStatus(s: string): UIStatus {
  const key = s.toLowerCase().replaceAll(/\s+/g, "_");
  switch (key) {
    case "created":
      return "pending";
    case "out_for_delivery":
      return "lc_to_customer";
    case "confirmed":
      return "confirm_receiving";
    case "accepted":
      return "accepted";
    case "farmer":
      return "farmer";
    case "form_framer_to_the_logistic_center":
    case "from_farmer_to_the_logistic_center":
    case "farm_to_lc":
      return "farm_to_lc";
    case "logistic_center":
      return "logistic_center";
    case "packed":
      return "packed";
    case "ready_for_delivery":
      return "ready_for_delivery";
    case "from_the_logistic_to_the_costmer":
    case "from_the_logistic_to_the_customer":
    case "lc_to_customer":
    case "delivering":
      return "lc_to_customer";
    case "delivered":
      return "delivered";
    case "confirm_reciveing":
    case "confirm_receiving":
      return "confirm_receiving";
    default:
      return "pending";
  }
}
function isOldStatus(s: any) {
  const ui = normalizeStatus(String(s));
  return ui === "delivered" || ui === "confirm_receiving";
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

// coords helpers
function asNum(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : undefined;
}
function arrToLatLng(a: any): LatLng | null {
  if (!Array.isArray(a) || a.length < 2) return null;
  const a0 = Number(a[0]),
    a1 = Number(a[1]);
  if (!Number.isFinite(a0) || !Number.isFinite(a1)) return null;
  const looksLatLng = Math.abs(a0) <= 90 && Math.abs(a1) <= 180;
  const lat = looksLatLng ? a0 : a1;
  const lng = looksLatLng ? a1 : a0;
  return { lat, lng };
}
function pick(obj: any, ...paths: string[]) {
  for (const p of paths) {
    const v = p.split(".").reduce((x, k) => x?.[k], obj);
    if (v != null) return v;
  }
  return undefined;
}
function getDeliveryCoord(o: any): LatLng | null {
  const c =
    pick(
      o,
      "delivery",
      "delivery.location",
      "delivery.geo",
      "shippingAddress",
      "shippingAddress.location",
      "shippingAddress.geo",
      "customer.location",
      "customer.address.geo",
      "location",
      "geo"
    ) ?? null;

  const fromArr =
    arrToLatLng((c as any)?.coordinates) ??
    arrToLatLng((c as any)?.coords) ??
    arrToLatLng(c);
  if (fromArr) return fromArr;

  const lat = asNum((c as any)?.lat ?? (c as any)?.latitude ?? (c as any)?.y);
  const lng = asNum(
    (c as any)?.lng ??
      (c as any)?.lon ??
      (c as any)?.long ??
      (c as any)?.longitude ??
      (c as any)?.x
  );
  if (lat != null && lng != null) return { lat, lng };

  const lat2 = asNum(o?.destLat);
  const lng2 = asNum(o?.destLng);
  return lat2 != null && lng2 != null ? { lat: lat2, lng: lng2 } : null;
}
function mockPointFor(id: string): LatLng {
  const seed =
    id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 1000;
  const dLat = ((seed % 80) - 40) / 1000;
  const dLng = (((seed / 10) | 0) % 80 - 40) / 1000;
  return {
    lat: LOGISTIC_CENTER.lat + 0.12 + dLat,
    lng: LOGISTIC_CENTER.lng + 0.18 + dLng,
  };
}
function pickDeliveryPoint(o: OrderRowAPI): LatLng {
  return getDeliveryCoord(o as any) ?? mockPointFor(o.id);
}

// page
export default function DeliveryNotePage() {
  const { orderKey } = useParams<{ orderKey: string }>();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { order?: OrderRowAPI } };

  const fromState: OrderRowAPI | null = (loc.state as any)?.order ?? null;

  const [order, setOrder] = useState<OrderRowAPI | null>(fromState);
  const [loading, setLoading] = useState(!fromState);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    if (fromState) return;
    if (!orderKey) return;

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // naive lookup via list
        const data = await fetchOrders(1, 200);
        const items: OrderRowAPI[] = Array.isArray((data as any)?.items)
          ? (data as any).items
          : [];
        const found =
          items.find((o) => o.id === orderKey) ||
          items.find((o) => (o as any).orderId === orderKey) ||
          null;
        if (mounted) setOrder(found);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [orderKey, fromState]);

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

  const point = pickDeliveryPoint(order);

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

        <HStack gap={2} mb={3}>
          <Button size="sm" onClick={() => setMapOpen(true)}>
            View map
          </Button>
        </HStack>

        <Separator my={3} />

        <ItemList items={toItemRows((order as any).items ?? [])} currency={currency} />
      </Box>

      <LocationMapModal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        point={point}
        onlyDelivery={isOldStatus((order as any).status)}
      />
    </Container>
  );
}
