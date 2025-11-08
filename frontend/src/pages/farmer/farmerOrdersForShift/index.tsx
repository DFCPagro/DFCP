// src/pages/farmer/farmerOrderForShift/index.tsx
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

export type FarmerOrderForShiftItem = {
  id: string
  itemId: string
  type: string
  variety?: string
  imageUrl?: string
  forcastedQuantityKg: number
  finalQuantityKg?: number | null
  farmerReportUrl?: string
  pickUpTime?: string | null
  farmerName?: string
  farmName?: string
}

export type FarmerOrderForShiftPayload = {
  date: string
  shift: ShiftKey
  pickUpTime?: string | null
  deliverer?: {
    id: string
    name: string
    phone?: string
    vehiclePlate?: string
    company?: string
  } | null
  items: FarmerOrderForShiftItem[]
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
): Promise<FarmerOrderForShiftPayload> {
  const sp = new URLSearchParams()
  sp.set("date", date)
  sp.set("shiftName", shift)

  const { data } = await api.get<FarmerViewByShiftResponse>(`${BASE}/by-shift?${sp.toString()}`, {
    signal: opts?.signal,
  })

  const pickUpTime = data.items.find((it) => it.pickUpTime)?.pickUpTime ?? null

  return {
    date: data.meta.date,
    shift: data.meta.shiftName,
    pickUpTime,
    deliverer: null, // not provided to farmer in this endpoint
    items: data.items.map((it) => ({
      id: it.id,
      itemId: it.itemId,
      type: it.type,
      variety: it.variety,
      imageUrl: it.imageUrl,
      forcastedQuantityKg: it.forcastedQuantityKg,
      finalQuantityKg: it.finalQuantityKg ?? null,
      farmerReportUrl: undefined,
      pickUpTime: it.pickUpTime ?? null,
      farmerName: it.farmerName,
      farmName: it.farmName,
    })),
  }
}

/* ===========================
 * Page
 * =========================== */
export default function FarmerOrderForShift() {
  const { state } = useLocation() as { state?: { group?: Partial<FarmerOrderForShiftPayload> } }
  const params = useParams<{ date: string; shift: ShiftKey }>()

  // Resolve params/state for SSR-safe date/shift
  const dateISO = React.useMemo(() => {
    const fromState = state?.group?.date
    if (fromState) return typeof fromState === "string" ? fromState : new Date(fromState).toISOString().slice(0, 10)
    return params.date || new Date().toISOString().slice(0, 10)
  }, [params.date, state?.group?.date])

  const shift = (state?.group?.shift as ShiftKey) || (params.shift as ShiftKey) || "morning"

  const { data, isLoading } = useQuery({
    queryKey: ["farmer-order-for-shift", dateISO, shift],
    queryFn: ({ signal }) => fetchFarmerOrderForShift(dateISO, shift, { signal }),
    // Instant paint from navigation state if present, then refetch server truth
    initialData: state?.group
      ? ({
          date: typeof state.group.date === "string" ? state.group.date : dateISO,
          shift: (state.group.shift as ShiftKey) || shift,
          pickUpTime: state.group.pickUpTime ?? null,
          deliverer: null,
          items: (state.group.items || []) as FarmerOrderForShiftItem[],
        } as FarmerOrderForShiftPayload)
      : undefined,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  const pickupTimeLabel = React.useMemo(() => (data?.pickUpTime ? data.pickUpTime : "TBD"), [data?.pickUpTime])

  return (
    <Box p={4}>
      <Stack gap={4}>
        <VStack align="start" gap={0}>
          <Heading size="md">Farmer Order For Shift</Heading>
          <Text color="fg.muted">
            {formatDMY(dateISO)} · {shift.charAt(0).toUpperCase() + shift.slice(1)} · Pickup {pickupTimeLabel}
          </Text>
        </VStack>

        {/* Deliverer (farmer endpoint doesn’t supply; keep placeholder) */}
        <Card.Root>
          <Card.Body p={4}>
            {isLoading ? (
              <Skeleton height="24px" />
            ) : data?.deliverer ? (
              <HStack justifyContent="space-between" alignItems="center">
                <HStack>
                  <Avatar.Root>
                    <Avatar.Fallback name={data.deliverer.name} />
                  </Avatar.Root>
                  <VStack align="start" gap={0}>
                    <Text fontWeight="semibold">Assigned deliverer</Text>
                    <Text>{data.deliverer.name}</Text>
                    <HStack>
                      {data.deliverer.phone ? <Badge>{data.deliverer.phone}</Badge> : null}
                      {data.deliverer.vehiclePlate ? <Badge>{data.deliverer.vehiclePlate}</Badge> : null}
                      {data.deliverer.company ? <Badge>{data.deliverer.company}</Badge> : null}
                    </HStack>
                  </VStack>
                </HStack>
              </HStack>
            ) : (
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
                ) : (data?.items || []).map((it) => {
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
                              {(it.farmName || it.farmerName) ? (
                                <Text fontSize="xs" color="fg.muted">
                                  {it.farmName}{it.farmName && it.farmerName ? " · " : ""}{it.farmerName}
                                </Text>
                              ) : null}
                            </VStack>
                          </HStack>
                        </Table.Cell>
                        <Table.Cell>{it.forcastedQuantityKg}</Table.Cell>
                        <Table.Cell>{it.finalQuantityKg ?? "—"}</Table.Cell>
                        <Table.Cell textAlign="end">
                          {it.farmerReportUrl ? (
                            <Link href={it.farmerReportUrl} target="_blank" rel="noreferrer">
                              Report
                            </Link>
                          ) : (
                            <Text color="fg.muted">Report</Text>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
              </Table.Body>
            </Table.Root>
          </Card.Body>
        </Card.Root>
      </Stack>
    </Box>
  )
}
