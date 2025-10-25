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
  Accordion,
  createListCollection,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type { CSOrder, CSOrderLine, CSOrderStatus } from "@/types/cs.orders";

/* ----------------------------- helpers ----------------------------- */
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

/* ---------------------- Order details dialog ----------------------- */
type Line = CSOrderLine & { farmerOrderId?: string };

function OrderDetailsDialog({
  orderId,
  open,
  onClose,
}: {
  orderId: string;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [orderMeta, setOrderMeta] = useState<{ orderCode?: string; total?: number } | null>(null);

  useEffect(() => {
    if (!open || !orderId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // TODO: replace with real API
        await new Promise((r) => setTimeout(r, 150));
        if (!alive) return;
        setOrderMeta({ orderCode: `#${orderId.slice(-6)}`, total: 63.35 });
        setLines([
          { id: "l1", itemId: "i1", itemName: "Tomatoes Roma", mode: "kg", quantityKg: 2.5, pricePerUnit: 9.9, farmerOrderId: "F-ORD-9871" },
          { id: "l2", itemId: "i2", itemName: "Cucumber Persian", mode: "kg", quantityKg: 1.2, pricePerUnit: 7.5, farmerOrderId: "F-ORD-9902" },
        ]);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load order");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(e) => {
        if (!e.open) onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner zIndex={1400}>
          <Dialog.Content maxW="720px">
            <Dialog.Header>
              <Dialog.Title>Order · {orderMeta?.orderCode ?? shortId(orderId, 8)}</Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>

            <Dialog.Body>
              {loading ? (
                <HStack>
                  <Spinner />
                  <Text>Loading…</Text>
                </HStack>
              ) : err ? (
                <Alert.Root status="error" colorPalette="red">
                  <Alert.Indicator />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{err}</AlertDescription>
                </Alert.Root>
              ) : (
                <Stack gap="4">
                  <Stack gap="0.5">
                    <Text fontWeight="medium">
                      Items <Badge>{lines.length}</Badge>
                    </Text>
                    <Text color="fg.muted" fontSize="sm">Click an item to expand details</Text>
                  </Stack>

                  <Accordion.Root multiple defaultValue={[]}>
                    {lines.map((ln) => (
                      <Accordion.Item key={ln.id} value={ln.id} borderWidth="1px" borderRadius="md" mb="2">
                        <Accordion.ItemTrigger p="3" _hover={{ bg: "bg.subtle" }}>
                          <HStack justify="space-between" w="full">
                            <Text lineClamp={1}>{ln.itemName}</Text>
                            <HStack gap="4">
                              <Text title="Sell mode">{ln.mode ?? "-"}</Text>
                              <Separator orientation="vertical" />
                              <Text title="Kg">{typeof ln.quantityKg === "number" ? `${ln.quantityKg} kg` : "-"}</Text>
                            </HStack>
                          </HStack>
                        </Accordion.ItemTrigger>

                        <Accordion.ItemContent px="3" pb="3">
                          <Box p="3" bg="bg.subtle" borderRadius="md">
                            <Table.Root size="sm" w="full">
                              <Table.Header>
                                <Table.Row>
                                  <Table.ColumnHeader>Display name</Table.ColumnHeader>
                                  <Table.ColumnHeader>Farmer order id</Table.ColumnHeader>
                                  <Table.ColumnHeader>Sell mode</Table.ColumnHeader>
                                  <Table.ColumnHeader>Kg</Table.ColumnHeader>
                                </Table.Row>
                              </Table.Header>
                              <Table.Body>
                                <Table.Row>
                                  <Table.Cell>{ln.itemName ?? "-"}</Table.Cell>
                                  <Table.Cell>{ln.farmerOrderId ?? "-"}</Table.Cell>
                                  <Table.Cell>{ln.mode ?? "-"}</Table.Cell>
                                  <Table.Cell>{typeof ln.quantityKg === "number" ? ln.quantityKg : "-"}</Table.Cell>
                                </Table.Row>
                              </Table.Body>
                            </Table.Root>
                          </Box>
                        </Accordion.ItemContent>
                      </Accordion.Item>
                    ))}
                  </Accordion.Root>

                  <Separator />
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">
                      Total: {typeof orderMeta?.total === "number" ? orderMeta.total.toFixed(2) : "-"}
                    </Text>
                    <Button colorPalette="teal" onClick={() => navigate(`/cs/orders/${orderId}/pack`)}>
                      Pack
                    </Button>
                  </HStack>
                </Stack>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

/* ------------------------- Status edit dialog ------------------------- */
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        await new Promise((r) => setTimeout(r, 200));
        if (!alive) return;
        setLines([
          { id: "l1", itemId: "i1", itemName: "Tomatoes Roma", mode: "kg", quantityKg: 2.5, pricePerUnit: 9.9 },
          { id: "l2", itemId: "i2", itemName: "Cucumber Persian", mode: "kg", quantityKg: 1.2, pricePerUnit: 7.5 },
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
      await new Promise((r) => setTimeout(r, 150));
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
                              {typeof ln.pricePerUnit === "number" ? ` · ${ln.pricePerUnit.toFixed(2)}` : ""}
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
                <Button variant="ghost" onClick={onClose}>
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

/* ---------------------------- Orders table ---------------------------- */
export function OrdersTable({ items }: { items: CSOrder[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState<CSOrder[]>(items);

  useEffect(() => setRows(items), [items]);

  function applyStatus(orderId: string, next: CSOrderStatus) {
    setRows((curr) => curr.map((o) => (o.id === orderId ? { ...o, status: next } : o)));
  }

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

              <Table.Cell {...makeStatusCellProps(o)}>
                <Badge colorPalette={o.status === "problem" ? "red" : "blue"}>{o.status}</Badge>
              </Table.Cell>

              <Table.Cell title={o.customerId ?? ""}>{shortId(o.customerId)}</Table.Cell>

              <Table.Cell title={o.deliveryAddress.address || ""}>
                {shortText(o.deliveryAddress.address)}
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
                    setSelectedId(o.id);
                    setIsOpen(true);
                  }}
                >
                  Open
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

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

      {/* Always mounted; visibility controlled by isOpen */}
      <OrderDetailsDialog orderId={selectedId} open={isOpen} onClose={() => setIsOpen(false)} />
    </Box>
  );
}
