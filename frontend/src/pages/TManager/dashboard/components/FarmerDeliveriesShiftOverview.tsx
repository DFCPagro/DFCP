// src/pages/tmanager/Dashboard/components/FarmerDeliveriesShiftOverview.tsx

import * as React from "react"
import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Heading,
  IconButton,
  Skeleton,
  Spinner,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Eye, Loader2, RefreshCw } from "lucide-react"
import { useNavigate } from "react-router-dom"

import {
  getFarmerDeliveryDashboardSummary,
  planFarmerDeliveriesForShift,
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
function getDayOfWeek(dateISO: string) {
  try {
    const date = new Date(dateISO);
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  } catch {
    return "";
  }
}
// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export default function FarmerDeliveriesShiftOverview() {
  const nav = useNavigate()
  const queryClient = useQueryClient()

  const summaryQuery = useFarmerDeliverySummary()

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
      // refresh summary + (optionally) details cache for this shift
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
              nav(`/tmanager/farmer-deliveries/${row.date}/${row.shift}`)
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
  )
}

// -----------------------------------------------------------------------------
// Table + row
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
          {getDayOfWeek(row.date)} · { formatShiftLabel(row.shift)}
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
