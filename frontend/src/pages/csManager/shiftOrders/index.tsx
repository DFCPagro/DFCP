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
} from "@chakra-ui/react";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { useShiftQueryParams } from "./hooks/useShiftQueryParams";
import { useCSOrdersForShift } from "./hooks/useCSOrdersForShift";
import { OrdersTable } from "./components/ordersTable";
import { FilterBar } from "./components/filterBar";
import type { CSOrder, OrderStatus } from "@/types/cs.orders";

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

export default function CSManagerShiftOrders() {
  const navigate = useNavigate();
  const { date, shiftName } = useShiftQueryParams();

  // TODO: replace with LC id from auth/context
  const logisticCenterId = "66e007000000000000000001";

  // UI filters
  const [stageKey, setStatus] = useState<OrderStatus | undefined>();
  const [problemOnly, setProblemOnly] = useState(false);

  // When "problem only" is on, ignore manual status
  const effectiveStatus: OrderStatus | undefined = problemOnly ? "problem" : stageKey;

  // Query
  const { data, isLoading, error, refetch, isFetching } = useCSOrdersForShift({
    date,
    shiftName,
    stageKey: effectiveStatus,
  });

  const handleReload = useCallback(async () => {
    console.log("[CSManagerShiftOrders] reload click", {
      date,
      shiftName,
      at: new Date().toISOString(),
    });
    try {
      const res = await refetch();
      console.log("[CSManagerShiftOrders] reload done", {
        items: res.data?.items?.length ?? 0,
        at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[CSManagerShiftOrders] reload error", err);
    }
  }, [refetch, date, shiftName]);

  // Sort & normalize
  const items: CSOrder[] = useMemo(() => {
    const arr = (data?.items ?? []).slice();
    arr.sort((a, b) => {
      if (a.stageKey === "problem" && b.stageKey !== "problem") return -1;
      if (a.stageKey !== "problem" && b.stageKey === "problem") return 1;
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
    return arr;
  }, [data]);

  const meta = data?.meta;

  const statChips = (
    <HStack gap="2" flexWrap="wrap">
      <Badge variant="surface" colorPalette="gray">
        <HStack gap="1">
          <Text fontWeight="semibold">Total</Text>
          <Text>{meta?.total ?? 0}</Text>
        </HStack>
      </Badge>
      <Badge variant="surface" colorPalette="red">
        <HStack gap="1">
          <Text fontWeight="semibold">Problem</Text>
          <Text>{meta?.problemCount ?? 0}</Text>
        </HStack>
      </Badge>
      {effectiveStatus && effectiveStatus !== "problem" && (
        <Badge variant="surface" colorPalette="teal">
          <HStack gap="1">
            <Text fontWeight="semibold">Filtered</Text>
            <Text>{items.length}</Text>
          </HStack>
        </Badge>
      )}
      {meta?.tz && (
        <Badge variant="surface" colorPalette="purple">
          <HStack gap="1">
            <Text fontWeight="semibold">TZ</Text>
            <Text>{meta.tz}</Text>
          </HStack>
        </Badge>
      )}
    </HStack>
  );

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
              <Box>{statChips}</Box>
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

        {/* Filters */}
        <Box css={stickyFiltersCss}>
          <FilterBar
            stageKey={stageKey}
            setStatus={(v) => setStatus(v as OrderStatus | undefined)}
            problemOnly={problemOnly}
            setProblemOnly={(v) => {
              setProblemOnly(v);
              if (v) setStatus(undefined);
            }}
          />
        </Box>

        {/* Content */}
        <Box css={contentCardCss}>
          {/* Loading */}
          {isLoading && (
            <HStack gap="3" align="center">
              <Spinner />
              <Text>Loading orders…</Text>
            </HStack>
          )}

          {/* Error */}
          {error && (
            <Alert.Root status="error">
              <Alert.Indicator />
              <Alert.Title>Failed to load orders</Alert.Title>
              <Alert.Description>
                Failed to load orders for {date} · {shiftName}.
              </Alert.Description>
              <HStack mt="2">
                <Button size="sm" onClick={handleReload}>
                  Retry
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
                  Back
                </Button>
              </HStack>
            </Alert.Root>
          )}

          {/* Empty */}
          {!isLoading && !error && items.length === 0 && (
            <Alert.Root status="info">
              <Alert.Indicator />
              <Alert.Title>No orders found</Alert.Title>
              <Alert.Description>No orders found for this shift.</Alert.Description>
              <HStack mt="2">
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
            </Alert.Root>
          )}

          {/* Table */}
          {!isLoading && !error && items.length > 0 && <OrdersTable items={items} />}
        </Box>

        <Separator />
      </Stack>
    </Box>
  );
}
