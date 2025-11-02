import React, { useEffect, useState } from "react";
import { Badge, Box, Button, HStack, Table, Text } from "@chakra-ui/react";
import OrdersDetailsDialog from "./ordersDetailsDialog";
import OrderTimeline from "@/pages/customer/customerOrders/components/OrderTimeline";

/* ------------------------------ stages ------------------------------ */
const STAGES = [
  "pending",
  "confirmed",
  "farmer",
  "intransit",
  "packing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
] as const;

type StageKey = (typeof STAGES)[number] | "problem";

const nextStageOf = (stage: StageKey): StageKey => {
  if (stage === "problem") return "problem"; // blocked until resolved
  const i = STAGES.indexOf(stage as (typeof STAGES)[number]);
  if (i < 0) return STAGES[0];
  return i >= STAGES.length - 1 ? STAGES[STAGES.length - 1] : STAGES[i + 1];
};

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

/* ------------------------------ component --------------------------- */
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
      const key = o._id || o.id || o.orderId;
      if (key && o?.stageKey === "problem") next[key] = true;
    }
    setExpanded((prev) => ({ ...prev, ...next }));
  }, [items]);

  const toggleRow = (o: any) => {
    const key = o._id || o.id || o.orderId;
    if (!key) return;
    setExpanded((prev) => {
      const isOpen = !!prev[key];
      if (!isOpen) return { ...prev, [key]: true }; // open
      if (o.stageKey === "problem") return prev;    // keep open for problem
      const next = { ...prev };
      delete next[key];                              // close
      return next;
    });
  };

  const advanceStage = async (o: any) => {
    const id = o._id || o.id || o.orderId;
    if (!id) return;
    const next = nextStageOf(o.stageKey as StageKey);
    if (next === o.stageKey) return; // no-op for problem or delivered

    // optimistic local update
    setRows((prev) =>
      prev.map((r) => ((r._id || r.id || r.orderId) === id ? { ...r, stageKey: next } : r))
    );
    setExpanded((prev) => ({ ...prev, [id]: true }));

    // persist to backend if needed:
    // await updateOrderStage(id, next);
  };

  function makeStatusCellProps(order: any) {
    return {
      role: "button" as const,
      tabIndex: 0,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") e.preventDefault();
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
            const isExpanded = !!expanded[key];
            const disableNext = o.stageKey === "problem" || o.stageKey === "delivered";

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
                        #{o.orderId || String(o._id).slice(-6)}
                      </Text>
                    </HStack>
                  </Table.Cell>

                  <Table.Cell {...makeStatusCellProps(o)}>
                    <Badge colorPalette={o.stageKey === "problem" ? "red" : "blue"}>
                      {o.stageKey}
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
                        setSelectedOrder(o);
                        setSelectedProblem(o.stageKey === "problem");
                        setIsOpen(true);
                      }}
                    >
                      Open
                    </Button>
                  </Table.Cell>
                </Table.Row>

                {isExpanded && (
                  <Table.Row>
                    <Table.Cell colSpan={7}>
                      <HStack justify="space-between" align="center" px={4} py={3}>
                        <OrderTimeline stageKey={o.stageKey} size="sm" />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            advanceStage(o);
                          }}
                          disabled={disableNext}
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
        orderId={
          (selectedOrder && (selectedOrder._id || selectedOrder.id || selectedOrder.orderId)) || ""
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
