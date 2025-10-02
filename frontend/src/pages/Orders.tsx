// src/pages/Orders.tsx
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Container,
  Heading,
  HStack,
  VStack,
  Box,
  Text,
  Button,
  Spinner,
  Alert,
  Field,
  Grid,
  GridItem,
  Input,
  IconButton,
} from "@chakra-ui/react";
import { MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AuthGuard from "@/guards/AuthGuard";
import CartIconButton from "@/components/common/CartIconButton";
import { fetchOrders } from "@/api/orders";
import type { OrderRowAPI } from "@/types/orders";
import ItemList, { type ItemRow } from "@/components/common/ItemList";
import LocationMapModal from "@/components/feature/orders/LocationMapModal";
import { MOCK_ORDERS } from "@/data/orders";

// ---------- canonical statuses ----------
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
type DateFilter = "ALL" | "WEEK" | "MONTH" | "CUSTOM";
type LatLng = { lat: number; lng: number };

// LC for map route drawing
const LOGISTIC_CENTER: LatLng = { lat: 32.733459, lng: 35.218805 };

function isOldStatus(s: any) {
  const ui = normalizeStatus(String(s));
  return ui === "recived" || ui === "canceled";
}
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
const STATUS_OPTIONS: Array<"ALL" | UIStatus> = ["ALL", ...ORDER_STATUSES];

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
    case "farm_to_lc":
    case "intransit":
      return "in-transit";
    case "issue":
    case "reported":
      return "problem";
    default:
      return "pending";
  }
}

