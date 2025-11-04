import React, { useEffect, useState } from "react";
import { Badge, Box, Button, HStack, Table, Text } from "@chakra-ui/react";
import OrdersDetailsDialog from "./ordersDetailsDialog";
import OrderTimeline from "@/pages/customer/customerOrders/components/OrderTimeline";
import { updateOrderStage } from "@/api/orders";
import { getOrderId, nextStageOf, type StageKey } from "@/types/orders";

/* ------------------------------ utils ------------------------------- */
function shortId(id?: string, tail = 6) {
  if (!id) return "-";
  const s = String(id);
  return s.length <= tail ? s : `…${s.slice(-tail)}`;
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

/** Try common shapes used in our models to extract assignee/driver/transporter */
function getAssigneeLabel(o: any): { label: string | null; title?: string } {
  const name =
    o?.assignedDelivery?.name ??
    o?.delivery?.assignee?.name ??
    o?.driver?.name ??
    o?.transporter?.name ??
    null;

  const id =
    o?.assignedDelivery?.id ??
    o?.assignedDeliveryId ??
    o?.delivery?.assignee?.id ??
    o?.driverId ??
    o?.driver?._id ??
    o?.transporterId ??
    o?.transporter?._id ??
    null;

  if (name) return { label: name, title: id ? String(id) : undefined };
  if (id) return { label: shortId(String(id)), title: String(id) };
  return { label: null };
}

export function OrdersTable({ items }: { items: any[] }) {
  const [rows, setRows] = useState<any[]>(items);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => setRows(items), [items]);

  // Auto-open "problem" rows
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const o of items ?? []) {
      const key = getOrderId(o);
      if (key && o?.stageKey === "problem") next[key] = true;
    }
    setExpanded((prev) => ({ ...prev, ...next }));
  }, [items]);

  const toggleRow = (o: any) => {
    const key = getOrderId(o);
    if (!key) return;
    setExpanded((prev) => {
      const isOpen = !!prev[key];
      if (!isOpen) return { ...prev, [key]: true };
      if (o.stageKey === "problem") return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const advanceStage = async (o: any) => {
    const id = getOrderId(o);
    if (!id) return;

    const current = String(o.stageKey) as StageKey;
    const next = nextStageOf(current);
    if (next === current) return; // terminal

    // optimistic UI to next
    setRows((prev) => prev.map((r) => (getOrderId(r) === id ? { ...r, stageKey: next } : r)));
    setExpanded((prev) => ({ ...prev, [id]: true }));

    try {
      // tell backend we finished the *current* stage; it will advance to next
      await updateOrderStage(id, current, "ok");
    } catch {
      // rollback
      setRows((prev) => prev.map((r) => (getOrderId(r) === id ? { ...r, stageKey: current } : r)));
    }
  };

  function makeStatusCellProps() {
    return {
      role: "button" as const,
      tabIndex: 0,
      onClick: (e: React.MouseEvent) => e.stopPropagation(),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") e.preventDefault();
      },
      cursor: "pointer",
      _hover: { bg: "bg.subtle" },
      title: "Click to update status",
    };
  }

  const isTerminal = (s: StageKey) => s === "problem" || s === "delivered";

  return (
    <Box borderWidth="1px" borderRadius="md" overflowX="auto">
      <Table.Root size="sm" w="full">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>#</Table.ColumnHeader>
            <Table.ColumnHeader>Status/Stage</Table.ColumnHeader>
            <Table.ColumnHeader>Customer</Table.ColumnHeader>
            <Table.ColumnHeader>Address</Table.ColumnHeader>
            <Table.ColumnHeader>Assigned delivery</Table.ColumnHeader>
            <Table.ColumnHeader>Created</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
            <Table.ColumnHeader />
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rows.map((o, idx) => {
            const key = getOrderId(o) || `row-${idx}`;
            const isExpanded = !!expanded[key];
            const stage: StageKey = o.stageKey;
            const assignee = getAssigneeLabel(o);

            return (
              <React.Fragment key={key}>
                <Table.Row
                  onClick={() => toggleRow(o)}
                  role="button"
                  tabIndex={0}
                  _hover={{ bg: "bg.subtle" }}
                >
                  <Table.Cell>
                    <HStack>
                      <Text fontWeight="medium">
                        #{o.orderId || String(o._id ?? "").slice(-6)}
                      </Text>
                    </HStack>
                  </Table.Cell>

                  <Table.Cell {...makeStatusCellProps()}>
                    <Badge colorPalette={stage === "problem" ? "red" : "blue"}>
                      {stage}
                    </Badge>
                  </Table.Cell>

                  <Table.Cell title={o.customerId ? String(o.customerId) : ""}>
                    {shortId(o.customerId ? String(o.customerId) : undefined)}
                  </Table.Cell>

                  <Table.Cell title={o.deliveryAddress?.address || ""}>
                    {o.deliveryAddress?.address || "-"}
                  </Table.Cell>

                  <Table.Cell title={assignee.title}>
                    {assignee.label ? (
                      <Text>{assignee.label}</Text>
                    ) : (
                      <Badge colorPalette="gray">Unassigned yet</Badge>
                    )}
                  </Table.Cell>

                  <Table.Cell>{fmtCreated(o.createdAt)}</Table.Cell>

                  <Table.Cell textAlign="end">
                    {typeof o.totalPrice === "number" ? o.totalPrice.toFixed(2) : "-"}$
                  </Table.Cell>

                  <Table.Cell>
                    <Button
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(o);
                        setSelectedProblem(stage === "problem");
                        setIsOpen(true);
                      }}
                    >
                      Open
                    </Button>
                  </Table.Cell>
                </Table.Row>

                {isExpanded && (
                  <Table.Row>
                    {/* 8 visible columns above */}
                    <Table.Cell colSpan={8}>
                      <HStack justify="space-between" align="center" px={4} py={3}>
                        <OrderTimeline stageKey={stage} size="sm" />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            advanceStage(o);
                          }}
                          disabled={isTerminal(stage)}
                        >
                          Next Stage
                        </Button>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                )}
              </React.Fragment>
            );
          })}
        </Table.Body>
      </Table.Root>

      <OrdersDetailsDialog
        orderId={(selectedOrder && getOrderId(selectedOrder)) || ""}
        order={selectedOrder || undefined}
        open={isOpen}
        isProblem={selectedProblem}
        onClose={() => setIsOpen(false)}
      />
    </Box>
  );
}

export default OrdersTable;
