"use client";

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
} from "@chakra-ui/react";

import AuthGuard from "@/guards/AuthGuard";
import { CartFAB } from "../Market/components/CartFAB";
import { fetchOrders } from "@/api/orders";
import type { OrderRowAPI } from "../../types/orders";
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

// Backend canonical statuses (as provided)
const BE_STATUSES = [
  "pending",
  "confirmed",
  "farmer",
  "in-transit",
  "packing",
  "ready_for_pickUp",
  "out_for_delivery",
  "delivered",
  "received",    // helper maps 'recived' -> 'received' too
  "canceled",
  "problem",
] as const;

// OrdersIndex.tsx — replace ColorBlock and pass accents to Section
function ColorBlock({
  children,
  light,
  dark,
  accent,
}: {
  children: React.ReactNode;
  light: string;
  dark: string;
  /** Accent for the outer ring gradient */
  accent: string;
}) {
  const opposite = (c: string) => {
    const base = c.split(".")[0];
    switch (base) {
      case "teal":
        return "pink.500";
      case "orange":
        return "blue.600";
      case "pink":
        return "teal.600";
      case "purple":
        return "yellow.400";
      case "blue":
        return "orange.500";
      case "cyan":
        return "red.500";
      case "green":
        return "purple.600";
      case "yellow":
        return "purple.700";
      default:
        return "cyan.500";
    }
  };
  const ring = `linear(to-r, ${accent}, ${opposite(accent)})`;

  return (
    <Box bgGradient={ring} p="1px" borderRadius="2xl">
      <Box p={4} borderRadius="2xl" bg={light} _dark={{ bg: dark }}>
        {children}
      </Box>
    </Box>
  );
}


function labelForStatus(s: string): string {
  const ui = normalizeStatus(s) as UIStatus;
  const fromMap = (STATUS_LABEL as any)?.[ui];
  if (fromMap) return fromMap;
  return s
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OrdersIndex() {
  const nav = useNavigate();

  const [orders, setOrders] = useState<OrderRowAPI[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  // use string to tolerate BE vs UI variants; normalize for comparisons
  const [statusFilter, setStatusFilter] = useState<"ALL" | string>("ALL");
  const [dateFilter, setDateFilter] = useState<DateFilter>("ALL");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // map state
  const [mapOpen, setMapOpen] = useState(false);
  const [orderForMap, setOrderForMap] = useState<OrderRowAPI | null>(null);
  const [mapPoint, setMapPoint] = useState<LatLng | null>(null);

  // show-only-2 for active orders
  const [showAllActive, setShowAllActive] = useState(false);

  // show 1 old order by default
  const [showAllOld, setShowAllOld] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchOrders(limit);            // <- new API shape
        if (!mounted) return;
        setOrders(Array.isArray(data) ? data : []);
      } catch {
        if (!mounted) return;
        setOrders((MOCK_ORDERS as unknown as OrderRowAPI[]).filter(Boolean));
      } finally {
        if (mounted) setLoading(false);
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
        : base.filter(
            (o) =>
              normalizeStatus((o as any).status) ===
              normalizeStatus(statusFilter as string)
          );

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
    () => (filtered ?? []).filter((o) => !isOldStatus((o as any).status)),
    [filtered]
  );

  const oldOrders = useMemo(
    () => (filtered ?? []).filter((o) => isOldStatus((o as any).status)),
    [filtered]
  );

  const reportedOrders = useMemo(
    () =>
      (filtered ?? []).filter(
        (o: any) => Boolean(o?.reported || o?.isReported || o?.reportFlag || o?.issue)
      ),
    [filtered]
  );

  const goToDeliveryNote = (o: OrderRowAPI) => {
    const id = (o as any).id ?? (o as any).orderId;
    nav(`/orders/${id}/note`, { state: { order: o } });
  };

  // -------- MAP DERIVED VALUES --------
  const uiForMap = useMemo<UIStatus>(
    () =>
      orderForMap
        ? (normalizeStatus((orderForMap as any).status) as UIStatus)
        : "pending",
    [orderForMap]
  );

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

  const ORIGIN_POINT: PointValue = useMemo(
    () => ({ address: "Logistics Center", lat: LC_LATLNG.lat, lng: LC_LATLNG.lng }),
    []
  );

  const showRoute = useMemo(
    () => !!orderForMap && !!dest && !isOldStatus((orderForMap as any).status),
    [orderForMap, dest]
  );

  const mapKey = useMemo(
    () => JSON.stringify({ mode: showRoute ? "route" : "point", o: ORIGIN_POINT, d: dest }),
    [showRoute, ORIGIN_POINT, dest]
  );

  return (
    <AuthGuard>
      <Container maxW="6xl" py={6}>
        {/* Header + Filters */}
<ColorBlock light="purple.100" dark="purple.900" accent="purple.600">
          <HStack gap={3} align="center">
            <Heading size="2xl" fontWeight="extrabold">My Orders</Heading>
            <span style={{ flex: 1 }} />
            <CartFAB onClick={() => nav("/cart")} />
          </HStack>

          <Box h={3} />
          <HStack gap={3} align="end" wrap="nowrap" overflowX="auto">
            <Field.Root w="auto" flex="0 0 auto">
              <Field.Label htmlFor="status-filter">Status</Field.Label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
                  minWidth: 220,
                  background: "var(--chakra-colors-white, #fff)",
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

            <Field.Root w="auto" flex="0 0 auto">
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
          </HStack>

          {dateFilter === "CUSTOM" && (
            <HStack gap={2} align="end" mt={3} wrap="wrap">
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
        </ColorBlock>

        {/* Active */}
        <Box h={3} />
<ColorBlock light="teal.50" dark="teal.900" accent="teal.600">
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
                  <Text fontSize="xl" fontWeight="bold" m={0}>Active Orders</Text>
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
        </ColorBlock>

        {/* Previous orders */}
        <Box h={3} />
<ColorBlock light="yellow.50" dark="orange.900" accent="orange.600">
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
        </ColorBlock>

        {/* Reported */}
        <Box h={3} />
<ColorBlock light="pink.100" dark="pink.900" accent="pink.600">
          <Section
            title={
              <HStack w="full" justify="space-between" align="center">
                <Text fontSize="xl" fontWeight="bold" m={0}>Reported Orders</Text>
              </HStack>
            }
            emptyText="No reported orders."
            items={reportedOrders ?? []}
            showAll={true}
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
        </ColorBlock>

        {/* Load more */}
        <Box h={3} />
<ColorBlock light="gray.100" dark="gray.800" accent="cyan.600">
          {(orders?.length ?? 0) >= limit && (
            <HStack justifyContent="center">
              <Button onClick={() => setLimit((n) => n + 50)} disabled={loading}>
                {loading ? "Loading..." : "Load more"}
              </Button>
            </HStack>
          )}
        </ColorBlock>

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
    </AuthGuard>
  );
}
