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
} from "@chakra-ui/react";

import AuthGuard from "@/guards/AuthGuard";
import { CartFAB } from "@/pages/customer/Market/components/CartFAB";
import { fetchOrders } from "@/api/orders";
import type { OrderRowAPI } from "@/types/orders";
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
    radial-gradient(1200px 400px at 10% -10%, var(--chakra-colors-teal-500, #14b8a6) 0%, transparent 60%),
    radial-gradient(1000px 480px at 110% -10%, var(--chakra-colors-purple-600, #7c3aed) 0%, transparent 60%),
    var(--chakra-colors-bg.canvas);
`;

function AccentCard(props: {
  children: React.ReactNode;
  accent: "teal" | "purple" | "orange" | "pink" | "cyan" | "gray" | "yellow";
  px?: number | string;
  py?: number | string;
}) {
  const map: Record<string, { light: string; dark: string; ring: string }> = {
    teal: { light: "teal.50", dark: "teal.900", ring: "teal.500" },
    purple: { light: "purple.100", dark: "purple.900", ring: "purple.600" },
    orange: { light: "yellow.50", dark: "orange.900", ring: "orange.600" },
    pink: { light: "pink.100", dark: "pink.900", ring: "pink.600" },
    cyan: { light: "gray.100", dark: "gray.800", ring: "cyan.600" },
    gray: { light: "gray.100", dark: "gray.800", ring: "gray.500" },
    yellow: { light: "yellow.50", dark: "yellow.900", ring: "yellow.500" },
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
        : base.filter((o) => normalizeStatus((o as any).stageKey) === normalizeStatus(statusFilter));
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
      const ts = new Date(o.createdAt).getTime();
      return Number.isFinite(ts) && ts >= f && ts <= t;
    });
  }, [orders, statusFilter, dateFilter, customFrom, customTo]);

  const activeOrders = useMemo(
    () => (filtered ?? []).filter((o) => !isOldStatus((o as any).stageKey)),
    [filtered],
  );

  const oldOrders = useMemo(
    () => (filtered ?? []).filter((o) => isOldStatus((o as any).stageKey)),
    [filtered],
  );

  const reportedOrders = useMemo(
    () =>
      (filtered ?? []).filter(
        (o: any) => Boolean(o?.reported || o?.isReported || o?.reportFlag || o?.issue),
      ),
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
    () => !!orderForMap && !!dest && !isOldStatus((orderForMap as any).stageKey),
    [orderForMap, dest],
  );
  const mapKey = useMemo(
    () => JSON.stringify({ mode: showRoute ? "route" : "point", o: ORIGIN_POINT, d: dest }),
    [showRoute, ORIGIN_POINT, dest],
  );

  return (
    <AuthGuard>
      <Box css={pageBgCss}>
        <Container maxW="6xl" py={8}>
          {/* Header + filters */}
          <AccentCard accent="purple" py={5} px={5}>
            <HStack gap={3} align="center">
              <Heading size="2xl" fontWeight="extrabold" letterSpacing="-0.02em">
                My Orders
              </Heading>
              <Badge colorPalette="purple" variant="solid" size="sm">
                {orders?.length ?? 0}
              </Badge>
              <Box flex="1" />
              <CartFAB onClick={() => nav("/market")} />
            </HStack>

            <Separator my={4} />

            <HStack gap={3} align="end" overflowX="auto" wrap="wrap">
              {/* Status filter */}
              <Field.Root w="auto" flex="0 0 auto" minW="220px">
                <Field.Label>Status</Field.Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--chakra-colors-border)",
                    background: "var(--chakra-colors-bg)",
                    minWidth: "220px",
                  }}
                >
                  <option value="ALL">All</option>
                  {BE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {labelForStatus(s)}
                    </option>
                  ))}
                </select>
              </Field.Root>

              {/* Date filter */}
              <Field.Root w="auto" flex="0 0 auto" minW="200px">
                <Field.Label>Date</Field.Label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--chakra-colors-border)",
                    background: "var(--chakra-colors-bg)",
                    minWidth: "200px",
                  }}
                >
                  <option value="ALL">All Orders</option>
                  <option value="WEEK">This Week</option>
                  <option value="MONTH">This Month</option>
                  <option value="CUSTOM">Custom Range</option>
                </select>
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
                  <Button variant="outline" onClick={() => { setCustomFrom(""); setCustomTo(""); }}>
                    Clear
                  </Button>
                </HStack>
              )}
            </HStack>
          </AccentCard>

          {/* Active */}
          <Box h={4} />
          <AccentCard accent="teal">
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
                      <Text fontSize="xl" fontWeight="bold" m={0}>
                        Active Orders
                      </Text>
                      <Badge colorPalette="teal">{activeOrders.length}</Badge>
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
                    isOpen={expandedId === o.id}
                    onToggleOpen={() => setExpandedId(expandedId === o.id ? null : o.id)}
                    onOpenMap={(pt) => {
                      setOrderForMap(o);
                      setMapPoint(pt ?? null);
                      setMapOpen(true);
                    }}
                    onOpenNote={() => goToDeliveryNote(o)}
                  />
                )}
                previewCount={2}
              />
            )}
          </AccentCard>

          {/* Previous */}
          <Box h={4} />
          <AccentCard accent="orange">
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
                    <Badge colorPalette="orange">{oldOrders.length}</Badge>
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
                    isOpen={expandedId === o.id}
                    onToggleOpen={() => setExpandedId(expandedId === o.id ? null : o.id)}
                    onOpenMap={(pt) => {
                      setOrderForMap(o);
                      setMapPoint(pt ?? null);
                      setMapOpen(true);
                    }}
                    onOpenNote={() => goToDeliveryNote(o)}
                  />
                )}
                previewCount={1}
              />
            )}
          </AccentCard>

          {/* Reported */}
          <Box h={4} />
          <AccentCard accent="pink">
            <Section
              title={
                <HStack w="full" justify="space-between" align="center">
                  <HStack>
                    <Text fontSize="xl" fontWeight="bold" m={0}>Reported Orders</Text>
                    <Badge colorPalette="pink">{reportedOrders.length}</Badge>
                  </HStack>
                </HStack>
              }
              emptyText="No reported orders."
              items={reportedOrders ?? []}
              showAll
              onToggle={() => {}}
              renderItem={(o) => (
                <OrderCard
                  order={o as any}
                  isOpen={expandedId === (o as any).id}
                  onToggleOpen={() =>
                    setExpandedId(expandedId === (o as any).id ? null : (o as any).id)
                  }
                  onOpenMap={(pt) => {
                    setOrderForMap(o as any);
                    setMapPoint(pt ?? null);
                    setMapOpen(true);
                  }}
                  onOpenNote={() => goToDeliveryNote(o as any)}
                />
              )}
              previewCount={reportedOrders?.length ?? 0}
            />
          </AccentCard>

          {/* Load more */}
          <Box h={4} />
          <AccentCard accent="cyan">
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
