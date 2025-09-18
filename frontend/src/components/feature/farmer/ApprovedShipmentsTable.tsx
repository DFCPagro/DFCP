import  { useMemo } from "react";
import {
  Box, Button, Heading, HStack, Text,
  Table,
} from "@chakra-ui/react";
import { Clock } from "lucide-react";
import type { Shipment } from "@/types/farmer";
import { fmt } from "@/helpers/datetime";

type Props = { rows: Shipment[]; onStart: (row: Shipment) => void };

export default function ApprovedShipmentsTable({ rows, onStart }: Props) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(a.pickupTimeISO).getTime() - new Date(b.pickupTimeISO).getTime()),
    [rows]
  );

  return (
    <Box>
      <Heading size="md" mb={3}>
        Approved Shipments <Text as="span" color="fg.muted">(Next Pickup First)</Text>
      </Heading>

      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Item Name</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Amount (kg)</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Containers</Table.ColumnHeader>
            <Table.ColumnHeader>Pickup Time</Table.ColumnHeader>
            <Table.ColumnHeader>Location</Table.ColumnHeader>
            <Table.ColumnHeader>Action</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {sorted.map((s) => (
            <Table.Row key={s.id}>
              <Table.Cell>{s.itemName}</Table.Cell>
              <Table.Cell textAlign="end">{s.amountKg.toLocaleString()}</Table.Cell>
              <Table.Cell textAlign="end">{s.containerCount}</Table.Cell>
              <Table.Cell>
                <HStack gap={2}><Clock size={14} /><Text>{fmt(s.pickupTimeISO)}</Text></HStack>
              </Table.Cell>
              <Table.Cell>{s.location}</Table.Cell>
              <Table.Cell>
                <Button size="sm" onClick={() => onStart(s)}>Start Preparing</Button>
              </Table.Cell>
            </Table.Row>
          ))}

          {sorted.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={6}><Text color="fg.muted">No approved shipments yet.</Text></Table.Cell>
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

