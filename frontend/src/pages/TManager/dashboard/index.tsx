// src/pages/tmanager/FarmerDeliveriesDashboard/index.tsx

import * as React from "react"
import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Heading,
  IconButton,
  Separator,
  Skeleton,
  Spinner,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, Loader2, RefreshCw } from "lucide-react"

import {
  getFarmerDeliveriesByShift,
  getFarmerDeliveryDashboardSummary,
  planFarmerDeliveriesForShift,
  type FarmerDeliveryDTO,
  type FarmerDeliveryShiftSummary,
  type ShiftName,
} from "@/api/farmerDelivery"

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

function useFarmerDeliverySummary() {
  return useQuery({
    queryKey: ["farmerDeliverySummary"],
    queryFn: () =>
      getFarmerDeliveryDashboardSummary({
        count: 6, // current + next 5
      }),
    staleTime: 30_000,
  })
}

function useFarmerDeliveriesDetails(params: {
  pickUpDate?: string
  shift?: ShiftName
}) {
  const { pickUpDate, shift } = params
  const enabled = Boolean(pickUpDate && shift)

  return useQuery({
    queryKey: ["farmerDeliveriesByShift", { pickUpDate, shift }],
    queryFn: () =>
      getFarmerDeliveriesByShift({
        pickUpDate: pickUpDate!,
        shift: shift!,
      }),
    enabled,
  })
}


// -----------------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------------

export default function FarmerDeliveriesDashboardPage() {
  const [selected, setSelected] = React.useState<{
    date: string
    shift: ShiftName
  } | null>(null)

  const queryClient = useQueryClient()

  const summaryQuery = useFarmerDeliverySummary()

  const detailsQuery = useFarmerDeliveriesDetails({
    pickUpDate: selected?.date,
    shift: selected?.shift,
  })

  const planMutation = useMutation({
    mutationFn: async (p: { date: string; shift: ShiftName }) => {
      return planFarmerDeliveriesForShift({
        payload: {
          pickUpDate: p.date,
          shift: p.shift,
        },
      })
    },
    onSuccess: (_, vars) => {
      // refresh summary + details for this shift
      queryClient.invalidateQueries({
        queryKey: ["farmerDeliverySummary"],
      })
      queryClient.invalidateQueries({
        queryKey: [
          "farmerDeliveriesByShift",
          { pickUpDate: vars.date, shift: vars.shift },
        ],
      })
    },
  })

  const isPlanning = planMutation.isPending

  return (
    <Box w="full">
      <Stack gap="6">
        {/* Header */}
        <Stack gap="2">
          <Heading size="lg">Inbound Farmer Deliveries</Heading>
          <Text color="fg.muted" fontSize="sm">
            Plan and monitor industrial driver routes from farms to the logistic
            center for the current and upcoming shifts.
          </Text>
        </Stack>

        <Separator />

        {/* Summary table */}
        <Card.Root variant="outline">
          <Card.Header px="4" py="3">
            <HStack justify="space-between">
              <Heading size="sm">Shift overview (current + next 5)</Heading>
              {summaryQuery.isFetching && !summaryQuery.isLoading && (
                <HStack gap="2" fontSize="xs" color="fg.muted">
                  <Spinner size="xs" />
                  <Text>Refreshing…</Text>
                </HStack>
              )}
            </HStack>
          </Card.Header>
          <Card.Body px="0" py="0">
            {summaryQuery.isLoading ? (
              <Box p="4">
                <Skeleton height="24" />
              </Box>
            ) : summaryQuery.isError ? (
              <Box p="4">
                <Text color="red.500" fontSize="sm">
                  Failed to load farmer delivery summary.
                </Text>
              </Box>
            ) : (
              <FarmerDeliverySummaryTable
                rows={summaryQuery.data ?? []}
                onView={(row) =>
                  setSelected({
                    date: row.date,
                    shift: row.shift,
                  })
                }
                onPlan={(row) =>
                  planMutation.mutate({
                    date: row.date,
                    shift: row.shift,
                  })
                }
                isPlanning={isPlanning}
                planningTarget={planMutation.variables ?? undefined}
              />
            )}
          </Card.Body>
        </Card.Root>

        {/* Details for selected shift */}
        <FarmerDeliveryDetailsSection
          selected={selected}
          deliveries={detailsQuery.data ?? []}
          isLoading={detailsQuery.isLoading}
        />
      </Stack>
    </Box>
  )
}

