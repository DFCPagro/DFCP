// src/pages/Orders.tsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  Dialog,
  Separator,
  Input,
  IconButton,
} from "@chakra-ui/react";
import { MapPin } from "lucide-react";
import AuthGuard from "@/guards/AuthGuard";
import CartIconButton from "@/components/common/CartIconButton";
import { fetchOrders } from "@/api/orders";
import type { OrderRowAPI } from "@/types/orders";

import ItemList, { type ItemRow } from "@/components/common/ItemList";

// map libs
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";

// ---------- types / status ----------
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

type DateFilter = "ALL" | "WEEK" | "MONTH" | "CUSTOM";
type LatLng = { lat: number; lng: number };

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
const STATUS_OPTIONS: Array<"ALL" | UIStatus> = [
  "ALL",
  "pending",
  "accepted",
  "farmer",
  "farm_to_lc",
  "logistic_center",
  "packed",
  "ready_for_delivery",
  "lc_to_customer",
  "delivered",
  "confirm_receiving",
];

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

// ---------- date + delivery time ----------
function fmtDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}
function fmt2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtDateYY(d: Date) {
  return `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}/${String(
    d.getFullYear()
  ).slice(-2)}`;
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

// ---------- reported ----------
function isReported(o: any) {
  return Boolean(o?.reported || o?.isReported || o?.reportFlag || o?.issue);
}

// ---------- items ----------
function toItemRows(items: any[]): ItemRow[] {
  return (items ?? []).map((it: any, idx: number): ItemRow => ({
    id: it.id ?? it.productId ?? String(idx),
    name:
      it.name ?? it.displayName ?? it.productName ?? it.productId ?? "item",
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

// ---------- delivery-only coords ----------
function getDeliveryCoord(o: any): LatLng | null {
  const to =
    o.delivery ??
    o.shippingAddress ??
    o.customer?.location ??
    (o.destLat && o.destLng ? { lat: o.destLat, lng: o.destLng } : null);
  return to && to.lat && to.lng ? to : null;
}

// ---------- page ----------
export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRowAPI[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [statusFilter, setStatusFilter] = useState<"ALL" | UIStatus>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  // map modal
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPoint, setMapPoint] = useState<LatLng | null>(null);

  // per-section "more"
  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllOld, setShowAllOld] = useState(false);
  const [showAllReported, setShowAllReported] = useState(false);

  const expandedOrder = useMemo(
    () => (orders ?? []).find((o) => o.id === expandedId) ?? null,
    [orders, expandedId]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchOrders(page, 50);
        const items: OrderRowAPI[] = Array.isArray((data as any)?.items)
          ? (data as any).items
          : [];
        if (!mounted) return;
        setOrders((prev) => (page === 1 ? items : [...prev, ...items]));
        const curPage = Number((data as any)?.page ?? page);
        const pageSize = Number((data as any)?.pageSize ?? items.length);
        const total = Number((data as any)?.total ?? items.length);
        setHasMore(curPage * pageSize < total);
      } catch {
        if (!mounted) return;
        const mock: OrderRowAPI[] = [
          {
            id: "m1",
            orderId: "ORD-1001",
            status: "out_for_delivery" as any,
            deliverySlot: "evening (18:00–19:00)",
            createdAt: new Date().toISOString(),
            items: [
              {
                productId: "STRAWB-ALB",
                quantity: 2,
                unit: "kg",
                unitPrice: 6.9,
                name: "Strawberry Albion",
                farmerName: "Levi Cohen",
              } as any,
            ],
            delivery: { lat: 31.7683, lng: 35.2137 },
          } as any,
          {
            id: "m2",
            orderId: "ORD-1002",
            status: "packed" as any,
            deliverySlot: "afternoon (14:00–15:00)",
            createdAt: new Date().toISOString(),
            items: [],
            ...( { reported: true } as any),
            delivery: { lat: 32.794, lng: 34.9896 },
          } as any,
          {
            id: "m3",
            orderId: "ORD-1003",
            status: "delivered" as any,
            deliverySlot: "morning (09:00–10:00)",
            createdAt: new Date().toISOString(),
            items: [],
            delivery: { lat: 31.0461, lng: 34.8516 },
          } as any,
          {
            id: "m4",
            orderId: "ORD-1004",
            status: "created" as any,
            deliverySlot: "night (20:00–21:00)",
            createdAt: new Date().toISOString(),
            items: [],
            delivery: { lat: 32.1093, lng: 34.8555 },
          } as any,
        ];
        setOrders(mock);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [page]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
  }, [statusFilter, dateFilter, customFrom, customTo]);

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
        return !isReported(o) && ui !== "delivered" && ui !== "confirm_receiving";
      }),
    [filtered]
  );
  const oldOrders = useMemo(
    () =>
      (filtered ?? []).filter((o) => {
        const ui = normalizeStatus((o as any).status);
        return !isReported(o) && (ui === "delivered" || ui === "confirm_receiving");
      }),
    [filtered]
  );
  const reportedOrders = useMemo(
    () => (filtered ?? []).filter((o) => isReported(o)),
    [filtered]
  );

  // -------- order card --------
  function OrderCard(o: OrderRowAPI) {
    const ui = normalizeStatus((o as any).status);
    const emoji = STATUS_EMOJI[ui];
    const statusLabel = STATUS_LABEL[ui];
    const showNote = ui === "delivered" || ui === "confirm_receiving";
    const deliveryTime = formatDeliveryTime(o);
    const rows = toItemRows((o as any).items ?? []);
    const currency = pickCurrency((o as any).items ?? []) ?? "$";
    const isOpen = expandedId === o.id;
    const point = getDeliveryCoord(o as any);

    return (
      <Box key={o.id} borderWidth="1px" borderRadius="md" p={4}>
        <Grid
          templateColumns={{ base: "1fr", md: "1fr auto 1fr" }}
          w="100%"
          alignItems="center"
          gap={3}
        >
          {/* left: delivery time */}
          <GridItem minW={0}>
            <HStack gap={2}>
              <Text fontWeight="bold">Delivery time:</Text>
              <Text
                as="span"
                maxW="100%"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {deliveryTime}
              </Text>
            </HStack>
          </GridItem>

          {/* center: status + map icon */}
          <GridItem justifySelf="center">
            <HStack gap={3}>
              <HStack gap={2}>
                <Text fontWeight="bold">Status:</Text>
                <Text>{statusLabel}</Text>
                <Text as="span" fontSize="xl">
                  {emoji}
                </Text>
              </HStack>
              <IconButton
                aria-label="Map"
                variant="solid"
                size="sm"
                onClick={() => {
                  if (point) {
                    setMapPoint(point);
                    setMapOpen(true);
                  }
                }}
                disabled={!point}
              >
                <MapPin size={16} />
              </IconButton>
            </HStack>
          </GridItem>

          {/* right: actions */}
          <GridItem justifySelf="end">
            <HStack gap={2}>
              {showNote && (
                <Button
                  onClick={() => {
                    setExpandedId(o.id);
                    setNoteOpen(true);
                  }}
                >
                  Delivery Note
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setExpandedId(isOpen ? null : o.id)}
              >
                {isOpen ? "Close" : "Full order"}
              </Button>
            </HStack>
          </GridItem>
        </Grid>

        {isOpen && (
          <Box mt={3} borderWidth="1px" borderRadius="md" p={3}>
            {rows.length ? (
              <ItemList items={rows} currency={currency} />
            ) : (
              <Text color="gray.600">No items attached.</Text>
            )}
          </Box>
        )}
      </Box>
    );
  }

  // -------- UI --------
  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        <HStack gap={3} mb={4} align="center">
          <Heading size="lg">My Orders</Heading>
          <span style={{ flex: 1 }} />
          <CartIconButton />
        </HStack>

        {/* 1) Filters */}
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
                border:
                  "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
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
                border:
                  "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
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
                <Input
                  id="from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label htmlFor="to">To</Field.Label>
                <Input
                  id="to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </Field.Root>
              <Button
                variant="outline"
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
              >
                Clear
              </Button>
            </HStack>
          )}
        </HStack>

        {loading && (orders ?? []).length === 0 ? (
          <HStack justifyContent="center" py={12}>
            <Spinner />
          </HStack>
        ) : (filtered ?? []).length === 0 ? (
          <Alert.Root status="info" borderRadius="md">
            <Alert.Indicator />
            <Alert.Description>No orders found.</Alert.Description>
          </Alert.Root>
        ) : (
          <>
            {/* 2) Active orders (preview 2) */}
            <Section
              title="Active orders"
              emptyText="No active orders."
              items={activeOrders}
              showAll={showAllActive}
              onToggle={() => setShowAllActive((v) => !v)}
              renderItem={OrderCard}
              previewCount={2}
            />

            {/* 3) Old orders (preview 1) */}
            <Section
              title="Old orders"
              emptyText="No old orders."
              items={oldOrders}
              showAll={showAllOld}
              onToggle={() => setShowAllOld((v) => !v)}
              renderItem={OrderCard}
              previewCount={1}
            />

            {/* 4) Order report (preview 2) */}
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

        {hasMore && (
          <HStack justifyContent="center" mt={6}>
            <Button onClick={() => setPage((p) => p + 1)} disabled={loading}>
              {loading ? "Loading..." : "Load more"}
            </Button>
          </HStack>
        )}

        {/* Delivery Note modal */}
        <Dialog.Root
          open={noteOpen}
          onOpenChange={(e) => !e.open && setNoteOpen(false)}
        >
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxW="3xl">
              <Dialog.Header>
                <Dialog.Title>Delivery Note</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {expandedOrder ? (
                  <Box>
                    <HStack justify="space-between" mb={2}>
                      <Text>Order: {expandedOrder.orderId}</Text>
                      <HStack>
                        <Text as="span" fontSize="xl">
                          {
                            STATUS_EMOJI[
                              normalizeStatus((expandedOrder as any).status)
                            ]
                          }
                        </Text>
                        <Text>
                          {
                            STATUS_LABEL[
                              normalizeStatus((expandedOrder as any).status)
                            ]
                          }
                        </Text>
                      </HStack>
                    </HStack>
                    {expandedOrder.deliverySlot && (
                      <Text mb={2}>Slot: {expandedOrder.deliverySlot}</Text>
                    )}
                    <Text color="gray.600" mb={3}>
                      Created: {fmtDateShort(expandedOrder.createdAt)}
                    </Text>
                    <Separator my={3} />
                    <ItemList
                      items={toItemRows((expandedOrder as any).items ?? [])}
                      currency={
                        pickCurrency((expandedOrder as any).items ?? []) ?? "$"
                      }
                    />
                  </Box>
                ) : (
                  <HStack justifyContent="center" py={8}>
                    <Spinner />
                  </HStack>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Button onClick={() => setNoteOpen(false)}>Close</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>

        {/* Map modal */}
        <LocationMapModal
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          point={mapPoint ?? undefined}
        />
      </Container>
    </AuthGuard>
  );
}

// ---------- reusable section ----------
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

// ---------- map modal (delivery point only) ----------
function LocationMapModal({
  open,
  onClose,
  point,
}: {
  open: boolean;
  onClose: () => void;
  point?: LatLng;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="5xl">
          <Dialog.Header>
            <Dialog.Title>Delivery location</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {point ? (
              <Box h="420px" w="100%" borderRadius="md" overflow="hidden">
                <MapContainer
                  {...({ center: [point.lat, point.lng], zoom: 13 } as any)}
                  style={{ height: "100%", width: "100%" }}
                  key={`${point.lat},${point.lng}`}
                >
                  <TileLayer
                    {...({
                      attribution: "© OpenStreetMap contributors",
                      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                    } as any)}
                  />
                  <CircleMarker
                    {...({
                      center: [point.lat, point.lng],
                      radius: 9,
                      pathOptions: { color: "#16a34a" },
                    } as any)}
                  />
                </MapContainer>
              </Box>
            ) : (
              <Text>No delivery location available for this order.</Text>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button onClick={onClose}>Close</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
