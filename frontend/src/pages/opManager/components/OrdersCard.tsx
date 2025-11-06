// frontend/src/pages/opManager/components/OrdersCard.tsx
import * as React from "react";
import { Card, HStack, Heading, Spinner, Alert, Text, Badge, Box, Table, Button } from "@chakra-ui/react";

export type OrderLite = {
  _id: string;
  items?: Array<{ itemId: string; name?: string; quantityKg?: number; units?: number }>;
};

export default function OrdersCard({
  orders,
  total,
  isLoading,
  errorMsg,
  onPack,
  canPack,
  isPacking,
}: {
  orders: OrderLite[];
  total: number;
  isLoading?: boolean;
  errorMsg?: string | null;
  onPack: () => void;
  canPack: boolean;
  isPacking: boolean;
}) {
  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between" align="center">
          <Heading size="md">Orders in Shift</Heading>
          <Button colorPalette="blue" onClick={onPack} loading={isPacking} disabled={!canPack || !!isLoading}>
            Pack (Generate Picker Tasks)
          </Button>
        </HStack>
      </Card.Header>
      <Card.Body>
        {isLoading ? (
          <Spinner />
        ) : errorMsg ? (
          <Alert.Root status="error">
            <Alert.Description>{errorMsg}</Alert.Description>
          </Alert.Root>
        ) : (
          <>
            <Text mb={3}>
              Total orders: <Badge>{total}</Badge>
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
                  {(orders || []).map((o) => (
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
  );
}
