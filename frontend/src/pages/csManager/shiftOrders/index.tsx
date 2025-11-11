/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";
import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Heading,
  Stack,
  HStack,
  VStack,
  Text,
  Separator,
  Spinner,
  Alert,
  Button,
  Badge,
  IconButton,
  Tooltip,
  Dialog,
  Table,
  Grid,
  GridItem,
  Image,
} from "@chakra-ui/react";
import { ArrowLeft, RotateCcw, PieChart as PieChartIcon, Package as PackageIcon } from "lucide-react";

import { useShiftQueryParams } from "./hooks/useShiftQueryParams";
import { useCSOrdersForShift } from "./hooks/useCSOrdersForShift";
import { OrdersTable } from "./components/ordersTable";
import { FilterBar } from "./components/filterBar";
import ItemsPie, { type PieDatum } from "./components/itemsPie";
import type { CSOrder, OrderStatus } from "@/types/cs.orders";

/* -------------------------------- CSS -------------------------------- */
const pageCss = css`
  min-height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
`;
const headerCss = css`
  border: 1px solid var(--chakra-colors-border);
  background:
    radial-gradient(1200px 240px at 10% -20%, var(--chakra-colors-teal-500) 0%, transparent 60%),
    radial-gradient(800px 200px at 90% -10%, var(--chakra-colors-purple-500) 0%, transparent 60%),
    var(--chakra-colors-bg.panel);
  border-radius: 16px;
  padding: 16px;
`;
const stickyFiltersCss = css`
  position: sticky;
  top: 8px;
  z-index: 5;
  background: var(--chakra-colors-bg);
  border: 1px solid var(--chakra-colors-border);
  border-radius: 12px;
  padding: 12px;
`;
const contentCardCss = css`
  border: 1px solid var(--chakra-colors-border);
  background: var(--chakra-colors-bg.panel);
  border-radius: 16px;
  padding: 12px;
`;

/* -------------------- helpers: extract totals (+ image) -------------------- */
function getImageFromLine(ln: any): string | undefined {
  return (
    ln?.itemImageUrl ??
    ln?.imageUrl ??
    ln?.pictureUrl ??
    ln?.item?.imageUrl ??
    ln?.item?.pictureUrl ??
    ln?.item?.image ??
    undefined
  );
}

function* iterOrderLines(
  o: any
): Generator<{ name: string; qtyKg?: number; units?: number; imageUrl?: string }> {
  const paths = [o?.lines, o?.items, o?.cart?.lines, o?.orderLines, o?.summary?.lines].filter(Boolean);
  for (const arr of paths) {
    if (Array.isArray(arr)) {
      for (const ln of arr) {
        const name =
          ln?.itemDisplayName ?? ln?.itemName ?? ln?.name ?? ln?.item?.name ?? "Unknown item";
        const qtyKg =
          typeof ln?.qtyKg === "number"
            ? ln.qtyKg
            : typeof ln?.quantityKg === "number"
            ? ln.quantityKg
            : undefined;
        const units =
          typeof ln?.units === "number"
            ? ln.units
            : typeof ln?.quantityUnits === "number"
            ? ln.quantityUnits
            : undefined;
        yield { name, qtyKg, units, imageUrl: getImageFromLine(ln) };
      }
      return;
    }
  }
}

type StatRow = { name: string; amount: number; metric: string; imageUrl?: string };