// ---------- date + delivery time ----------
function fmt2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtDateYY(d: Date) {
  return `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
}
function fmtHM(d: Date) {
  return `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}`;
}
function toDate(v?: string | number | Date) {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.valueOf()) ? undefined : d;
}
function normHM(v?: string) {
  if (!v) return undefined;
  if (v.includes("T")) {
    const d = toDate(v);
    return d ? fmtHM(d) : undefined;
  }
  const m = v.match(/(\d{1,2}):(\d{2})/);
  return m ? `${fmt2(+m[1])}:${m[2]}` : undefined;
}
function formatDeliveryTime(o: any) {
  const d =
    toDate(o.acceptedAt) ??
    toDate(o.deliveryDate) ??
    toDate(o.scheduledAt) ??
    toDate(o.createdAt) ??
    new Date();
  const s =
    normHM(o.acceptedWindowStart) ??
    normHM(o.deliveryWindowStart) ??
    normHM(o.windowStart);
  const e =
    normHM(o.acceptedWindowEnd) ??
    normHM(o.deliveryWindowEnd) ??
    normHM(o.windowEnd);
  let range = s && e ? `${s}–${e}` : "";
  if (!range) {
    const m = String(o.acceptedSlotLabel ?? o.deliverySlot ?? "").match(
      /(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/
    );
    if (m) {
      const [h1, m1] = m[1].split(":");
      const [h2, m2] = m[2].split(":");
      range = `${fmt2(+h1)}:${m1}–${fmt2(+h2)}:${m2}`;
    }
  }
  if (!range) range = "00:00–00:00";
  return `${fmtDateYY(d)} ${range}`;
}

// ---------- items ----------
function toItemRows(items: any[]): ItemRow[] {
  return (items ?? []).map(
    (it: any, idx: number): ItemRow => ({
      id: it.id ?? it.productId ?? String(idx),
      name: it.name ?? it.displayName ?? it.productName ?? it.productId ?? "item",
      farmer: it.farmerName ?? it.farmer ?? "—",
      imageUrl: it.imageUrl ?? it.image ?? undefined,
      qty: Number(it.quantity ?? it.qty ?? 0),
      unitLabel: it.unit ?? it.unitLabel ?? "unit",
      unitPrice: Number(it.unitPrice ?? it.pricePerUnit ?? it.price ?? 0),
      currency: it.currency ?? undefined,
    })
  );
}
function pickCurrency(items: any[]): string | undefined {
  for (const it of items ?? []) if (it?.currency) return it.currency;
  return undefined;
}

// ---------- coords helpers ----------
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
  const seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 1000;
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

// reported => map to "problem"
function isReported(o: any) {
  const ui = normalizeStatus((o as any)?.status ?? "");
  return ui === "problem";
}

// ---------- page ----------
export default function OrdersPage() {
  const nav = useNavigate();

  const [orders, setOrders] = useState<OrderRowAPI[]>([]);
  const [loading, setLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"ALL" | UIStatus>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // map modal
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPoint, setMapPoint] = useState<LatLng | null>(null);
  const [onlyDelivery, setOnlyDelivery] = useState(false);

  // section toggles
  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllOld, setShowAllOld] = useState(false);
  const [showAllReported, setShowAllReported] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const items = await fetchOrders(50); // GET /orders/my?limit=50
        if (!mounted) return;
        setOrders(items);
      } catch {
        if (!mounted) return;
        setOrders(MOCK_ORDERS as unknown as OrderRowAPI[]);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function startOfWeek(d: Date) {
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    s.setDate(s.getDate() - diff);
    return s;
  }
  function startOfMonth(d: Date) {
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    s.setHours(0, 0, 0, 0);
    return s;
  }
  function toEndOfDay(d: Date) {
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
  }

  const filtered = useMemo(() => {
    const base = orders ?? [];
    const byStatus =
      statusFilter === "ALL"
        ? base
        : base.filter((o) => normalizeStatus((o as any).status) === statusFilter);

    if (dateFilter === "ALL") return byStatus;

    const now = new Date();
    let from: Date;
    let to: Date = now;

    if (dateFilter === "WEEK") from = startOfWeek(now);
    else if (dateFilter === "MONTH") from = startOfMonth(now);
    else {
      if (!customFrom && !customTo) return byStatus;
      from = customFrom ? new Date(customFrom) : new Date(0);
      to = customTo ? toEndOfDay(new Date(customTo)) : now;
    }

    const fromTs = from.getTime();
    const toTs = to.getTime();

    return byStatus.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return Number.isFinite(t) && t >= fromTs && t <= toTs;
    });
  }, [orders, statusFilter, dateFilter, customFrom, customTo]);

  const activeOrders = useMemo(
    () =>
      (filtered ?? []).filter((o) => {
        const ui = normalizeStatus((o as any).status);
        return !isReported(o) && ui !== "recived" && ui !== "canceled";
      }),
    [filtered]
  );
  const oldOrders = useMemo(
    () =>
      (filtered ?? []).filter((o) => {
        const ui = normalizeStatus((o as any).status);
        return !isReported(o) && (ui === "recived" || ui === "canceled");
      }),
    [filtered]
  );
  const reportedOrders = useMemo(
    () => (filtered ?? []).filter((o) => isReported(o)),
    [filtered]
  );

  function OrderCard(o: OrderRowAPI) {
    const ui = normalizeStatus((o as any).status);
    const emoji = STATUS_EMOJI[ui];
       const statusLabel = STATUS_LABEL[ui];
    const showNote = ui === "recived" || ui === "canceled";
    const deliveryTime = formatDeliveryTime(o);
    const rows = toItemRows((o as any).items ?? []);
    const currency = pickCurrency((o as any).items ?? []) ?? "$";
    const isOpen = expandedId === o.id;

    return (
      <Box key={o.id} borderWidth="1px" borderRadius="md" p={4}>
        <Grid templateColumns={{ base: "1fr", md: "1fr auto 1fr" }} w="100%" alignItems="center" gap={3}>
          <GridItem minW={0}>
            <HStack gap={2}>
              <Text fontWeight="bold">Delivery time:</Text>
              <Text as="span" maxW="100%" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                {deliveryTime}
              </Text>
            </HStack>
          </GridItem>

          <GridItem justifySelf="center" zIndex={10}>
            <HStack gap={3}>
              <HStack gap={2}>
                <Text fontWeight="bold">Status:</Text>
                <Text>{statusLabel}</Text>
                <Text as="span" fontSize="xl">{emoji}</Text>
              </HStack>

              <IconButton
                aria-label="Open map"
                size="sm"
                variant="solid"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const pt = pickDeliveryPoint(o);
                  setOnlyDelivery(isOldStatus((o as any).status));
                  setMapPoint(pt);
                  setMapOpen(true);
                }}
              >
                <MapPin size={16} />
              </IconButton>
            </HStack>
          </GridItem>

          <GridItem justifySelf="end">
            <HStack gap={2}>
              {showNote && (
                <Button onClick={() => nav(`/orders/${o.id}/note`)}>
                  Delivery Note
                </Button>
              )}
              <Button variant="outline" onClick={() => setExpandedId(isOpen ? null : o.id)}>
                {isOpen ? "Close" : "Full order"}
              </Button>
            </HStack>
          </GridItem>
        </Grid>

        {isOpen && (
          <Box mt={3} borderWidth="1px" borderRadius="md" p={3}>
            {rows.length ? <ItemList items={rows} currency={currency} /> : <Text color="gray.600">No items attached.</Text>}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        <HStack gap={3} mb={4} align="center">
          <Heading size="lg">My Orders</Heading>
          <span style={{ flex: 1 }} />
          <CartIconButton />
        </HStack>

        {/* Filters */}
        <HStack gap={3} align="end" mb={6} style={{ flexWrap: "wrap" }}>
          <Field.Root>
            <Field.Label htmlFor="status-filter">Status</Field.Label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
                minWidth: 220,
                background: "var(--chakra-colors-white, #fff)",
              }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All" : STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field.Root>

          <Field.Root>
            <Field.Label htmlFor="date-filter">Date</Field.Label>
            <select
              id="date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
                minWidth: 180,
                background: "var(--chakra-colors-white, #fff)",
              }}
            >
              <option value="ALL">All Orders</option>
              <option value="WEEK">This Week</option>
              <option value="MONTH">This Month</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </Field.Root>

          {dateFilter === "CUSTOM" && (
            <HStack gap={2} align="end">
              <Field.Root>
                <Field.Label htmlFor="from">From</Field.Label>
                <Input id="from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </Field.Root>
              <Field.Root>
                <Field.Label htmlFor="to">To</Field.Label>
                <Input id="to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </Field.Root>
              <Button variant="outline" onClick={() => { setCustomFrom(""); setCustomTo(""); }}>
                Clear
              </Button>
            </HStack>
          )}
        </HStack>

        {loading && (orders ?? []).length === 0 ? (
          <HStack justifyContent="center" py={12}><Spinner /></HStack>
        ) : (filtered ?? []).length === 0 ? (
          <Alert.Root status="info" borderRadius="md">
            <Alert.Indicator />
            <Alert.Description>No orders found.</Alert.Description>
          </Alert.Root>
        ) : (
          <>
            <Section
              title="Active orders"
              emptyText="No active orders."
              items={activeOrders}
              showAll={showAllActive}
              onToggle={() => setShowAllActive((v) => !v)}
              renderItem={OrderCard}
              previewCount={2}
            />
            <Section
              title="Old orders"
              emptyText="No old orders."
              items={oldOrders}
              showAll={showAllOld}
              onToggle={() => setShowAllOld((v) => !v)}
              renderItem={OrderCard}
              previewCount={1}
            />
            <Section
              title="Order report"
              emptyText="No reported orders."
              items={reportedOrders}
              showAll={showAllReported}
              onToggle={() => setShowAllReported((v) => !v)}
              renderItem={OrderCard}
              previewCount={2}
            />
          </>
        )}

        {/* Map modal */}
        <LocationMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          point={mapPoint ?? undefined}
          onlyDelivery={onlyDelivery}
        />
      </Container>
    </AuthGuard>
  );
}

function Section<T>({
  title,
  items,
  renderItem,
  emptyText,
  showAll,
  onToggle,
  previewCount = 2,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
  emptyText: string;
  showAll: boolean;
  onToggle: () => void;
  previewCount?: number;
}) {
  const preview = (items ?? []).slice(0, previewCount);
  const visible = showAll ? items : preview;

  return (
    <Box mb={8}>
      <HStack justify="space-between" mb={3}>
        <Heading size="md">{title}</Heading>
        {(items ?? []).length > previewCount && (
          <Button variant="outline" size="sm" onClick={onToggle}>
            {showAll ? "Show less" : "More"}
          </Button>
        )}
      </HStack>

      {!items || items.length === 0 ? (
        <Text color="gray.600">{emptyText}</Text>
      ) : (
        <VStack align="stretch" gap={3}>
          {visible.map((it, idx) => (
            <Box key={idx}>{renderItem(it)}</Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
