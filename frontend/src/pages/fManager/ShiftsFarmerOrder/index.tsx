// Page: Farmer Manager • Shift -> Farmer Orders
// - Reads ?date=YYYY-MM-DD&shift=morning|afternoon|evening|night from URL
// - Fetches farmer orders for that shift
// - Computes ok/pending/problem counts client-side
// - Renders:
//    • HeaderCard (display-only)
//    • Status Filter (All | pending | ok | problem)
//    • Grouped or Flat view:
//         - All  -> <OrderList> (grouped by itemId; problem-first inside component)
//         - Else -> <OrdersTable> (flat, filtered by status)
// - Centralized loading/error/empty handling remains here.
//
// Dependencies: React Router v6, TanStack Query v5, Chakra UI v3
//
// TODO(next):
//  - Optional CSV export
//  - Persist selected status filter to URL if desired

import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Box,
  Stack,
  Heading,
  Skeleton,
  Alert,
  HStack,
  Text,
  NativeSelect,
} from "@chakra-ui/react"
import { getFarmerOrdersByShift, qkFarmerOrdersByShift } from "@/api/farmerOrders"
import type {
  ShiftFarmerOrdersQuery,
  ShiftFarmerOrdersResponse,
  ShiftFarmerOrderItem,
} from "@/types/farmerOrders"

// Local components (create under ./components/)
import { HeaderCard } from "./components/HeaderCard"
import { OrdersTable } from "./components/OrdersTable"
import { OrderList } from "./components/OrderList"
import { ErrorCallout } from "./components/ErrorCallout"

// ---------- helpers ----------
function isValidShift(s: string | null): s is ShiftFarmerOrdersQuery["shiftName"] {
  if (!s) return false
  const allowed: ShiftFarmerOrdersQuery["shiftName"][] = ["morning", "afternoon", "evening", "night"]
  return allowed.includes(s as ShiftFarmerOrdersQuery["shiftName"])
}

function computeCounts(items: ShiftFarmerOrderItem[]) {
  let ok = 0,
    pending = 0,
    problem = 0
  for (const it of items) {
    const status = (it as any)?.farmerStatus ?? (it as any)?.status
    if (status === "ok") ok++
    else if (status === "pending") pending++
    else if (status === "problem") problem++
  }
  return { ok, pending, problem }
}

type StatusFilterValue = "all" | "pending" | "ok" | "problem"

function filterByStatus(items: ShiftFarmerOrderItem[], status: StatusFilterValue) {
  if (status === "all") return items
  return items.filter((it) => {
    const s = ((it as any)?.farmerStatus ?? (it as any)?.status) as string | undefined
    return (s ?? "pending") === status
  })
}

// ---------- page ----------
export default function ShiftFarmerOrderPage() {
  const [sp] = useSearchParams()

  const date = sp.get("date")
  const shift = sp.get("shift")

  // Validate required params; keep page stable + informative if missing
  const paramsValid = Boolean(date && isValidShift(shift))

  const queryParams: ShiftFarmerOrdersQuery | null = useMemo(() => {
    if (!paramsValid) return null
    return {
      date: date!, // validated above
      shiftName: shift as ShiftFarmerOrdersQuery["shiftName"],
      // v1: we intentionally skip page/limit to fetch all (server can ignore)
    }
  }, [date, shift, paramsValid])

  const { data, isPending, isError, error, refetch, isFetching } =
    useQuery<ShiftFarmerOrdersResponse>({
      enabled: !!queryParams,
      queryKey: queryParams ? qkFarmerOrdersByShift(queryParams) : ["farmerOrders", "byShift", "invalid"],
      queryFn: ({ signal }) => getFarmerOrdersByShift(queryParams as ShiftFarmerOrdersQuery, { signal }),
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    })

  const items = data?.items ?? []
  const counts = useMemo(() => computeCounts(items), [items])

  // UI: status filter — "All" => grouped view; otherwise flat filtered table
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all")
  const filtered = useMemo(() => filterByStatus(items, statusFilter), [items, statusFilter])

  // Chakra v3 Skeleton uses `loading` (true shows skeleton, false shows children)
  const headerLoading = !(!!data || (!isPending && !isFetching))
  const listLoading = isPending

  // ---------- render ----------
  return (
    <Box px={{ base: "3", md: "6" }} py={{ base: "3", md: "6" }}>
      <Stack gap="4">
        <Heading size="lg">Shift Farmer Orders</Heading>

        {/* Missing or invalid URL params */}
        {!paramsValid && (
          <Alert.Root status="warning" borderRadius="md">
            <Alert.Indicator />
            <Alert.Title>
              Missing or invalid parameters. This page requires a valid <b>date</b> and <b>shift</b> in the URL.
            </Alert.Title>
          </Alert.Root>
        )}

        {/* Header: always reserve space to avoid layout jank */}
        <Skeleton loading={headerLoading} borderRadius="md">
          <HeaderCard
            date={date ?? ""}
            shiftName={(shift as any) ?? ""}
            tz={data?.meta?.tz}
            // counts computed on client
            okCount={counts.ok}
            pendingCount={counts.pending}
            problemCount={counts.problem}
            // optional: total items
            totalCount={items.length}
          />
        </Skeleton>

        {/* Controls (centralized) */}

        <HStack justify="space-between" align="center">
          <Text fontWeight="semibold">View</Text>

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
        </HStack>


        {/* Error */}
        {isError && (
          <ErrorCallout
            title="Failed to load farmer orders for this shift"
            description={(error as any)?.message ?? "Please try again."}
            onRetry={() => refetch()}
          />
        )}

        {/* List area (grouped when 'all', otherwise flat filtered table) */}
        <Skeleton loading={listLoading} borderRadius="md">
          {statusFilter === "all" ? (
            <OrderList
              items={items}

            />
          ) : (
            <OrdersTable
              items={filtered}

            />
          )}
        </Skeleton>
      </Stack>
    </Box>
  )
}
