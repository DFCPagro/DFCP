import { Card, HStack, Heading, Table, Badge, Button, Text } from "@chakra-ui/react";
import { Package } from "lucide-react";
import type { ReadyOrder } from "../types";

export default function ReadyOrdersTable({ orders, onClaim }: { orders: ReadyOrder[]; onClaim: (id: string) => void }) {
  return (
    <Card.Root>
      <Card.Header>
        <HStack gap={2}>
          <Package size={18} />
          <Heading size="sm">Orders Ready to Pick</Heading>
          <Badge>{orders.length}</Badge>
        </HStack>
      </Card.Header>
      <Card.Body>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Order</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Items</Table.ColumnHeader>
              <Table.ColumnHeader>Zone</Table.ColumnHeader>
              <Table.ColumnHeader>Ready</Table.ColumnHeader>
              <Table.ColumnHeader>Priority</Table.ColumnHeader>
              <Table.ColumnHeader />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {orders.map((o) => (
              <Table.Row key={o.id}>
                <Table.Cell>{o.orderId}</Table.Cell>
                <Table.Cell textAlign="end">{o.items}</Table.Cell>
                <Table.Cell>{o.zone}</Table.Cell>
                <Table.Cell>{o.readyForMin} min</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={o.priority === "rush" ? "red" : "gray"}>{o.priority}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Button size="sm" onClick={() => onClaim(o.id)}>Start picking</Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>

        {orders.length === 0 && (
          <HStack mt={3}><Text>No orders in queue.</Text></HStack>
        )}
      </Card.Body>
    </Card.Root>
  );
}
