import * as React from "react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Stack,
  Heading,
  Skeleton,
  Alert,
  HStack,
  Text,
  NativeSelect,
  Button,
} from "@chakra-ui/react";
import { PieChart as PieChartIcon } from "lucide-react";
import { getFarmerOrdersByShift, qkFarmerOrdersByShift } from "@/api/farmerOrders";
import { getContactInfoById } from "@/api/user";
import type {
  ShiftFarmerOrdersQuery,
  ShiftFarmerOrdersResponse,
  ShiftFarmerOrderItem,
} from "@/types/farmerOrders";

// Local components
import { HeaderCard } from "./components/HeaderCard";
import { OrdersTable } from "./components/OrdersTable";
import { OrderList } from "./components/OrderList";
import { ErrorCallout } from "./components/ErrorCallout";
import FarmerOrdersStatsDialog from "./components/FarmerOrdersStatsDialog";

/* ---------- helpers ---------- */
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function isYesterdayOrEarlier(dateStr: string) {
  const todayYMD = toYMD(new Date());
  return dateStr < todayYMD;
}
function isValidShift(s: string | null): s is ShiftFarmerOrdersQuery["shiftName"] {
  if (!s) return false;
  const allowed: ShiftFarmerOrdersQuery["shiftName"][] = ["morning", "afternoon", "evening", "night"];
  return allowed.includes(s as ShiftFarmerOrdersQuery["shiftName"]);
}
function computeCounts(items: ShiftFarmerOrderItem[]) {
  let ok = 0, pending = 0, problem = 0;
  for (const it of items) {
    const status = (it as any)?.farmerStatus ?? (it as any)?.status;
    if (status === "ok") ok++;
    else if (status === "pending") pending++;
    else if (status === "problem") problem++;
  }
  return { ok, pending, problem };
}
type StatusFilterValue = "all" | "pending" | "ok" | "problem";
function filterByStatus(items: ShiftFarmerOrderItem[], status: StatusFilterValue) {
  if (status === "all") return items;
  return items.filter((it) => {
    const s = ((it as any)?.farmerStatus ?? (it as any)?.status) as string | undefined;
    return (s ?? "pending") === status;
  });
}

/* ---------- page ---------- */
export default function ShiftFarmerOrderPage() {
  const [sp] = useSearchParams();

  const date = sp.get("date");
  const shift = sp.get("shift");

  const useFake = !!date && isYesterdayOrEarlier(date);
  const fakeNum = 11;
  const paramsValid = Boolean(date && isValidShift(shift));

  const queryParams = useMemo(() => {
    if (!paramsValid) return null;
    return {
      date: date!,
      shiftName: shift as ShiftFarmerOrdersQuery["shiftName"],
      fake: useFake,
      fakeNum,
    };
  }, [date, shift, paramsValid, useFake, fakeNum]);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    enabled: !!queryParams,
    queryKey: queryParams
      ? qkFarmerOrdersByShift(queryParams as ShiftFarmerOrdersQuery & { fake?: boolean; fakeNum?: number })
      : ["farmerOrders", "byShift", "invalid"],
    queryFn: ({ signal }) =>
      getFarmerOrdersByShift(
        queryParams as ShiftFarmerOrdersQuery & { fake?: boolean; fakeNum?: number },
        { signal }
      ),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const items = data?.items ?? [];
  const counts = useMemo(() => computeCounts(items), [items]);

  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const filtered = useMemo(() => filterByStatus(items, statusFilter), [items, statusFilter]);

  const headerLoading = !(!!data || (!isPending && !isFetching));
  const listLoading = isPending;

  // stats dialog state
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <Box px={{ base: "3", md: "6" }} py={{ base: "3", md: "6" }}>
      <Stack gap="4">
        <Heading size="lg">Shift Farmer Orders</Heading>

        {!paramsValid && (
          <Alert.Root status="warning" borderRadius="md">
            <Alert.Indicator />
            <Alert.Title>
              Missing or invalid parameters. This page requires a valid <b>date</b> and <b>shift</b> in the URL.
            </Alert.Title>
          </Alert.Root>
        )}

        {/* Header: reserve space */}
        <Skeleton loading={headerLoading} borderRadius="md">
          <HeaderCard
            date={date ?? ""}
            shiftName={(shift as any) ?? ""}
            tz={data?.meta?.tz}
            okCount={counts.ok}
            pendingCount={counts.pending}
            problemCount={counts.problem}
            totalCount={items.length}
          />
        </Skeleton>

        {/* Statuses line: status filter (left) + Stats button (right) */}
        <HStack justify="space-between" align="center">
          <HStack gap="3">
            <Text color="fg.muted">Status</Text>
            <NativeSelect.Root size="sm" aria-label="Filter by status">
              <NativeSelect.Field
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
              >
                <option value="all">All (grouped)</option>
                <option value="problem">Problem only</option>
                <option value="pending">Pending only</option>
                <option value="ok">OK only</option>
              </NativeSelect.Field>
            </NativeSelect.Root>
          </HStack>

          {/* Stats button on the right side */}
          <Button
            variant="solid"
            colorPalette="teal"
            onClick={() => setStatsOpen(true)}
            leftIcon={<PieChartIcon size={16} />}
          >
            Stats
          </Button>
        </HStack>

        {/* Error */}
        {isError && (
          <ErrorCallout
            title="Failed to load farmer orders for this shift"
            description={(error as any)?.message ?? "Please try again."}
            onRetry={() => refetch()}
          />
        )}

        {/* List area */}
        <Skeleton loading={listLoading} borderRadius="md">
          {statusFilter === "all" ? (
            <OrderList items={items} />
          ) : (
            <OrdersTable items={filtered} />
          )}
        </Skeleton>
      </Stack>

      {/* Stats dialog */}
      <FarmerOrdersStatsDialog
        open={statsOpen}
        onOpenChange={setStatsOpen}
        date={date ?? ""}
        shiftName={(shift as any) ?? ""}
        items={items}
      />
    </Box>
  );
}