// -----------------------------------------------------------------------------
// Summary table & row components
// -----------------------------------------------------------------------------

type SummaryTableProps = {
  rows: FarmerDeliveryShiftSummary[]
  onView: (row: FarmerDeliveryShiftSummary) => void
  onPlan: (row: FarmerDeliveryShiftSummary) => void
  isPlanning: boolean
  planningTarget?: { date: string; shift: ShiftName } | undefined
}

function FarmerDeliverySummaryTable({
  rows,
  onView,
  onPlan,
  isPlanning,
  planningTarget,
}: SummaryTableProps) {
  if (!rows.length) {
    return (
      <Box p="4">
        <Text fontSize="sm" color="fg.muted">
          No upcoming shifts found for farmer deliveries.
        </Text>
      </Box>
    )
  }

  return (
    <Box overflowX="auto">
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Date</Table.ColumnHeader>
            <Table.ColumnHeader>Shift</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="right">
              Farmer orders
            </Table.ColumnHeader>
            <Table.ColumnHeader textAlign="right">
              Deliveries
            </Table.ColumnHeader>
            <Table.ColumnHeader textAlign="right">
              Active deliverers
            </Table.ColumnHeader>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="right">
              Actions
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            <FarmerDeliverySummaryRow
              key={`${row.date}_${row.shift}`}
              row={row}
              onView={onView}
              onPlan={onPlan}
              isPlanning={
                isPlanning &&
                planningTarget &&
                planningTarget.date === row.date &&
                planningTarget.shift === row.shift
              }
            />
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}

function formatShiftLabel(shift: ShiftName) {
  switch (shift) {
    case "morning":
      return "Morning"
    case "afternoon":
      return "Afternoon"
    case "evening":
      return "Evening"
    case "night":
      return "Night"
    default:
      return shift
  }
}

type SummaryRowProps = {
  row: FarmerDeliveryShiftSummary
  onView: (row: FarmerDeliveryShiftSummary) => void
  onPlan: (row: FarmerDeliveryShiftSummary) => void
  isPlanning: boolean
}

function FarmerDeliverySummaryRow({
  row,
  onView,
  onPlan,
  isPlanning,
}: SummaryRowProps) {
  const hasOrders = row.farmerOrdersCount > 0
  const canPlan = hasOrders
  const statusLabel = row.hasPlan
    ? "Planned"
    : hasOrders
    ? "Needs planning"
    : "No orders"

  const statusColor = row.hasPlan ? "green" : hasOrders ? "yellow" : "gray"

  return (
    <Table.Row>
      <Table.Cell>
        <Text fontSize="sm" fontWeight="medium">
          {row.date}
        </Text>
      </Table.Cell>
      <Table.Cell>
        <Badge variant="subtle" colorPalette="blue">
          {formatShiftLabel(row.shift)}
        </Badge>
      </Table.Cell>
      <Table.Cell textAlign="right">
        <Text fontSize="sm">{row.farmerOrdersCount}</Text>
      </Table.Cell>
      <Table.Cell textAlign="right">
        <Text fontSize="sm">{row.deliveriesCount}</Text>
      </Table.Cell>
      <Table.Cell textAlign="right">
        <Text fontSize="sm">{row.activeDeliverersCount}</Text>
      </Table.Cell>
      <Table.Cell>
        <Badge variant="subtle" colorPalette={statusColor}>
          {statusLabel}
        </Badge>
      </Table.Cell>
      <Table.Cell>
        <HStack justify="flex-end" gap="2">
          <Button
            size="xs"
            variant={row.hasPlan ? "outline" : "solid"}
            colorPalette="green"
            onClick={() => onPlan(row)}
            disabled={!canPlan}
            leftIcon={
              isPlanning ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <RefreshCw size={14} />
              )
            }
          >
            {row.hasPlan ? "Rebuild plan" : "Plan"}
          </Button>

          <IconButton
            size="xs"
            variant="outline"
            aria-label="View deliveries"
            onClick={() => onView(row)}
            disabled={!row.hasPlan}
          >
            <Eye size={16} />
          </IconButton>
        </HStack>
      </Table.Cell>
    </Table.Row>
  )
}

