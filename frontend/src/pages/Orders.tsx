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
} from "@chakra-ui/react";
import AuthGuard from "@/guards/AuthGuard";
import CartIconButton from "@/components/common/CartIconButton";
import { fetchOrders } from "@/api/orders";
import type { OrderRowAPI, OrderStatus } from "@/types/orders";

const STATUS_OPTIONS: Array<"ALL" | OrderStatus> = [
  "ALL",
  "created",
  "packed",
  "out_for_delivery",
  "delivered",
  "confirmed",
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? iso : d.toLocaleString();
}

export default function OrdersPage() {
  // data
  const [orders, setOrders] = useState<OrderRowAPI[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // ui state
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  // expanded order (safe on first render)
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
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [page]);

  // reset pagination when filter changes
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
  }, [statusFilter]);

  // client filter
  const filtered = useMemo(() => {
    const base = orders ?? [];
    if (statusFilter === "ALL") return base;
    return base.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        <HStack gap={3} mb={4} align="center">
          <Heading size="lg">My Orders</Heading>
          <span style={{ flex: 1 }} />
          <CartIconButton />
        </HStack>

        <Grid templateColumns={["1fr", null, "1fr 1fr"]} gap={3} mb={4}>
          <GridItem>
            <HStack gap={3} align="end" style={{ flexWrap: "wrap" }}>
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
                      {s === "ALL" ? "All" : s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field.Root>
            </HStack>
          </GridItem>
          <GridItem />
        </Grid>

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
              const isExpanded = expandedId === o.id;
              const showNote = o.status === "delivered" || o.status === "confirmed";
              return (
                <Box key={o.id} borderWidth="1px" borderRadius="md" p={4}>
                  <HStack justify="space-between" align="start" gap={3}>
                    <VStack align="start" gap={1}>
                      <HStack gap={2}>
                        <Text fontWeight="semibold">Order</Text>
                        <Badge variant="surface">{o.orderId}</Badge>
                      </HStack>
                      <Text color="gray.600">Created: {fmtDate(o.createdAt)}</Text>
                      {o.deliverySlot && (
                        <Text color="gray.600">Slot: {o.deliverySlot}</Text>
                      )}
                    </VStack>

                    <VStack align="end" gap={2} minW="220px">
                      <Badge>{o.status.replaceAll("_", " ")}</Badge>
                      <HStack gap={2}>
                        {showNote && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setExpandedId(o.id);
                              setNoteOpen(true);
                            }}
                          >
                            Delivery note
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setExpandedId((cur) => (cur === o.id ? null : o.id))
                          }
                        >
                          {isExpanded ? "Hide" : "More info"}
                        </Button>
                      </HStack>
                    </VStack>
                  </HStack>

                  {isExpanded && (
                    <Box mt={4} borderWidth="1px" borderRadius="md" p={3}>
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
                      <Text>Status: {expandedOrder.status.replaceAll("_", " ")}</Text>
                    </HStack>
                    {expandedOrder.deliverySlot && (
                      <Text mb={2}>Slot: {expandedOrder.deliverySlot}</Text>
                    )}
                    <Text color="gray.600" mb={3}>
                      Created: {fmtDate(expandedOrder.createdAt)}
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
