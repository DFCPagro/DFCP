import { Box, Table, Badge, HStack, Text, Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type { CSOrder } from "@/types/cs.orders";

export function OrdersTable({ items }: { items: CSOrder[] }) {
  const navigate = useNavigate();

  return (
    <Box borderWidth="1px" borderRadius="md" overflowX="auto">
      <Table.Root size="sm" w="full">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>#</Table.ColumnHeader>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
            <Table.ColumnHeader>Customer</Table.ColumnHeader>
            <Table.ColumnHeader>Address</Table.ColumnHeader>
            <Table.ColumnHeader>Created</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
            <Table.ColumnHeader />
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {items.map((o) => (
            <Table.Row key={o.id}>
              <Table.Cell>
                <HStack>
                  <Text fontWeight="medium">#{o.orderId}</Text>
                </HStack>
              </Table.Cell>

              <Table.Cell>
                <Badge colorPalette={o.status === "problem" ? "red" : "blue"}>
                  {o.status}
                </Badge>
              </Table.Cell>

              <Table.Cell>{o.customerName ?? "-"}</Table.Cell>

              <Table.Cell>
                {o.deliveryAddress
                  ? [o.deliveryAddress.street, o.deliveryAddress.city]
                      .filter(Boolean)
                      .join(", ")
                  : "-"}
              </Table.Cell>

              <Table.Cell>{o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}</Table.Cell>

              <Table.Cell textAlign="end">
                {typeof o.totalPrice === "number" ? o.totalPrice.toFixed(2) : "-"}
              </Table.Cell>

              <Table.Cell>
                <Button size="xs" onClick={() => navigate(`/cs/orders/${o.id}`)}>
                  Open
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