function computeItemTotals(orders: CSOrder[]) {
  const map = new Map<
    string,
    { name: string; totalKg: number; totalUnits: number; imageUrl?: string }
  >();

  for (const o of orders) {
    for (const ln of iterOrderLines(o as any)) {
      const curr = map.get(ln.name) ?? { name: ln.name, totalKg: 0, totalUnits: 0, imageUrl: undefined };
      if (typeof ln.qtyKg === "number" && !Number.isNaN(ln.qtyKg)) curr.totalKg += ln.qtyKg;
      else if (typeof ln.units === "number" && !Number.isNaN(ln.units)) curr.totalUnits += ln.units;
      if (!curr.imageUrl && ln.imageUrl) curr.imageUrl = ln.imageUrl;
      map.set(ln.name, curr);
    }
  }

  const rows = Array.from(map.values());
  const hasAnyKg = rows.some((r) => r.totalKg > 0);
  const tableRows: StatRow[] = rows
    .map((r) => ({
      name: r.name,
      amount: hasAnyKg ? r.totalKg : r.totalUnits,
      metric: hasAnyKg ? "kg" : "units",
      imageUrl: r.imageUrl,
    }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const pieData: PieDatum[] = tableRows.map((r) => ({ name: r.name, value: r.amount }));
  const total = tableRows.reduce((s, r) => s + r.amount, 0);
  const metric = tableRows[0]?.metric ?? "kg";
  return { tableRows, pieData, total, metric };
}

/* ----------------------------- main component ----------------------------- */
export default function CSManagerShiftOrders() {
  const navigate = useNavigate();
  const { date, shiftName } = useShiftQueryParams();

  const [stageKey, setStatus] = useState<OrderStatus | undefined>();
  const [problemOnly, setProblemOnly] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const effectiveStatus = problemOnly ? "problem" : stageKey;
  const { data, isLoading, error, refetch, isFetching } = useCSOrdersForShift({
    date,
    shiftName,
    stageKey: effectiveStatus,
  });

  const handleReload = useCallback(async () => {
    try {
      await refetch();
    } catch (err) {
      console.error("[CSManagerShiftOrders] reload error", err);
    }
  }, [refetch]);

  const items: CSOrder[] = useMemo(() => {
    const arr = (data?.items ?? []).slice();
    arr.sort((a, b) => {
      if (a.stageKey === "problem" && b.stageKey !== "problem") return -1;
      if (a.stageKey !== "problem" && b.stageKey === "problem") return 1;
      return (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0);
    });
    return arr;
  }, [data]);

  const meta = data?.meta;
  const { tableRows, pieData, total, metric } = useMemo(() => computeItemTotals(items), [items]);

  return (
    <Box w="full" css={pageCss}>
      <Stack gap="4">
        {/* Header */}
        <Box css={headerCss}>
          <HStack justify="space-between" align="center">
            <VStack gap="1" align="start">
              <Heading size="lg">
                Orders · {date} · {shiftName}
              </Heading>
              <HStack gap="2">
                <Badge variant="surface" colorPalette="gray">
                  <Text>All: {meta?.total ?? 0}</Text>
                </Badge>
                <Badge variant="surface" colorPalette="red">
                  <Text>Problem: {meta?.problemCount ?? 0}</Text>
                </Badge>
              </HStack>
            </VStack>

            <HStack gap="2">
              <IconButton aria-label="Back" variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} />
              </IconButton>

              <Tooltip.Root openDelay={300}>
                <Tooltip.Trigger asChild>
                  <IconButton
                    aria-label="Reload"
                    variant="outline"
                    title="Reload"
                    onClick={handleReload}
                    disabled={!!isFetching}
                  >
                    {isFetching ? <Spinner size="sm" /> : <RotateCcw size={18} />}
                  </IconButton>
                </Tooltip.Trigger>
                <Tooltip.Positioner>
                  <Tooltip.Content>
                    <Tooltip.Arrow />
                    {isFetching ? "Reloading…" : "Reload"}
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Tooltip.Root>
            </HStack>
          </HStack>
        </Box>

        {/* Filters + Stats button */}
        <Box css={stickyFiltersCss}>
          <HStack justify="space-between" align="center">
            <FilterBar
              stageKey={stageKey}
              setStatus={(v) => setStatus(v as OrderStatus | undefined)}
              problemOnly={problemOnly}
              setProblemOnly={(v) => {
                setProblemOnly(v);
                if (v) setStatus(undefined);
              }}
            />
            <Button
              variant="solid"
              colorPalette="teal"
              onClick={() => setStatsOpen(true)}
              leftIcon={<PieChartIcon size={16} />}
            >
              Stats
            </Button>
          </HStack>
        </Box>

        {/* Orders Table */}
        <Box css={contentCardCss}>
          {isLoading ? (
            <HStack gap="3" align="center">
              <Spinner /> <Text>Loading orders…</Text>
            </HStack>
          ) : error ? (
            <Alert.Root status="error">
              <Alert.Indicator />
              <Alert.Title>Error loading orders</Alert.Title>
            </Alert.Root>
          ) : items.length === 0 ? (
            <Alert.Root status="info">
              <Alert.Indicator />
              <Alert.Title>No orders found</Alert.Title>
            </Alert.Root>
          ) : (
            <OrdersTable items={items} />
          )}
        </Box>

        <Separator />
      </Stack>

      {/* STATS POPUP */}
      <Dialog.Root open={statsOpen} onOpenChange={(e) => setStatsOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="900px"
            w="96vw"
            bg="bg.panel"
            border="1px solid"
            borderColor="border"
            borderRadius="xl"
          >
            <Dialog.Header>
              <Dialog.Title>Items purchased — {date} · {shiftName}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>

            <Dialog.Body>
              {pieData.length === 0 ? (
                <Text color="fg.muted">No data available.</Text>
              ) : (
                <Grid columns={{ base: 1, md: 2 }} gap="6">
                  <GridItem>
                    <ItemsPie data={pieData} metric={metric} total={total} />
                  </GridItem>

                  <GridItem>
                    <Box border="1px solid" borderColor="border" borderRadius="md" p="3">
                      <Table.Root size="sm">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>Item</Table.ColumnHeader>
                            <Table.ColumnHeader isNumeric>
                              Amount ({metric})
                            </Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {tableRows.map((r) => (
                            <Table.Row key={r.name}>
                              <Table.Cell>
                                <HStack gap="3" align="center">
                                  <Tooltip.Root openDelay={250}>
                                    <Tooltip.Trigger asChild>
                                      <Box
                                        as="button"
                                        aria-label={`Preview ${r.name}`}
                                        w="28px"
                                        h="28px"
                                        borderRadius="full"
                                        overflow="hidden"
                                        border="1px solid"
                                        borderColor="border"
                                        bg="bg.muted"
                                        display="inline-flex"
                                        alignItems="center"
                                        justifyContent="center"
                                      >
                                        {r.imageUrl ? (
                                          <Box
                                            w="100%"
                                            h="100%"
                                            backgroundImage={`url('${r.imageUrl}')`}
                                            backgroundSize="cover"
                                            backgroundPosition="center"
                                          />
                                        ) : (
                                          <PackageIcon size={16} />
                                        )}
                                      </Box>
                                    </Tooltip.Trigger>
                                    <Tooltip.Positioner>
                                      <Tooltip.Content p="2">
                                        <Tooltip.Arrow />
                                        {r.imageUrl ? (
                                          <Image
                                            src={r.imageUrl}
                                            alt={r.name}
                                            maxW="180px"
                                            borderRadius="md"
                                            border="1px solid"
                                            borderColor="border"
                                          />
                                        ) : (
                                          <HStack gap="2">
                                            <PackageIcon size={16} />
                                            <Text>No image</Text>
                                          </HStack>
                                        )}
                                      </Tooltip.Content>
                                    </Tooltip.Positioner>
                                  </Tooltip.Root>

                                  <Text fontWeight="medium" noOfLines={1} title={r.name}>
                                    {r.name}
                                  </Text>
                                </HStack>
                              </Table.Cell>
                              <Table.Cell isNumeric>
                                {r.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </Box>
                  </GridItem>
                </Grid>
              )}
            </Dialog.Body>

            <Dialog.Footer>
              <HStack w="full" justify="flex-end">
                <Button variant="surface" onClick={() => setStatsOpen(false)}>
                  Close
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
}
