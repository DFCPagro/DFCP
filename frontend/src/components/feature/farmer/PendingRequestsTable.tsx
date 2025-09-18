import  { useMemo } from "react";
import { Box, Button, Heading, HStack, Text, Table } from "@chakra-ui/react";
import type { ShipmentRequest } from "@/types/farmer";
import { fmt } from "@/helpers/datetime";

type Props = { rows: ShipmentRequest[]; onApprove: (row: ShipmentRequest) => void };

export default function PendingRequestsTable({ rows, onApprove }: Props) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(a.pickupTimeISO).getTime() - new Date(b.pickupTimeISO).getTime()),
    [rows]
  );

  return (
    <Box>
      <Heading size="md" mt={8} mb={3}>Pending Shipment Requests</Heading>

      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Item</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Amount (kg)</Table.ColumnHeader>
            <Table.ColumnHeader>Pickup Time</Table.ColumnHeader>
            <Table.ColumnHeader>Notes</Table.ColumnHeader>
            <Table.ColumnHeader>Action</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {sorted.map((r) => (
            <Table.Row key={r.id}>
              <Table.Cell>{r.itemName}</Table.Cell>
              <Table.Cell textAlign="end">{r.requestedKg.toLocaleString()}</Table.Cell>
              <Table.Cell>{fmt(r.pickupTimeISO)}</Table.Cell>
              <Table.Cell>{r.notes || "—"}</Table.Cell>
              <Table.Cell>
                <Button size="sm" colorPalette="green" onClick={() => onApprove(r)}>Approve</Button>
              </Table.Cell>
            </Table.Row>
          ))}

          {sorted.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={5}><Text color="fg.muted">No pending requests.</Text></Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table.Root>

      <HStack justify="flex-end" mt={3}>
        <Button variant="outline" size="sm">View All Shipments</Button>
      </HStack>
    </Box>
  );
}

