import React, { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Box,
  Button,
  Dialog,
  HStack,
  Portal,
  Select,
  Separator,
  Spinner,
  Stack,
  Table,
  Text,
  createListCollection,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type { CSOrder, CSOrderLine, CSOrderStatus } from "@/types/cs.orders";

/*
// Uncomment these once real APIs exist:
import { getOrderById, updateOrderStatus } from "@/api/orders";
*/

// ------------------------------------
// Helpers
// ------------------------------------
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
    const date = d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} ${time}`;
  } catch {
    return "-";
  }
}

// ------------------------------------
// Status panel (opens when clicking status cell)
// ------------------------------------
function StatusPanel({
  orderId,
  currentStatus,
  onClose,
  onSaved,
}: {
  orderId: string;
  currentStatus: CSOrderStatus;
  onClose: () => void;
  onSaved?: (next: CSOrderStatus) => void;
}) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<CSOrderStatus>(currentStatus);
  const [lines, setLines] = useState<CSOrderLine[]>([]);

  const statusCollection = createListCollection({
    items: [
      "pending",
      "confirmed",
      "farmer",
      "in-transit",
      "packing",
      "ready_for_pickUp",
      "out_for_delivery",
      "delivered",
      "received",
      "canceled",
      "problem",
    ].map((s) => ({ label: s, value: s })),
  });

  // Mocked fetch
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await new Promise((r) => setTimeout(r, 250));
        if (!alive) return;
        setLines([
          {
            id: "l1",
            itemId: "i1",
            itemName: "Tomatoes Roma",
            mode: "kg",
            quantityKg: 2.5,
            pricePerUnit: 9.9,
          },
          {
            id: "l2",
            itemId: "i2",
            itemName: "Cucumber Persian",
            mode: "kg",
            quantityKg: 1.2,
            pricePerUnit: 7.5,
          },
        ]);
      } catch (e: any) {
        setError(e?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      // await updateOrderStatus(orderId, nextStatus);
      await new Promise((r) => setTimeout(r, 200));
      onSaved?.(nextStatus);
      setOpen(false);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) {
          setOpen(false);
          onClose();
        }
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>Update Status · {shortId(orderId, 8)}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>

            <Dialog.Body>
              {loading ? (
                <HStack>
                  <Spinner />
                  <Text>Loading order…</Text>
                </HStack>
              ) : error ? (
                <Alert.Root status="error" colorPalette="red">
                  <Alert.Indicator />
                  <AlertTitle>Failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert.Root>
              ) : (
                <Stack gap="4">
                  {/* ---- Status select ---- */}
                  <Stack gap="1">
                    <Text fontWeight="medium">
                      Current: <Badge>{currentStatus}</Badge>
                    </Text>
                    <HStack gap="2">
                      <Text minW="72px">Set to</Text>
                      <Select.Root
                        collection={statusCollection}
                        size="sm"
                        value={[nextStatus]}
                        onValueChange={(e) => {
                          const v = e.value?.[0];
                          if (v) setNextStatus(v as CSOrderStatus);
                        }}
                        width="260px"
                      >
                        <Select.HiddenSelect />
                        <Select.Control>
                          <Select.Trigger>
                            <Select.ValueText placeholder={currentStatus} />
                          </Select.Trigger>
                          <Select.IndicatorGroup>
                            <Select.Indicator />
                            <Select.ClearTrigger />
                          </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                          <Select.Positioner>
                            <Select.Content>
                              {statusCollection.items.map((item) => (
                                <Select.Item key={item.value} item={item}>
                                  {item.label}
                                  <Select.ItemIndicator />
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Positioner>
                        </Portal>
                      </Select.Root>
                    </HStack>
                  </Stack>

                  <Separator />

                  {/* ---- Order lines ---- */}
                  <Stack>
                    <Text fontWeight="semibold">Items</Text>
                    <Stack gap="2">
                      {lines.length ? (
                        lines.map((ln) => (
                          <HStack key={ln.id} justify="space-between">
                            <Text lineClamp={1}>{ln.itemName}</Text>
                            <Text>
                              {typeof ln.quantityKg === "number" ? `${ln.quantityKg} kg` : ""}
                              {typeof ln.units === "number" ? ` · ${ln.units}u` : ""}
                              {typeof ln.pricePerUnit === "number"
                                ? ` · ${ln.pricePerUnit.toFixed(2)}`
                                : ""}
                            </Text>
                          </HStack>
                        ))
                      ) : (
                        <Text color="fg.muted">No items</Text>
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              )}
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap="2" justify="end">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    onClose();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} loading={saving} disabled={loading}>
                  Save
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

// ------------------------------------
// Orders table
// ------------------------------------
export function OrdersTable({ items }: { items: CSOrder[] }) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState<CSOrder[]>(items);

  useEffect(() => setRows(items), [items]);

  function applyStatus(orderId: string, next: CSOrderStatus) {
    setRows((curr) => curr.map((o) => (o.id === orderId ? { ...o, status: next } : o)));
  }

  // open panel via mouse or keyboard on the status cell
  function makeStatusCellProps(order: CSOrder) {
    return {
      role: "button" as const,
      tabIndex: 0,
      onClick: () => setEditingId(order.id),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditingId(order.id);
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
          {rows.map((o) => (
            <Table.Row key={o.id}>
              <Table.Cell>
                <HStack>
                  <Text fontWeight="medium">#{o.orderId}</Text>
                </HStack>
              </Table.Cell>

              {/* ---- Status (NOT a button) ---- */}
              <Table.Cell {...makeStatusCellProps(o)}>
                <Badge colorPalette={o.status === "problem" ? "red" : "blue"}>{o.status}</Badge>
              </Table.Cell>

              {/* ---- Customer (short id) ---- */}
              <Table.Cell title={o.customerId ?? ""}>{shortId(o.customerId)}</Table.Cell>

              {/* ---- Address (plain string) ---- */}
              <Table.Cell title={o.deliveryAddress.address || ""}>{shortText(o.deliveryAddress.address)}</Table.Cell>

              {/* ---- Created ---- */}
              <Table.Cell>{fmtCreated(o.createdAt)}</Table.Cell>

              {/* ---- Total ---- */}
              <Table.Cell textAlign="end">
                {typeof o.totalPrice === "number" ? o.totalPrice.toFixed(2) : "-"}
              </Table.Cell>

              {/* ---- Open ---- */}
              <Table.Cell>
                <Button size="xs" onClick={() => navigate(`/cs/orders/${o.id}`)}>
                  Open
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      {/* ---- Status dialog ---- */}
      {editingId && (
        <StatusPanel
          orderId={editingId}
          currentStatus={(rows.find((r) => r.id === editingId)?.status as CSOrderStatus) || "pending"}
          onClose={() => setEditingId(null)}
          onSaved={(next) => {
            if (!editingId) return;
            applyStatus(editingId, next);
          }}
        />
      )}
    </Box>
  );
}
