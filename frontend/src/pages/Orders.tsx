// src/pages/Orders.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Container,
  Heading,
  HStack,
  VStack,
  Box,
  Text,
  Badge,
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

// ---------- UI status model ----------
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

// map any backend string to UIStatus
function normalizeStatus(s: string): UIStatus {
  const key = s.toLowerCase().replaceAll(/\s+/g, "_");
  switch (key) {
    // legacy API
    case "created":
      return "pending";
    case "out_for_delivery":
      return "lc_to_customer";
    case "confirmed":
      return "confirm_receiving";
    // new
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

// ---------- date helpers ----------
type DateFilter = "ALL" | "WEEK" | "MONTH" | "CUSTOM";

function fmtDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
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

// ---------- component ----------
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

  const expandedOrder = useMemo(
    () => (orders ?? []).find((o) => o.id === expandedId) ?? null,
    [orders, expandedId]
  );

  // load page
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchOrders(page, 20);
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
        // minimal mock if API fails
        const mock: OrderRowAPI[] = [
          {
            id: "m1",
            orderId: "ORD-1001",
            status: "out_for_delivery" as any,
            deliverySlot: "evening (18:00–19:00)",
            createdAt: new Date().toISOString(),
            items: [],
          },
          {
            id: "m2",
            orderId: "ORD-1002",
            status: "packed" as any,
            deliverySlot: "afternoon (14:00–15:00)",
            createdAt: new Date().toISOString(),
            items: [],
          },
          {
            id: "m3",
            orderId: "ORD-1003",
            status: "delivered" as any,
            deliverySlot: "morning (09:00–10:00)",
            createdAt: new Date().toISOString(),
            items: [],
          },
          {
            id: "m4",
            orderId: "ORD-1004",
            status: "created" as any,
            deliverySlot: "night (20:00–21:00)",
            createdAt: new Date().toISOString(),
            items: [],
          },
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

  // reset pagination when filters change
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
  }, [statusFilter, dateFilter, customFrom, customTo]);

  // filter
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

    if (dateFilter === "WEEK") {
      from = startOfWeek(now);
    } else if (dateFilter === "MONTH") {
      from = startOfMonth(now);
    } else {
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

  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        <HStack gap={3} mb={4} align="center">
          <Heading size="lg">My Orders</Heading>
          <span style={{ flex: 1 }} />
          <CartIconButton />
        </HStack>

        {/* Filters in the same line */}
        <HStack gap={3} align="end" mb={4} wrap="wrap">
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
          <VStack align="stretch" gap={3}>
            {(filtered ?? []).map((o) => {
              const ui = normalizeStatus((o as any).status);
              const emoji = STATUS_EMOJI[ui];
              const statusLabel = STATUS_LABEL[ui];
              const showNote = ui === "delivered" || ui === "confirm_receiving";
              const deliveryLabel = `${fmtDateShort(o.createdAt)}${
                o.deliverySlot ? ` ${o.deliverySlot}` : ""
              }`;

              return (
                <Box key={o.id} borderWidth="1px" borderRadius="md" p={4}>
                  {/* Row like the screenshot */}
                  <Grid
                    templateColumns={["1fr", "1fr auto auto auto"]}
                    gap={3}
                    alignItems="center"
                  >
                    <GridItem>
                      <HStack gap={2}>
                        <Text fontWeight="bold">Delivery:</Text>
                        <Text>{deliveryLabel}</Text>
                      </HStack>
                    </GridItem>

                    <GridItem>
                      <HStack gap={2}>
                        <Text fontWeight="bold">Status:</Text>
                        <Text>{statusLabel}</Text>
                        <Text as="span" fontSize="xl" aria-label={`${statusLabel} icon`}>
                          {emoji}
                        </Text>
                      </HStack>
                    </GridItem>

                    <GridItem>
                      <IconButton aria-label="Map" variant="ghost">
                        <MapPin size={18} />
                      </IconButton>
                    </GridItem>

                    <GridItem>
                      {showNote && (
                        <Button
                          onClick={() => {
                            setExpandedId(o.id);
                            setNoteOpen(true);
                          }}
                          colorPalette="green"
                        >
                          Delivery Note
                        </Button>
                      )}
                    </GridItem>
                  </Grid>

                  {/* expandable items */}
                  <Box mt={3}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedId((cur) => (cur === o.id ? null : o.id))}
                    >
                      {expandedId === o.id ? "Hide" : "More info"}
                    </Button>

                    {expandedId === o.id && (
                      <Box mt={3} borderWidth="1px" borderRadius="md" p={3}>
                        <Text mb={2} fontWeight="semibold">
                          Items
                        </Text>
                        <VStack align="stretch" gap={2}>
                          {(o.items ?? []).map((it, idx) => (
                            <HStack key={`${it.productId}-${idx}`} justify="space-between">
                              <Text>{it.productId}</Text>
                              <Text>
                                x{it.quantity} {it.unit ?? ""}
                              </Text>
                            </HStack>
                          ))}
                          {(!o.items || o.items.length === 0) && (
                            <Text color="gray.600">No items attached.</Text>
                          )}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </VStack>
        )}

        {hasMore && (filtered ?? []).length >= 20 && (
          <HStack justifyContent="center" mt={6}>
            <Button onClick={() => setPage((p) => p + 1)} disabled={loading}>
              {loading ? "Loading..." : "Load more"}
            </Button>
          </HStack>
        )}

        <Dialog.Root open={noteOpen} onOpenChange={(e) => !e.open && setNoteOpen(false)}>
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
                          {STATUS_EMOJI[normalizeStatus((expandedOrder as any).status)]}
                        </Text>
                        <Text>
                          Status:{" "}
                          {STATUS_LABEL[normalizeStatus((expandedOrder as any).status)]}
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
                    <Box mt={3}>
                      <Text fontWeight="semibold" mb={2}>
                        Items
                      </Text>
                      <VStack align="stretch" gap={2}>
                        {(expandedOrder.items ?? []).map((it, idx) => (
                          <HStack key={`${it.productId}-${idx}`} justify="space-between">
                            <Text>{it.productId}</Text>
                            <Text>
                              x{it.quantity} {it.unit ?? ""}
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
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
      </Container>
    </AuthGuard>
  );
}
