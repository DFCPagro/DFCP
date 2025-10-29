import React, { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  Table,
  Text,
} from "@chakra-ui/react";
import OrdersDetailsDialog from "./ordersDetailsDialog";

// If you have a strict CSOrder type, you can import it.
// For flexibility here, we'll accept `any` and only use needed fields.

function shortId(id?: string, tail = 6) {
  if (!id) return "-";
  const s = String(id);
  return s.length <= tail ? s : `…${s.slice(-tail)}`;
}
function shortText(str?: string, maxLen = 32) {
  if (!str) return "-";
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + "…";
}
function fmtCreated(ts?: string | number) {
  if (!ts) return "-";
  try {
    const d = new Date(ts);
    const date = d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${date} ${time}`;
  } catch {
    return "-";
  }
}

export function OrdersTable({ items }: { items: any[] }) {
  const [rows, setRows] = useState<any[]>(items);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setRows(items), [items]);

  function makeStatusCellProps(order: any) {
    return {
      role: "button" as const,
      tabIndex: 0,
      onClick: () => {
        /* hook up your inline status editor here, if needed */
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
        }
      },
      cursor: "pointer",
      _hover: { bg: "bg.subtle" },
      title: "Click to update status",
    };
  }

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
          {rows.map((o, idx) => {
            const key = o._id || o.id || o.orderId || `row-${idx}`;
            return (
              <React.Fragment key={key}>
                <Table.Row>
                  <Table.Cell>
                    <HStack>
                      <Text fontWeight="medium">
                        #{o.orderId || String(o._id).slice(-6)}
                      </Text>
                    </HStack>
                  </Table.Cell>

                  <Table.Cell {...makeStatusCellProps(o)}>
                    <Badge colorPalette={o.status === "problem" ? "red" : "blue"}>
                      {o.status}
                    </Badge>
                  </Table.Cell>

                  <Table.Cell title={o.customerId ? String(o.customerId) : ""}>
                    {shortId(o.customerId ? String(o.customerId) : undefined)}
                  </Table.Cell>

                  <Table.Cell title={o.deliveryAddress?.address || ""}>
                    {o.deliveryAddress?.address || "-"}
                  </Table.Cell>

                  <Table.Cell>{fmtCreated(o.createdAt)}</Table.Cell>

                  <Table.Cell textAlign="end">
                    {typeof o.totalPrice === "number" ? o.totalPrice.toFixed(2) : "-"}
                  </Table.Cell>

                  <Table.Cell>
                    <Button
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(o); // ✅ pass entire order to dialog
                        setSelectedProblem(o.status === "problem");
                        setIsOpen(true);
                      }}
                    >
                      Open
                    </Button>
                  </Table.Cell>
                </Table.Row>
              </React.Fragment>
            );
          })}
        </Table.Body>
      </Table.Root>

      {/* Details dialog (re-uses list payload = no refetch required) */}
      <OrdersDetailsDialog
        orderId={
          (selectedOrder && (selectedOrder._id || selectedOrder.id || selectedOrder.orderId)) ||
          ""
        }
        order={selectedOrder || undefined}
        open={isOpen}
        isProblem={selectedProblem}
        onClose={() => setIsOpen(false)}
      />
    </Box>
  );
}

export default OrdersTable;
