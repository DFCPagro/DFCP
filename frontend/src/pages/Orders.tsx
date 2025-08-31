import * as React from "react";
import QRCode from "react-qr-code";
import {
  Box,
  Badge,
  Button,
  HStack,
  Heading,
  Text,
  Table,
  Spinner,
} from "@chakra-ui/react";
import { useColorModeValue } from "@/components/ui/color-mode";
import { useOrders } from "@/hooks/useOrders";        // uses fetchOrders(page, pageSize)
import { useMintQrs } from "@/hooks/useOrders";        // uses mintQrs -> /orders/:id/qrs
import { useOrdersStore } from "@/store/orders";       // caches minted tokens
import type { OrderStatus } from "@/types/orders";

const statusColor: Record<OrderStatus, string> = {
  created: "gray",
  packed: "purple",
  out_for_delivery: "orange",
  delivered: "blue",
  confirmed: "green",
};

export default function OrdersPage() {
  const [page, setPage] = React.useState(1);
  const pageSize = 20;

  const { data, isLoading, isError, error, refetch, isFetching } =
    useOrders(page, pageSize);

  const rows = data?.items ?? [];
  const hasNext = data ? page * data.pageSize < data.total : false;

  const border = useColorModeValue("gray.200", "whiteAlpha.300");

  // Inline QR cell (no separate component)
  function QrCell({ orderId: id }: { orderId: string }) {
    const mint = useMintQrs();
    const tokens = useOrdersStore((s) => s.getTokens(id));
    const customerUrl = tokens?.customerUrl;
    const [err, setErr] = React.useState<string | null>(null);

    const getQr = async () => {
      setErr(null);
      try {
        await mint.mutateAsync({ id }); // onSuccess writes to store, re-render picks it up
      } catch (e: any) {
        setErr(e?.response?.data?.message || e?.message || "Failed to mint QR");
      }
    };

    return (
      <Box textAlign="center">
        {customerUrl ? (
          <>
            <Box
              className="qr-wrap"
              display="inline-block"
              padding="6px"
              border={`1px solid ${border}`}
              background="white"
            >
              <QRCode value={customerUrl} size={96} />
            </Box>
            <Text mt={1} fontSize="xs" color="gray.500" className="qr-url" lineClamp={1}>
              {customerUrl}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              mt={1}
              onClick={getQr}
              className="no-print"
              disabled={mint.isPending}
            >
              Remint
            </Button>
          </>
        ) : mint.isPending ? (
          <Spinner size="sm" />
        ) : (
          <>
            <Button size="xs" onClick={getQr} className="no-print">
              Get QR
            </Button>
            {err && (
              <Text mt={1} fontSize="xs" color="red.400">
                {err}
              </Text>
            )}
            <style>{`@media print { .no-print { display: none !important; } }`}</style>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box p={4}>
      {/* Header + paging controls */}
      <HStack justify="space-between" mb={3} className="no-print">
        <Heading size="md">Orders</Heading>
        <HStack gap={2}>
          <Button onClick={() => refetch()} disabled={isFetching}>Refresh</Button>
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Prev
          </Button>
          <Text>Page {page}</Text>
          <Button onClick={() => setPage((p) => p + 1)} disabled={!hasNext}>
            Next
          </Button>
        </HStack>
      </HStack>

      {/* print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 12mm; }
          svg { filter: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .qr-url { display: none !important; }
        }
        .qr-wrap {
          padding: 6px;
          border: 1px solid ${border};
          display: inline-block;
          background: white;
        }
      `}</style>

      {isLoading && <Spinner />}

      {isError && (
        <Text color="red.400">
          {(error as any)?.message ?? "Failed to load orders"}
        </Text>
      )}

      {!isLoading && !isError && (
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
            {rows.map((o) => (
              <Table.Row key={o.id}>
                <Table.Cell>
                  <Text fontWeight="semibold">{o.orderId}</Text>
                </Table.Cell>

                <Table.Cell>
                  <Badge colorPalette={statusColor[o.status]} textTransform="none">
                    {o.status.replace(/_/g, " ")}
                  </Badge>
                </Table.Cell>

                <Table.Cell>{(o as any).consumerName ?? "—"}</Table.Cell>

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
                  <QrCell orderId={o.id} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </Box>
  );
}
