/** @jsxImportSource @emotion/react */
"use client";

import { css } from "@emotion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Heading,
  HStack,
  Box,
  Text,
  Button,
  Spinner,
  Alert,
  Field,
  Input,
  Badge,
  Separator,
  Select,
  createListCollection,
  Portal,
} from "@chakra-ui/react";

import AuthGuard from "@/guards/AuthGuard";
import { CartFAB } from "@/pages/customer/Market/components/CartFAB";
import { fetchOrders, updateOrderStage } from "@/api/orders";
import type { OrderRowAPI } from "@/types/orders";
import { getOrderId, type StageKey } from "@/types/orders";
import Section from "./components/Section";
import OrderCard from "./components/OrderCard";
import {
  STATUS_LABEL,
  type UIStatus,
  type LatLng,
  startOfMonth,
  startOfWeek,
  toEndOfDay,
  normalizeStatus,
  isOldStatus,
  LOGISTIC_CENTER as LC_LATLNG,
  pickDeliveryPoint,
  getEffectiveUIStatus,
} from "./components/helpers";
import { MOCK_ORDERS } from "@/data/orders";
import RouteLocationDialog, { type PointValue } from "@/components/common/RouteLocationPicker";

type DateFilter = "ALL" | "WEEK" | "MONTH" | "CUSTOM";

