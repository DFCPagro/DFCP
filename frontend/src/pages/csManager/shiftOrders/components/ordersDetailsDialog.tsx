import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Box,
  Button,
  Dialog,
  HStack,
  Portal,
  Spinner,
  Stack,
  Table,
  Text,
  Badge,
} from "@chakra-ui/react";
import PackOrderSection from "./PackOrderSection.tsx";
import OrderAuditSection from "../../../../components/common/OrderAuditSection.tsx";

/* ----------------------------- helpers ----------------------------- */
function fmtFullAddress(addr: any): string {
  if (!addr) return "-";
  const parts: string[] = [];

  if (addr.label) parts.push(`[${addr.label}]`);
  if (addr.address) parts.push(addr.address);

  const streetBlock = [addr.street, addr.houseNumber].filter(Boolean).join(" ");
  if (streetBlock) parts.push(streetBlock);

  if (addr.city) parts.push(addr.city);
  if (addr.zip) parts.push(addr.zip);
  if (addr.floor) parts.push(`Floor ${addr.floor}`);
  if (addr.apartment) parts.push(`Apt ${addr.apartment}`);
  if (addr.notes) parts.push(`(${addr.notes})`);

  return parts.filter(Boolean).join(", ");
}

function shortId(id?: string, tail = 6) {
  if (!id) return "-";
  const s = String(id);
  return s.length <= tail ? s : `…${s.slice(-tail)}`;
}

function mapLine(ln: any) {
  const unitMode = ln.unitMode || ln.mode || "kg";
  const qtyKg = ln.quantityKg ?? ln.kg ?? 0;
  const units = ln.units ?? 0;

  const name = ln.name || ln.itemName || ln.item?.name || "Item";
  const farmerOrderId = ln.farmerOrderId || ln.foId || "";

  const est = ln.estimatesSnapshot || ln.estimates || {};
  const avgUnitKg = est.avgWeightPerUnitKg ?? 0;
  const pricePerKg = ln.pricePerUnit ?? ln.price ?? 0;

  const effectiveKg = (qtyKg || 0) + (units || 0) * (avgUnitKg || 0);
  const lineTotal = Math.round(pricePerKg * effectiveKg * 100) / 100;

  return {
    id: String(farmerOrderId || ln.itemId || ln._id || name),
    itemName: name,
    farmerOrderId: farmerOrderId || "-",
    mode: unitMode as "kg" | "unit" | "mixed",
    qtyText:
      unitMode === "kg"
        ? `${qtyKg || 0} kg`
        : unitMode === "unit"
          ? `${units || 0}u`
          : `${qtyKg || 0} kg · ${units || 0}u`,
    lineTotal,
  };
}

/* ------------------------------ hook ------------------------------ */
export function useOrderDetails({
  orderId,
  order,
  enabled,
}: {
  orderId: string;
  order?: any;
  enabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      itemName: string;
      farmerOrderId: string;
      qtyText: string;
      mode: string;
      lineTotal: number;
    }>
  >([]);
  const [addressText, setAddressText] = useState<string>("-");
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [shortCode, setShortCode] = useState<string>("");
  const [audit, setAudit] = useState<any[]>([]);
  const [stageKey, setStatus] = useState<string>("");

  const [stage, setStage] = useState<string>(""); // optional if you have stage separate from status
  const [createdAt, setCreatedAt] = useState<string>("");

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Prefer provided order from parent
        const src = order ?? {};
        const ord: any =
          (src && (src.data || src.order || src.result)) || src || {};

        if (!alive) return;

        // order id short code
        const oid = ord._id || ord.id || ord.orderId || orderId;
        setShortCode(`#${String(oid).slice(-6)}`);

        // full delivery address (keep your current format)
        setAddressText(fmtFullAddress(ord.deliveryAddress));

        // line items
        const rawItems: any[] = Array.isArray(ord.items) ? ord.items : [];
        const mapped = rawItems.map(mapLine);
        setRows(mapped);

        // total
        const serverTotal = ord.totalPrice ?? ord.itemsSubtotal ?? undefined;
        const fallbackTotal =
          Math.round(mapped.reduce((s, x) => s + (x.lineTotal || 0), 0) * 100) /
          100;
        setTotal(
          Number.isFinite(serverTotal) ? Number(serverTotal) : fallbackTotal
        );

        // status / stage
        setStatus(ord.stageKey || "");
        setStage(ord.stage || ""); // if you have "stage" separately, otherwise leave ""

        // audit
        const rawAudit =
          ord.historyAuditTrail || ord.audit || ord.auditTrail || [];
        setAudit(Array.isArray(rawAudit) ? rawAudit : []);

        // createdAt
        const cAt =
          ord.createdAt ||
          ord.created_at ||
          ord.metaCreatedAt ||
          ord.meta?.createdAt ||
          "";
        setCreatedAt(cAt ? new Date(cAt).toLocaleString() : "");
      } catch (e: any) {
        setErr(e?.message || "Failed to load order");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [enabled, orderId, order]);

  return {
    loading,
    error,
    rows,
    addressText,
    total,
    shortCode,
    audit,
    stageKey,
    stage,
    createdAt,
  };
}

