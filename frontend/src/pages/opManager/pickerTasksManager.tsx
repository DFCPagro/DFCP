import * as React from "react"
import {
  Box,
  Stack,
  HStack,
  Heading,
  Text,
  Button,
  Badge,
  Card,
  Table,
  Spinner,
  Alert, // v3 namespace (use <Alert.Root>, <Alert.Description>)
  IconButton,
  Tooltip,
} from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { DateTime } from "luxon"
import { RefreshCw } from "lucide-react"

/* ============================
 * API helpers (no logisticCenterId)
 * ============================ */

type ShiftName = "morning" | "afternoon" | "evening" | "night"

type CurrentShiftResp = {
  shift: { shiftName: ShiftName; shiftDate: string; tz?: string }
  pagination: { page: number; limit: number; total: number }
  countsByStatus: Record<string, number>
  items: any[]
}

type PickerTasksListResp = CurrentShiftResp

async function getCurrentShiftCtx() {
  const url = new URL(`/api/pickerTasks/current`, window.location.origin)
  url.searchParams.set("limit", "1")
  const res = await fetch(url.toString(), { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to load current shift: ${res.status}`)
  const json = await res.json()
  return json.data as CurrentShiftResp
}

async function getPickerTasksForShift(params: {
  shiftName: ShiftName
  shiftDate: string // yyyy-LL-dd
  page?: number
  limit?: number
  status?: string
}) {
  const url = new URL(`/api/pickerTasks/shift`, window.location.origin)
  url.searchParams.set("shiftName", params.shiftName)
  url.searchParams.set("shiftDate", params.shiftDate)
  if (params.page) url.searchParams.set("page", String(params.page))
  if (params.limit) url.searchParams.set("limit", String(params.limit))
  if (params.status) url.searchParams.set("status", params.status)
  const res = await fetch(url.toString(), { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to load picker tasks: ${res.status}`)
  const json = await res.json()
  return json.data as PickerTasksListResp
}

async function generatePickerTasks(params: {
  shiftName: ShiftName
  shiftDate: string
}) {
  const res = await fetch(`/api/pickerTasks/generate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shiftName: params.shiftName,
      shiftDate: params.shiftDate,
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Generate failed: ${res.status} ${txt}`)
  }
  return res.json()
}

type OrderLite = {
  _id: string
  items?: Array<{ itemId: string; name?: string; quantityKg?: number; units?: number }>
}