const BE_STATUSES = [
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

/* ------------------------------- UI shell ------------------------------- */

const pageBgCss = css`
  background:
    radial-gradient(1000px 360px at 10% -10%, color-mix(in oklab, var(--chakra-colors-blue-400), transparent 70%), transparent 80%),
    radial-gradient(960px 420px at 110% -10%, color-mix(in oklab, var(--chakra-colors-purple-400), transparent 72%), transparent 80%),
    var(--chakra-colors-bg-canvas);
`;

function AccentCard(props: {
  children: React.ReactNode;
  accent: "teal" | "purple" | "orange" | "pink" | "cyan" | "gray" | "yellow" | "blue" | "red";
  px?: number | string;
  py?: number | string;
}) {
  const map: Record<string, { light: string; dark: string; ring: string }> = {
    teal: { light: "teal.50", dark: "teal.900", ring: "teal.500" },
    purple: { light: "purple.50", dark: "purple.900", ring: "purple.500" },
    orange: { light: "orange.50", dark: "orange.900", ring: "orange.500" },
    pink: { light: "pink.50", dark: "pink.900", ring: "pink.500" },
    cyan: { light: "cyan.50", dark: "cyan.900", ring: "cyan.500" },
    gray: { light: "gray.50", dark: "gray.800", ring: "gray.400" },
    yellow: { light: "yellow.50", dark: "yellow.900", ring: "yellow.500" },
    blue: { light: "blue.50", dark: "blue.900", ring: "blue.500" },
    red: { light: "red.50", dark: "red.900", ring: "red.500" },
  };
  const m = map[props.accent];
  return (
    <Box bgGradient={`linear(to-r, ${m.ring}, transparent 60%)`} p="1px" borderRadius="2xl">
      <Box borderRadius="2xl" bg={m.light} _dark={{ bg: m.dark }} px={props.px ?? 4} py={props.py ?? 4}>
        {props.children}
      </Box>
    </Box>
  );
}

/* ------------------------------- helpers ------------------------------- */

function labelForStatus(s: string): string {
  const ui = normalizeStatus(s) as UIStatus;
  const fromMap = (STATUS_LABEL as any)?.[ui];
  if (fromMap) return fromMap;
  return s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* --------------------------------- view -------------------------------- */

export default function OrdersIndex() {
  const nav = useNavigate();

  const [orders, setOrders] = useState<OrderRowAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  const [statusFilter, setStatusFilter] = useState<"ALL" | string>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [mapOpen, setMapOpen] = useState(false);
  const [orderForMap, setOrderForMap] = useState<OrderRowAPI | null>(null);
  const [mapPoint, setMapPoint] = useState<LatLng | null>(null);

  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllOld, setShowAllOld] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchOrders(limit);
        if (!mounted) return;
        setOrders(Array.isArray(data) ? data : []);
      } catch {
        if (!mounted) return;
        setOrders((MOCK_ORDERS as unknown as OrderRowAPI[]).filter(Boolean));
      } finally {
        mounted && setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [limit]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
  }, [statusFilter, dateFilter, customFrom, customTo]);

  const filtered = useMemo(() => {
    const base = (orders ?? []).filter(Boolean);
    const byStatus =
      statusFilter === "ALL"
        ? base
        : base.filter((o) => getEffectiveUIStatus(o) === normalizeStatus(statusFilter));
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

    const f = from.getTime();
    const t = to.getTime();
    return byStatus.filter((o) => {
      const ts = new Date((o as any).createdAt).getTime();
      return Number.isFinite(ts) && ts >= f && ts <= t;
    });
  }, [orders, statusFilter, dateFilter, customFrom, customTo]);

  // Reported = "problem" by effective status OR legacy flags
  const reportedOrders = useMemo(
    () =>
      (filtered ?? []).filter((o: any) => {
        const eff = getEffectiveUIStatus(o);
        return eff === "problem" || Boolean(o?.reported || o?.isReported || o?.reportFlag || o?.issue);
      }),
    [filtered],
  );

  // Active = not old and not reported
  const activeOrders = useMemo(
    () =>
      (filtered ?? []).filter((o) => {
        const eff = getEffectiveUIStatus(o);
        return !isOldStatus(eff) && eff !== "problem";
      }),
    [filtered],
  );

  const oldOrders = useMemo(
    () => (filtered ?? []).filter((o) => isOldStatus(getEffectiveUIStatus(o))),
    [filtered],
  );

  const goToDeliveryNote = (o: OrderRowAPI) => {
    const id = (o as any).id ?? (o as any).orderId;
    nav(`/orders/${id}/note`, { state: { order: o } });
  };

  const dest = useMemo<PointValue | undefined>(() => {
    if (!orderForMap) return undefined;
    if (mapPoint)
      return {
        address: (mapPoint as any).address ?? "",
        lat: Number(mapPoint.lat),
        lng: Number(mapPoint.lng),
      };
    const p = pickDeliveryPoint(orderForMap);
    if (!p) return undefined;
    const a: any = (orderForMap as any).deliveryAddress;
    const label =
      (typeof a === "string" && a) ||
      a?.address ||
      a?.label ||
      `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    return { address: label, lat: p.lat, lng: p.lng };
  }, [orderForMap, mapPoint]);

  const ORIGIN_POINT: PointValue = { address: "Logistics Center", lat: LC_LATLNG.lat, lng: LC_LATLNG.lng };
  const showRoute = useMemo(
    () => !!orderForMap && !!dest && !isOldStatus(getEffectiveUIStatus(orderForMap)),
    [orderForMap, dest],
  );
  const mapKey = useMemo(
    () => JSON.stringify({ mode: showRoute ? "route" : "point", o: ORIGIN_POINT, d: dest }),
    [showRoute, ORIGIN_POINT, dest],
  );

  /* --------------------------- v3 Select collections --------------------------- */

  const statusCollection = useMemo(
    () =>
      createListCollection({
        items: [{ label: "All", value: "ALL" }].concat(
          Array.from(BE_STATUSES).map((s) => ({ label: labelForStatus(s), value: s })),
        ),
      }),
    [],
  );

  const dateCollection = useMemo(
    () =>
      createListCollection({
        items: [
          { label: "All Orders", value: "ALL" },
          { label: "This Week", value: "WEEK" },
          { label: "This Month", value: "MONTH" },
          { label: "Custom Range", value: "CUSTOM" },
        ],
      }),
    [],
  );

  /* --------------------------- report handler --------------------------- */

  const markOrderAsProblem = async (
    order: OrderRowAPI,
    _payload: { subject: string; details: string },
  ) => {
    const id = getOrderId(order) ?? (order as any).id ?? (order as any).orderId;
    if (!id) return;

    const current = String((order as any).stageKey ?? (order as any).status ?? "pending") as StageKey;

    // optimistic UI: set to "problem"
    setOrders((prev) =>
      prev.map((o) =>
        (getOrderId(o) ?? (o as any).id ?? (o as any).orderId) === id
          ? ({ ...o, stageKey: "problem" } as any)
          : o,
      ),
    );
    setExpandedId(String(id));

    try {
      await updateOrderStage(String(id), current, "problem");
    } catch {
      // rollback on failure
      setOrders((prev) =>
        prev.map((o) =>
          (getOrderId(o) ?? (o as any).id ?? (o as any).orderId) === id
            ? ({ ...o, stageKey: current } as any)
            : o,
        ),
      );
    }
  };

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <AuthGuard>
      <Box css={pageBgCss}>
        <Container maxW="6xl" py={8}>
          {/* Header + filters */}
          <AccentCard accent="purple" py={5} px={5}>
            <HStack gap={3} align="center">
              <HStack gap={2}>
                <Heading size="2xl" fontWeight="extrabold" letterSpacing="-0.02em">
                  My Orders
                </Heading>
                <Badge colorPalette="purple" variant="solid" size="sm">
                  {orders?.length ?? 0}
                </Badge>
              </HStack>
              <Box flex="1" />
              <Box display={{ base: "none", sm: "block" }}>
                <CartFAB onClick={() => nav("/market")} />
              </Box>
            </HStack>

            <Separator my={4} />

            <HStack gap={3} align="end" wrap="wrap" position="sticky" top="0" zIndex="docked" py="2">
              {/* Status filter */}
              <Field.Root w="auto" flex="0 0 auto" minW={{ base: "220px", md: "260px" }}>
                <Field.Label>Status</Field.Label>
                <Select.Root
                  size="md"
                  collection={statusCollection}
                  value={[statusFilter]}
                  onValueChange={(e) => setStatusFilter(e.value[0] as string)}
                >
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select status" />
                      <Select.Indicator />
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        <Select.ItemGroup id="statuses" title="Statuses">
                          {statusCollection.items.map((it) => (
                            <Select.Item key={it.value} item={it}>
                              <Select.ItemText>{it.label}</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.ItemGroup>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </Field.Root>

              {/* Date filter */}
              <Field.Root w="auto" flex="0 0 auto" minW={{ base: "200px", md: "240px" }}>
                <Field.Label>Date</Field.Label>
                <Select.Root
                  size="md"
                  collection={dateCollection}
                  value={[dateFilter]}
                  onValueChange={(e) => setDateFilter(e.value[0] as DateFilter)}
                >
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Select range" />
                      <Select.Indicator />
                    </Select.Trigger>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        <Select.ItemGroup id="date-range" title="Preset ranges">
                          {dateCollection.items.map((it) => (
                            <Select.Item key={it.value} item={it}>
                              <Select.ItemText>{it.label}</Select.ItemText>
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.ItemGroup>
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </Field.Root>

              {dateFilter === "CUSTOM" && (
                <HStack gap={2} align="end" wrap="wrap">
                  <Field.Root minW="180px">
                    <Field.Label>From</Field.Label>
                    <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  </Field.Root>
                  <Field.Root minW="180px">
                    <Field.Label>To</Field.Label>
                    <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </Field.Root>
                </HStack>
              )}

              <Box flex="1" />

              <HStack gap={2}>
                {(dateFilter === "CUSTOM" && (customFrom || customTo)) || statusFilter !== "ALL" ? (
                  <Badge colorPalette="gray" variant="subtle">Filters active</Badge>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setDateFilter("ALL");
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                >
                  Clear
                </Button>
              </HStack>
            </HStack>
          </AccentCard>

          {/* Active */}
          <Box h={4} />
          <AccentCard accent="blue">
            {loading && (orders ?? []).length === 0 ? (
              <HStack justifyContent="center" py={12}><Spinner /></HStack>
            ) : (activeOrders ?? []).length === 0 ? (
              <Alert.Root status="info" borderRadius="md">
                <Alert.Indicator />
                <Alert.Description>No active orders.</Alert.Description>
              </Alert.Root>
            ) : (
              <Section
                title={
                  <HStack w="full" justify="space-between" align="center">
                    <HStack>
                      <Text fontSize="xl" fontWeight="bold" m={0}>Active Orders</Text>
                      <Badge colorPalette="blue">{activeOrders.length}</Badge>
                    </HStack>
                    {(activeOrders?.length ?? 0) > 2 && (
                      <Button size="xs" variant="ghost" onClick={() => setShowAllActive((v) => !v)}>
                        {showAllActive ? "Less" : "More"}
                      </Button>
                    )}
                  </HStack>
                }
                emptyText="No active orders."
                items={activeOrders}
                showAll={showAllActive}
                onToggle={() => setShowAllActive((v) => !v)}
                renderItem={(o) => (
                  <OrderCard
                    order={o}
                    isOpen={expandedId === (o as any).id}
                    onToggleOpen={() => setExpandedId(expandedId === (o as any).id ? null : (o as any).id)}
                    onOpenMap={(pt) => {
                      setOrderForMap(o);
                      setMapPoint(pt ?? null);
                      setMapOpen(true);
                    }}
                    onOpenNote={() => goToDeliveryNote(o)}
                    onReportSubmit={markOrderAsProblem}
                    defaultTimelineOpen
                  />
                )}
                previewCount={2}
              />
            )}
          </AccentCard>

          {/* Reported */}
          <Box h={4} />
          <AccentCard accent="red">
            <Section
              title={
                <HStack align="center" gap={2}>
                  <Text fontSize="xl" fontWeight="bold" m={0}>Reported Orders</Text>
                  <Badge colorPalette="red">{reportedOrders.length}</Badge>
                </HStack>
              }
              emptyText="No reported orders."
              items={reportedOrders}
              showAll
              onToggle={() => {}}
              renderItem={(o) => (
                <OrderCard
                  order={o}
                  isOpen={expandedId === (o as any).id}
                  onToggleOpen={() => setExpandedId(expandedId === (o as any).id ? null : (o as any).id)}
                  onOpenMap={(pt) => {
                    setOrderForMap(o);
                    setMapPoint(pt ?? null);
                    setMapOpen(true);
                  }}
                  onOpenNote={() => goToDeliveryNote(o as any)}
                  onReportSubmit={markOrderAsProblem}
                  defaultTimelineOpen={false}
                />
              )}
              previewCount={reportedOrders.length}
            />
          </AccentCard>

          {/* Previous */}
          <Box h={4} />
          <AccentCard accent="gray">
            {(oldOrders ?? []).length === 0 ? (
              <Alert.Root status="info" borderRadius="md">
                <Alert.Indicator />
                <Alert.Description>No old orders.</Alert.Description>
              </Alert.Root>
            ) : (
              <Section
                title={
                  <HStack align="center" gap={2}>
                    <Text fontSize="xl" fontWeight="bold" m={0}>Previous Orders</Text>
                    <Badge colorPalette="gray">{oldOrders.length}</Badge>
                    {(oldOrders?.length ?? 0) > 1 && (
                      <Button size="xs" variant="ghost" onClick={() => setShowAllOld((v) => !v)}>
                        {showAllOld ? "Less" : "More"}
                      </Button>
                    )}
                  </HStack>
                }
                emptyText="No Previous orders."
                items={oldOrders}
                showAll={showAllOld}
                onToggle={() => setShowAllOld((v) => !v)}
                renderItem={(o) => (
                  <OrderCard
                    order={o}
                    isOpen={expandedId === (o as any).id}
                    onToggleOpen={() => setExpandedId(expandedId === (o as any).id ? null : (o as any).id)}
                    onOpenMap={(pt) => {
                      setOrderForMap(o);
                      setMapPoint(pt ?? null);
                      setMapOpen(true);
                    }}
                    onOpenNote={() => goToDeliveryNote(o)}
                    onReportSubmit={markOrderAsProblem}
                    defaultTimelineOpen={false}
                  />
                )}
                previewCount={1}
              />
            )}
          </AccentCard>

          {/* Load more */}
          <Box h={4} />
          <AccentCard accent="gray">
            {(orders?.length ?? 0) >= limit && (
              <HStack justifyContent="center">
                <Button onClick={() => setLimit((n) => n + 50)} disabled={loading}>
                  {loading ? "Loading..." : "Load more"}
                </Button>
              </HStack>
            )}
          </AccentCard>

          {/* Map dialog */}
          <RouteLocationDialog
            key={mapKey}
            open={mapOpen && !!dest}
            onClose={() => setMapOpen(false)}
            viewMode="view"
            mode={showRoute ? "route" : "point"}
            initialPoint={!showRoute && dest ? dest : undefined}
            initialOrigin={showRoute ? ORIGIN_POINT : undefined}
            initialDestination={showRoute && dest ? dest : undefined}
          />
        </Container>
      </Box>
    </AuthGuard>
  );
}