// -----------------------------------------------------------------------------
// Details section (for selected shift)
// -----------------------------------------------------------------------------

type DetailsSectionProps = {
  selected: { date: string; shift: ShiftName } | null
  deliveries: FarmerDeliveryDTO[]
  isLoading: boolean
}

function FarmerDeliveryDetailsSection({
  selected,
  deliveries,
  isLoading,
}: DetailsSectionProps) {
  if (!selected) {
    return (
      <Box>
        <Text fontSize="sm" color="fg.muted">
          Select a shift to view its planned farmer deliveries and stops.
        </Text>
      </Box>
    )
  }

  return (
    <Card.Root variant="subtle">
      <Card.Header px="4" py="3">
        <HStack justify="space-between">
          <Heading size="sm">
            Deliveries for {selected.date} · {formatShiftLabel(selected.shift)}
          </Heading>
          {isLoading && (
            <HStack gap="2" fontSize="xs" color="fg.muted">
              <Spinner size="xs" />
              <Text>Loading deliveries…</Text>
            </HStack>
          )}
        </HStack>
      </Card.Header>
      <Card.Body px="4" py="3">
        {isLoading ? (
          <Stack gap="2">
            <Skeleton height="18" />
            <Skeleton height="18" />
          </Stack>
        ) : !deliveries.length ? (
          <Text fontSize="sm" color="fg.muted">
            No planned deliveries for this shift yet.
          </Text>
        ) : (
          <Stack gap="4">
            {deliveries.map((d) => (
              <Box
                key={d._id}
                borderWidth="1px"
                borderRadius="lg"
                p="3"
                bg="bg.subtle"
              >
                <HStack justify="space-between" mb="2">
                  <HStack gap="2">
                    <Badge variant="outline" colorPalette="purple">
                      Trip
                    </Badge>
                    <Text fontSize="sm" fontWeight="semibold">
                      {d.stops.length} stops ·{" "}
                      {d.totalExpectedContainers ?? 0} containers
                    </Text>
                  </HStack>
                  <Badge variant="subtle" colorPalette="blue">
                    {d.stageKey ?? "planned"}
                  </Badge>
                </HStack>

                <Stack gap="1">
                  {d.stops.map((s) => (
                    <HStack key={`${d._id}_${s.sequence}`} gap="3">
                      <Badge
                        size="xs"
                        variant="subtle"
                        colorPalette={
                          s.type === "pickup" ? "green" : "orange"
                        }
                      >
                        {s.type === "pickup"
                          ? "Pickup"
                          : "Dropoff"}{" "}
                        #{s.sequence + 1}
                      </Badge>
                      <Box flex="1">
                        <Text fontSize="sm" fontWeight="medium">
                          {s.label || s.farmName}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {s.farmerName} · {s.expectedContainers} containers ·{" "}
                          {Math.round(Number(s.expectedWeightKg || 0))} kg
                        </Text>
                      </Box>
                      <Text fontSize="xs" color="fg.muted">
                        {typeof s.plannedAt === "string"
                          ? s.plannedAt.slice(11, 16)
                          : new Date(s.plannedAt)
                              .toISOString()
                              .slice(11, 16)}
                      </Text>
                    </HStack>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Card.Body>
    </Card.Root>
  )
}