async function getOrdersForShift(params: {
  shiftName: ShiftName
  shiftDate: string
  page?: number
  limit?: number
}) {
  const url = new URL(`/api/orders/shift`, window.location.origin)
  url.searchParams.set("shiftName", params.shiftName)
  url.searchParams.set("shiftDate", params.shiftDate)
  url.searchParams.set("page", String(params.page ?? 1))
  url.searchParams.set("limit", String(params.limit ?? 200))
  const res = await fetch(url.toString(), { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to load orders for shift: ${res.status}`)
  const json = await res.json()
  return json.data as { items: OrderLite[]; pagination: { total: number } }
}

/* ============================
 * Shift math (front-end)
 * ============================ */

const SHIFT_SEQUENCE: ShiftName[] = ["morning", "afternoon", "evening", "night"]

function nextShift(name: ShiftName): ShiftName {
  const i = SHIFT_SEQUENCE.indexOf(name)
  return SHIFT_SEQUENCE[(i + 1) % SHIFT_SEQUENCE.length]
}

function makeShiftsCurrentPlus5(params: {
  tz?: string
  baseShiftName: ShiftName
  baseShiftDate: string // yyyy-LL-dd
}): Array<{ shiftName: ShiftName; shiftDate: string; label: string }> {
  const { tz = "Asia/Jerusalem", baseShiftName, baseShiftDate } = params
  const out: Array<{ shiftName: ShiftName; shiftDate: string; label: string }> = []
  let name = baseShiftName
  let date = baseShiftDate
  let dt = DateTime.fromFormat(baseShiftDate, "yyyy-LL-dd", { zone: tz })

  for (let i = 0; i < 6; i++) {
    out.push({
      shiftName: name,
      shiftDate: date,
      label: `${date} • ${name}`,
    })

    const n = nextShift(name)
    if (name === "night" && n === "morning") {
      dt = dt.plus({ days: 1 })
    }
    name = n
    date = dt.toFormat("yyyy-LL-dd")
  }

  return out
}

/* ============================
 * UI
 * ============================ */

export default function PickerTasksManagerPage() {
  const qc = useQueryClient()

  // 1) get current shift context (server-resolved)
  const currentQ = useQuery({
    queryKey: ["pickerTasks", "currentShiftCtx"],
    queryFn: () => getCurrentShiftCtx(),
  })

  const [selected, setSelected] = React.useState<{ shiftName: ShiftName; shiftDate: string } | null>(null)

  // derive the 6 shifts (current + 5) when current context arrives
  const shifts = React.useMemo(() => {
    if (!currentQ.data?.shift) return []
    const { shiftName, shiftDate, tz } = currentQ.data.shift
    return makeShiftsCurrentPlus5({ tz, baseShiftName: shiftName, baseShiftDate: shiftDate })
  }, [currentQ.data])

  // init selected to the first (current)
  React.useEffect(() => {
    if (shifts.length && !selected) {
      setSelected({ shiftName: shifts[0].shiftName, shiftDate: shifts[0].shiftDate })
    }
  }, [shifts, selected])

  // 2) load orders for selected shift
  const ordersQ = useQuery({
    enabled: !!selected,
    queryKey: ["orders", "shift", selected?.shiftName, selected?.shiftDate],
    queryFn: () =>
      getOrdersForShift({
        shiftName: selected!.shiftName,
        shiftDate: selected!.shiftDate,
      }),
  })

  // 3) load picker tasks for selected shift
  const tasksQ = useQuery({
    enabled: !!selected,
    queryKey: ["pickerTasks", "shift", selected?.shiftName, selected?.shiftDate],
    queryFn: () =>
      getPickerTasksForShift({
        shiftName: selected!.shiftName,
        shiftDate: selected!.shiftDate,
        limit: 500,
      }),
  })

  // 4) mutation: pack (generate tasks) for selected shift
  const packMut = useMutation({
    mutationFn: () =>
      generatePickerTasks({
        shiftName: selected!.shiftName,
        shiftDate: selected!.shiftDate,
      }),
    onSuccess: () => {
      // refresh tasks (and counts) after generation
      qc.invalidateQueries({ queryKey: ["pickerTasks", "shift", selected?.shiftName, selected?.shiftDate] })
      qc.invalidateQueries({ queryKey: ["pickerTasks", "currentShiftCtx"] })
    },
  })

  return (
    <Stack gap={6}>
      <HStack justify="space-between">
        <Heading size="lg">Picker Tasks</Heading>

        {/* Tooltip v3 slot API */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <IconButton
              aria-label="refresh"
              size="sm"
              variant="ghost"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["pickerTasks", "currentShiftCtx"] })
                if (selected) {
                  qc.invalidateQueries({ queryKey: ["orders", "shift", selected.shiftName, selected.shiftDate] })
                  qc.invalidateQueries({ queryKey: ["pickerTasks", "shift", selected.shiftName, selected.shiftDate] })
                }
              }}
             
            />
          </Tooltip.Trigger>
          <Tooltip.Positioner>
            <Tooltip.Content>
              Refresh
              <Tooltip.Arrow />
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>
      </HStack>

      {/* Shift strip */}
      <Card.Root>
        <Card.Header>
          <HStack justify="space-between">
            <Heading size="md">Shifts (current + 5)</Heading>
            {currentQ.isLoading && <Spinner size="sm" />}
          </HStack>
        </Card.Header>
        <Card.Body>
          {currentQ.isError && (
            <Alert.Root status="error" mb={4}>
              <Alert.Description>
                {(currentQ.error as Error)?.message || "Failed to load current shift"}
              </Alert.Description>
            </Alert.Root>
          )}
          <HStack wrap="wrap" gap={3}>
            {shifts.map((s) => {
              const isActive = selected?.shiftName === s.shiftName && selected?.shiftDate === s.shiftDate
              return (
                <Button
                  key={`${s.shiftDate}_${s.shiftName}`}
                  variant={isActive ? "solid" : "outline"}
                  onClick={() => setSelected({ shiftName: s.shiftName, shiftDate: s.shiftDate })}
                  size="sm"
                >
                  {s.label}
                </Button>
              )
            })}
          </HStack>
        </Card.Body>
      </Card.Root>

      {/* Orders + Pack */}
      <Card.Root>
        <Card.Header>
          <HStack justify="space-between" align="center">
            <Heading size="md">Orders in Shift</Heading>
            <Button
              colorPalette="blue"
              onClick={() => packMut.mutate()}
              loading={packMut.isPending}
              disabled={!selected || ordersQ.isLoading}
            >
              Pack (Generate Picker Tasks)
            </Button>
          </HStack>
        </Card.Header>
        <Card.Body>
          {ordersQ.isLoading ? (
            <Spinner />
          ) : ordersQ.isError ? (
            <Alert.Root status="error">
              <Alert.Description>
                {(ordersQ.error as Error)?.message || "Failed to load orders"}
              </Alert.Description>
            </Alert.Root>
          ) : (
            <>
              <Text mb={3}>
                Total orders: <Badge>{ordersQ.data?.pagination?.total ?? ordersQ.data?.items?.length ?? 0}</Badge>
              </Text>
              <Box overflowX="auto">
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Order ID</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Lines</Table.ColumnHeader>
                      <Table.ColumnHeader>Items (preview)</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {(ordersQ.data?.items || []).map((o) => (
                      <Table.Row key={o._id}>
                        <Table.Cell>{o._id}</Table.Cell>
                        <Table.Cell textAlign="end">{o.items?.length ?? 0}</Table.Cell>
                        <Table.Cell>
                          <HStack wrap="wrap" gap={2}>
                            {(o.items || []).slice(0, 4).map((it, idx) => (
                              <Badge key={idx} variant="subtle">
                                {it.name || it.itemId}
                                {typeof it.quantityKg === "number" && it.quantityKg > 0 ? ` • ${it.quantityKg}kg` : ""}
                                {typeof it.units === "number" && it.units > 0 ? ` • ${it.units}u` : ""}
                              </Badge>
                            ))}
                            {(o.items || []).length > 4 && <Badge>+{(o.items || []).length - 4} more</Badge>}
                          </HStack>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            </>
          )}
        </Card.Body>
      </Card.Root>

      {/* Picker Tasks */}
      <Card.Root>
        <Card.Header>
          <HStack justify="space-between" align="center">
            <Heading size="md">Picker Tasks</Heading>
            <HStack>
              {tasksQ.data?.countsByStatus &&
                Object.entries(tasksQ.data.countsByStatus).map(([k, v]) => (
                  <Badge key={k} variant="outline">
                    {k}: {v}
                  </Badge>
                ))}
            </HStack>
          </HStack>
        </Card.Header>
        <Card.Body>
          {tasksQ.isLoading ? (
            <Spinner />
          ) : tasksQ.isError ? (
            <Alert.Root status="error">
              <Alert.Description>
                {(tasksQ.error as Error)?.message || "Failed to load tasks"}
              </Alert.Description>
            </Alert.Root>
          ) : (
            <>
              <Text mb={3}>
                Total tasks: <Badge>{tasksQ.data?.pagination?.total ?? tasksQ.data?.items?.length ?? 0}</Badge>
              </Text>
              <Box overflowX="auto">
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Status</Table.ColumnHeader>
                      <Table.ColumnHeader>Order</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Box #</Table.ColumnHeader>
                      <Table.ColumnHeader>Box Type</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Est Kg</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Est Units</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">Liters</Table.ColumnHeader>
                      <Table.ColumnHeader>Contents</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {(tasksQ.data?.items || []).map((t: any) => (
                      <Table.Row key={`${t.orderId}_${t.boxNo}`}>
                        <Table.Cell>
                          <Badge colorPalette={badgeColorForStatus(t.status)}>{t.status}</Badge>
                        </Table.Cell>
                        <Table.Cell>{t.orderId}</Table.Cell>
                        <Table.Cell textAlign="end">{t.boxNo}</Table.Cell>
                        <Table.Cell>{t.boxType}</Table.Cell>
                        <Table.Cell textAlign="end">{fmtNum(t.totalEstKg)}</Table.Cell>
                        <Table.Cell textAlign="end">{fmtNum(t.totalEstUnits)}</Table.Cell>
                        <Table.Cell textAlign="end">{fmtNum(t.totalLiters)}</Table.Cell>
                        <Table.Cell>
                          <HStack wrap="wrap" gap={2}>
                            {(t.contents || []).slice(0, 4).map((c: any, idx: number) => (
                              <Badge key={idx} variant="subtle">
                                {c.name} {typeof c.estWeightKgPiece === "number" ? `• ${c.estWeightKgPiece}kg` : ""}
                                {typeof c.estUnitsPiece === "number" ? `• ${c.estUnitsPiece}u` : ""}
                              </Badge>
                            ))}
                            {(t.contents || []).length > 4 && <Badge>+{(t.contents || []).length - 4} more</Badge>}
                          </HStack>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Box>
            </>
          )}
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}

/* ============================
 * Utilities
 * ============================ */

function fmtNum(n: any) {
  if (!Number.isFinite(n)) return "-"
  return Math.round(n * 100) / 100
}

function badgeColorForStatus(s?: string) {
  switch (s) {
    case "ready":
      return "green"
    case "claimed":
      return "purple"
    case "in_progress":
      return "orange"
    case "open":
      return "gray"
    case "problem":
      return "red"
    case "cancelled":
      return "gray"
    case "done":
      return "blue"
    default:
      return "gray"
  }
}
