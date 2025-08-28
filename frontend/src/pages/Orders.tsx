// orders.tsx
import * as React from "react";
import { Table, Box, Badge, Button, HStack, Heading, Text } from "@chakra-ui/react";
import { useColorModeValue } from "@/components/ui/color-mode"; // from your v3 snippet
import QRCode from "react-qr-code";

export const demoOrders = [
  {
    orderNo: "X-2025-000001",
    status: "out_for_delivery",
    consumerName: "Alice Consumer",
    deliverySlot: new Date().toISOString(),
    items: [
      { productId: "tomato", quantity: 1000, unit: "kg" },
      { productId: "cucumber", quantity: 1500, unit: "kg" },
    ],
    customerUrl: "http://localhost:5173/r/abc123",
  },
  {
    orderNo: "X-2025-000002",
    status: "confirmed",
    consumerName: "Bob Consumer",
    deliverySlot: undefined,
    items: [{ productId: "lettuce", quantity: 6, unit: "pcs" }],
    customerUrl: "http://localhost:5173/r/xyz999",
  },
] as const;

/** Infer type from demoOrders */
type OrderRow = (typeof demoOrders)[number];

type Props = {
  /** If omitted, component shows demoOrders */
  orders?: readonly OrderRow[];
};

type OrderStatus = "created" | "packed" | "out_for_delivery" | "delivered" | "confirmed";

const statusColor: Record<OrderStatus, string> = {
  created: "gray",
  packed: "purple",
  out_for_delivery: "orange",
  delivered: "blue",
  confirmed: "green",
};

export default function OrdersTable({ orders = demoOrders }: Props) {
  // from your ColorMode snippet; returns a token string like "gray.200"
  const border = useColorModeValue("gray.200", "whiteAlpha.300");

  return (
    <Box p={4}>
      {/* actions */}
      <HStack justify="space-between" mb={4} className="no-print">
        <Heading size="md">Orders</Heading>
        <Button colorPalette="blue" onClick={() => window.print()}>
          Print
        </Button>
      </HStack>

      {/* print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 12mm; }
          svg { filter: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .qr-wrap {
          padding: 6px;
          border: 1px solid ${border};
          display: inline-block;
          background: white;
        }
      `}</style>

      <Table.Root size="sm" striped stickyHeader variant="line" interactive={false}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Order #</Table.ColumnHeader>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
            <Table.ColumnHeader>Consumer</Table.ColumnHeader>
            <Table.ColumnHeader>Delivery</Table.ColumnHeader>
            <Table.ColumnHeader>Items</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="center" width="220px">
              QR (scan)
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {orders.map((o) => (
            <Table.Row key={o.orderNo}>
              <Table.Cell>
                <Text fontWeight="semibold">{o.orderNo}</Text>
              </Table.Cell>

              <Table.Cell>
                <Badge colorPalette={statusColor[o.status]} textTransform="none">
                  {o.status.replace(/_/g, " ")}
                </Badge>
              </Table.Cell>

              <Table.Cell>{o.consumerName}</Table.Cell>

              <Table.Cell>
                {o.deliverySlot ? new Date(o.deliverySlot).toLocaleString() : "—"}
              </Table.Cell>

              <Table.Cell>
                <Box maxW="280px">
                  {o.items.map((it, idx) => (
                    <Text key={idx} fontSize="sm">
                      {it.quantity} {it.unit ?? ""} {it.productId}
                    </Text>
                  ))}
                </Box>
              </Table.Cell>

              <Table.Cell textAlign="center">
                <Box className="qr-wrap" display="inline-block">
                  <QRCode value={o.customerUrl} size={96} />
                </Box>
                <Text mt={1} fontSize="xs" color="gray.500" lineClamp={1}>
                  {o.customerUrl}
                </Text>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  );
}
