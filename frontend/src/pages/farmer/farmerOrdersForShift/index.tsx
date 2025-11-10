import * as React from "react"
import {
  Box,
  Stack,
  HStack,
  VStack,
  Text,
  Heading,
  Badge,
  Avatar,
  Table,
  Link,
  Card,
  Separator,
  Skeleton,
} from "@chakra-ui/react"
import { useLocation, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { formatDMY } from "@/utils/date"
import { api } from "@/api/config"
import { fetchShiftWindows } from "@/api/shifts"

/* ===========================
 * Local types for this page
 * =========================== */
export type ShiftKey = "morning" | "afternoon" | "evening" | "night"

type FarmerViewByShiftResponse = {
  meta: {
    lc: string
    date: string
    shiftName: ShiftKey
    tz: string
    page: number
    limit: number
    total: number
    pages: number
    problemCount: number
    scopedToFarmer?: boolean
    forFarmerView?: boolean
  }
  items: Array<{
    id: string
    itemId: string
    type: string
    variety?: string
    imageUrl?: string
    farmerName: string
    farmName: string
    shift: ShiftKey
    pickUpDate: string
    pickUpTime?: string | null
    logisticCenterId: string
    farmerStatus: string
    orderedQuantityKg: number
    forcastedQuantityKg: number
    finalQuantityKg?: number | null
    containers: string[]
    containerSnapshots: any[]
    stageKey: string | null
    farmersQSreport?: any
    inspectionQSreport?: any
    visualInspection?: any
    inspectionStatus: "pending" | "passed" | "failed"
  }>
}

/* ===========================
 * API call (farmer view)
 * baseURL must include /api/v1 in api config.
 * =========================== */
const BASE = "/farmer-orders"

async function fetchFarmerOrderForShift(
  date: string,
  shift: ShiftKey,
  opts?: { signal?: AbortSignal },
): Promise<FarmerViewByShiftResponse> {
  const sp = new URLSearchParams()
  sp.set("date", date)
  sp.set("shiftName", shift)

  const { data } = await api.get<FarmerViewByShiftResponse>(`${BASE}/by-shift?${sp.toString()}`, {
    signal: opts?.signal,
  })

  return data
}

/* ===========================
 * Helpers – countdown
 * =========================== */

/** Convert minutes since midnight to "HH:mm" */
function minsToHHmm(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(h)}:${pad(m)}`
}

/** Combine ISO date (YYYY-MM-DD) and "HH:mm" into a Date in the local timezone */
function combineDateTimeLocal(dateISO: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10))
  const d = new Date(dateISO + "T00:00:00")
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/* ===========================
 * Page
 * =========================== */
export default function FarmerOrderForShift() {
  const { state } = useLocation() as { state?: { group?: Partial<{ date: string; shift: ShiftKey }> } }
  const params = useParams<{ date: string; shift: ShiftKey }>()

  // Resolve params/state for SSR-safe date/shift
  const dateISO = React.useMemo(() => {
    const fromState = state?.group?.date
    if (fromState) return typeof fromState === "string" ? fromState : new Date(fromState).toISOString().slice(0, 10)
    return params.date || new Date().toISOString().slice(0, 10)
  }, [params.date, state?.group?.date])

  const shift = (state?.group?.shift as ShiftKey) || (params.shift as ShiftKey) || "morning"

  const {
    data,
    isLoading,
  } = useQuery({
    queryKey: ["farmer-order-for-shift", dateISO, shift],
    queryFn: ({ signal }) => fetchFarmerOrderForShift(dateISO, shift, { signal }),
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  // Derive LC for shift APIs (prefer meta.lc, fallback to first item)
  const logisticCenterId = React.useMemo(() => {
    const lc = data?.meta?.lc || data?.items?.[0]?.logisticCenterId || ""
    // DEBUG: make it clear in console when this value flips truthy
    if (lc) console.debug("[FarmerOrderForShift] Resolved logisticCenterId:", lc)
    return lc
  }, [data?.meta?.lc, data?.items])

  const windowsEnabled = !!logisticCenterId

  // NOTE: If you don't see this being logged, `windowsEnabled` is false (no LC yet)
  if (!windowsEnabled) {
    console.debug("[FarmerOrderForShift] Shift windows query disabled (no logisticCenterId yet)")
  }

  // Fetch all shift windows for LC (to get the official start time of the selected shift)
  const {
    data: windows,
    isLoading: isWindowsLoading,
  } = useQuery({
    enabled: windowsEnabled,
    queryKey: ["shift-windows-all", logisticCenterId],
    queryFn: async () => {
      console.debug("[FarmerOrderForShift] Calling fetchShiftWindows for lc:", logisticCenterId)
      const res = await fetchShiftWindows(logisticCenterId)
      console.debug("[FarmerOrderForShift] Shift windows loaded:", res)
      return res
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  const currentShiftWindow = React.useMemo(() => {
    if (!windows) return null
    // windows is an array of { name, timezone, general: { startMin, endMin }, ... }
    const row = (windows as any[]).find((w) => w.name === shift)
    return row || null
  }, [windows, shift])

  // Build target start datetime:
  // - Preferred: official general.startMin from /shifts/windows/all for this LC + dateISO
  // - Fallback: API's pickUpTime per item if present (use the first item's pickUpTime)
  const pickupTimeFromItems = React.useMemo(() => {
    const it = data?.items?.find((x) => x.pickUpTime)
    return it?.pickUpTime ?? null
  }, [data?.items])

  const targetStart = React.useMemo(() => {
    if (currentShiftWindow?.general?.startMin != null) {
      const hhmm = minsToHHmm(currentShiftWindow.general.startMin)
      return combineDateTimeLocal(dateISO, hhmm)
    }
    if (pickupTimeFromItems) {
      return combineDateTimeLocal(dateISO, pickupTimeFromItems)
    }
    return combineDateTimeLocal(dateISO, "00:00")
  }, [currentShiftWindow, dateISO, pickupTimeFromItems])

  const effectivePickupLabel = React.useMemo(() => {
    if (currentShiftWindow?.general?.startMin != null) {
      return minsToHHmm(currentShiftWindow.general.startMin)
    }
    return pickupTimeFromItems ?? "TBD"
  }, [currentShiftWindow, pickupTimeFromItems])

  // Live ticking countdown
  const [now, setNow] = React.useState<Date>(() => new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const diffMs = React.useMemo(() => targetStart.getTime() - now.getTime(), [targetStart, now])
  const countdownText = React.useMemo(() => formatDuration(diffMs), [diffMs])
  const countdownState = diffMs >= 0 ? "upcoming" : "past"

  return (
    <Box p={4}>
      <Stack gap={4}>
        <VStack align="start" gap={0}>
          <Heading size="md">Farmer Order For Shift</Heading>
          <Text color="fg.muted">
            {formatDMY(dateISO)} · {shift.charAt(0).toUpperCase() + shift.slice(1)} · Pickup {effectivePickupLabel}
          </Text>

          {/* Countdown (uses official shift windows when available) */}
          <HStack mt="1" gap="2" alignItems="center">
            <Text fontWeight="semibold">Countdown:</Text>
            {isLoading || (windowsEnabled && isWindowsLoading) ? (
              <Skeleton height="20px" width="140px" />
            ) : (
              <Badge
                colorPalette={countdownState === "upcoming" ? "green" : "red"}
                variant="subtle"
                fontFamily="mono"
                fontSize="sm"
              >
                {countdownState === "upcoming" ? `${countdownText} to start` : `${countdownText} since start`}
              </Badge>
            )}
          </HStack>
        </VStack>

        {/* Deliverer (farmer endpoint doesn’t supply; keep placeholder) */}
        <Card.Root>
          <Card.Body p={4}>
            {isLoading ? (
              <Skeleton height="24px" />
            ) : null}
            {!isLoading && (
              <VStack align="start">
                <Text fontWeight="semibold">Assigned deliverer</Text>
                <Badge colorPalette="gray">Not assigned yet</Badge>
              </VStack>
            )}
          </Card.Body>
        </Card.Root>

        <Separator />

        {/* Items */}
        <Card.Root>
          <Card.Body p={4}>
            <Heading size="sm" mb={3}>
              Items
            </Heading>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Item</Table.ColumnHeader>
                  <Table.ColumnHeader>Forecasted (kg)</Table.ColumnHeader>
                  <Table.ColumnHeader>Final (kg)</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {isLoading ? (
                  <Table.Row>
                    <Table.Cell colSpan={4}>
                      <Skeleton height="20px" />
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  (data?.items || []).map((it) => {
                    const displayName = `${it.type}${it.variety ? ` ${it.variety}` : ""}`
                    return (
                      <Table.Row key={it.id}>
                        <Table.Cell>
                          <HStack>
                            <Avatar.Root size="sm">
                              {it.imageUrl ? <Avatar.Image src={it.imageUrl} alt={displayName} /> : null}
                              <Avatar.Fallback name={displayName} />
                            </Avatar.Root>
                            <VStack align="start" gap={0}>
                              <Text>{displayName}</Text>
                              {/* Optional subtext */}
                              {it.farmName || it.farmerName ? (
                                <Text fontSize="xs" color="fg.muted">
                                  {it.farmName}
                                  {it.farmName && it.farmerName ? " · " : ""}
                                  {it.farmerName}
                                </Text>
                              ) : null}
                            </VStack>
                          </HStack>
                        </Table.Cell>
                        <Table.Cell>{it.forcastedQuantityKg}</Table.Cell>
                        <Table.Cell>{it.finalQuantityKg ?? "—"}</Table.Cell>
                        <Table.Cell textAlign="end">
                          <Link
                            href={`http://localhost:5173/farmer/farmer-order-report?id=${it.id}`}
                            color="blue.500"
                            fontWeight="medium"
                          >
                            Report
                          </Link>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })
                )}
              </Table.Body>
            </Table.Root>
          </Card.Body>
        </Card.Root>
      </Stack>
    </Box>
  )
}