/* --------------------------- main dialog --------------------------- */
export default function OrdersDetailsDialog({
  orderId,
  order,
  open,
  onClose,
  isProblem,
}: {
  orderId: string;
  order?: any;
  open: boolean;
  onClose: () => void;
  isProblem?: boolean;
}) {
  const {
    loading,
    error,
    rows,
    addressText,
    total,
    shortCode,
    audit,
    stageKey,
    stage,
    createdAt,
  } = useOrderDetails({
    orderId,
    order,
    enabled: open && (!!order || !!orderId),
  });

  const [packOpen, setPackOpen] = useState(false);

  const itemsTotal = useMemo(
    () => (typeof total === "number" ? total.toFixed(2) : "-"),
    [total]
  );

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
          <Dialog.Content maxW="820px">
            <Dialog.Header>
              <Dialog.Title>
                Order · {shortCode || shortId(orderId, 8)}
              </Dialog.Title>
              <Dialog.CloseTrigger />
            </Dialog.Header>

            <Dialog.Body>
              {loading ? (
                <HStack>
                  <Spinner />
                  <Text>Loading…</Text>
                </HStack>
              ) : error ? (
                <Alert.Root status="error" colorPalette="red">
                  <Alert.Indicator />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert.Root>
              ) : (
                <Stack gap="5">
                  {/* DELIVERY ADDRESS (unchanged like you wanted) */}
                  <Stack gap="1">
                    <Text fontWeight="medium">Delivery address:</Text>
                    <Text color="fg.muted" whiteSpace="pre-wrap">
                      {addressText}
                    </Text>
                  </Stack>

                  {/* META ROW: createdAt + status + stage */}
                  <Box borderWidth="1px" borderRadius="md" p="4" bg="bg.panel">
                    <HStack justify="space-between" align="flex-start">
                      <Stack gap="1">
                        <Text
                          fontSize="sm"
                          color="fg.muted"
                          fontWeight="medium"
                        >
                          Created at
                        </Text>
                        <Text fontSize="sm" fontWeight="medium">
                          {createdAt || "-"}
                        </Text>
                      </Stack>

                      <Stack gap="1" align="flex-end">
                        <Text
                          fontSize="sm"
                          color="fg.muted"
                          fontWeight="medium"
                        >
                          Status / Stage
                        </Text>
                        <HStack gap="2" flexWrap="wrap">
                          <Badge
                            variant="subtle"
                            colorPalette={
                              isProblem || stageKey === "problem"
                                ? "orange"
                                : "green"
                            }
                          >
                            {stageKey || "—"}
                          </Badge>
                          <Badge variant="subtle" colorPalette="gray">
                            {stage || "—"}
                          </Badge>
                        </HStack>
                      </Stack>
                    </HStack>
                  </Box>

                  {/* ITEMS TABLE */}
                  <Box borderWidth="1px" borderRadius="md" overflowX="auto">
                    <Table.Root size="sm" w="full">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Item</Table.ColumnHeader>
                          <Table.ColumnHeader>F.O id</Table.ColumnHeader>
                          <Table.ColumnHeader>kg / units</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">
                            Total
                          </Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>

                      <Table.Body>
                        {rows.map((ln, idx) => (
                          <Table.Row key={ln.id || idx}>
                            <Table.Cell>{ln.itemName}</Table.Cell>
                            <Table.Cell title={ln.farmerOrderId}>
                              {shortId(ln.farmerOrderId)}
                            </Table.Cell>
                            <Table.Cell>{ln.qtyText}</Table.Cell>
                            <Table.Cell textAlign="end">
                              {typeof ln.lineTotal === "number"
                                ? ln.lineTotal.toFixed(2)
                                : "-"}
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>

                      <Table.Footer>
                        <Table.Row>
                          <Table.Cell
                            colSpan={3}
                            textAlign="right"
                            fontWeight="semibold"
                          >
                            Total
                          </Table.Cell>
                          <Table.Cell textAlign="end" fontWeight="semibold">
                            {itemsTotal}
                          </Table.Cell>
                        </Table.Row>
                      </Table.Footer>
                    </Table.Root>
                  </Box>

                  {/* AUDIT SECTION */}
                  <OrderAuditSection audit={audit} />

                  {/* PACK / CLOSE */}
                  {!packOpen ? (
                    <HStack justify="space-between">
                      <Button
                        variant="solid"
                        colorPalette="green"
                        onClick={() => setPackOpen(true)}
                      >
                        Pack
                      </Button>
                      <Button
                        variant="solid"
                        colorPalette="teal"
                        onClick={onClose}
                      >
                        Close
                      </Button>
                    </HStack>
                  ) : (
                    <PackOrderSection
                      orderId={String(order?._id || orderId)}
                      onClose={() => setPackOpen(false)}
                    />
                  )}
                </Stack>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
