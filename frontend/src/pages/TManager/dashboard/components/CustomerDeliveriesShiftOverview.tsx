import * as React from "react"
import {
  Badge,
  Button,
  Card,
  HStack,
  Heading,
  Skeleton,
  Spinner,
  Stack,
  Table,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { Eye } from "lucide-react"

// -----------------------------------------------------------------------------
// API imports — replace these with your real endpoints
// -----------------------------------------------------------------------------
import {
  getCustomerDeliveriesSummary,
  getCustomerDeliveriesByShift,
  type CustomerDeliveryShiftSummary,
  type CustomerDeliveryDTO,
  type ShiftName,
} from "@/api/customerDelivery"

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CustomerDeliveriesShiftOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-delivery-dashboard-summary"],
    queryFn: () => getCustomerDeliveriesSummary(),
  })

  if (isLoading) {
    return <Skeleton height="200px" w="full" />
  }

  const shifts: CustomerDeliveryShiftSummary[] = data ?? []

  return (
    <Stack gap="6">
      {shifts.map((shift) => (
        <Card.Root key={shift.shift} variant="outline" p={4}>
          <Stack gap="4">
            <HStack justify="space-between">
              <Heading size="md">
                {shift.shiftLabel} — {shift.total} Deliveries
              </Heading>

              <Badge colorPalette={shift.total > 0 ? "green" : "gray"}>
                {shift.statusLabel}
              </Badge>
            </HStack>

            {/* Table */}
            <CustomerDeliveriesTable shift={shift.shift} />
          </Stack>
        </Card.Root>
      ))}
    </Stack>
  )
}

// -----------------------------------------------------------------------------
// Table for a shift
// -----------------------------------------------------------------------------

function CustomerDeliveriesTable({ shift }: { shift: ShiftName }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-deliveries", shift],
    queryFn: () => getCustomerDeliveriesByShift(shift),
  })

  if (isLoading) {
    return <Spinner />
  }

  const rows: CustomerDeliveryDTO[] = data ?? []

  return (
    <Table.Root width="full" size="sm">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Customer</Table.ColumnHeader>
          <Table.ColumnHeader>Address</Table.ColumnHeader>
          <Table.ColumnHeader>Orders</Table.ColumnHeader>
          <Table.ColumnHeader>Driver</Table.ColumnHeader>
          <Table.ColumnHeader>Status</Table.ColumnHeader>
          <Table.ColumnHeader />
        </Table.Row>
      </Table.Header>

      <Table.Body>
        {rows.map((row) => (
          <Table.Row key={row.id}>
            <Table.Cell>{row.customerName}</Table.Cell>
            <Table.Cell>{row.address}</Table.Cell>
            <Table.Cell>{row.orderCount}</Table.Cell>
            <Table.Cell>{row.driverName ?? "Unassigned"}</Table.Cell>
            <Table.Cell>
              <Badge
                colorPalette={
                  row.status === "pending"
                    ? "yellow"
                    : row.status === "in_progress"
                    ? "blue"
                    : row.status === "done"
                    ? "green"
                    : "gray"
                }
              >
                {row.status}
              </Badge>
            </Table.Cell>
            <Table.Cell>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Eye size={16} />}
                onClick={() =>
                  console.log("navigate to details page", row.id)
                }
              >
                View
              </Button>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  )
}
