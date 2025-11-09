// frontend/src/pages/opManager/picker-tasksManagement/components/taskDetailsModal.tsx
import * as React from "react"
import {
  Badge,
  Box,
  Code,
  Dialog,
  Heading,
  HStack,
  Image,
  Portal,
  Separator,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react"
import type { PickerTask } from "@/api/pickerTask"
import { getItemsCatalog } from "@/api/farmerInventory"
import AuditSection, { type AuditEvent } from "@/components/common/AuditSection"

type CatalogItem = {
  _id?: string
  type?: string
  variety?: string
  category?: string
  imageUrl?: string
}

const pct = (n: number) => Math.round(n * 100)
const fillColor = (n: number): "green" | "yellow" | "red" =>
  n >= 90 ? "red" : n >= 60 ? "yellow" : "green"

function FillBar({ pct, color }: { pct: number; color: "green" | "yellow" | "red" }) {
  return (
    <Box w="160px" h="8px" borderRadius="full" bg="bg.muted" overflow="hidden">
      <Box
        h="100%"
        bg={color === "red" ? "red.400" : color === "yellow" ? "yellow.400" : "green.400"}
        style={{ width: `${pct}%` }}
      />
    </Box>
  )
}

const fmtKg = (n?: number) => (typeof n === "number" ? n.toFixed(2) : "0.00")
const fmtL = (n?: number) => (typeof n === "number" ? n.toFixed(2) : "0.00")
const shortId = (id?: string) => (id && id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id || "-")
const titleCase = (s?: string) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "")

export default function TaskDetailsModal({
  task,
  open,
  onClose,
}: {
  task: PickerTask | null
  open: boolean
  onClose: () => void
}) {
  if (!task) return null

  const [catalogById, setCatalogById] = React.useState<Record<string, CatalogItem>>({})
  const [expandedBoxNo, setExpandedBoxNo] = React.useState<number | null>(null)

  // Load catalog once when modal opens
  React.useEffect(() => {
    let active = true
    if (open) {
      getItemsCatalog()
        .then((items) => {
          if (!active) return
          const map: Record<string, CatalogItem> = {}
          for (const it of items ?? []) {
            if (it._id) map[it._id] = it
          }
          setCatalogById(map)
        })
        .catch(() => {
          setCatalogById({})
        })
    }
    return () => {
      active = false
    }
  }, [open])

  const totalBoxes = task.plan?.summary?.totalBoxes ?? task.plan?.boxes?.length ?? 0
  const totalKg =
    typeof task.totalEstKg === "number"
      ? task.totalEstKg
      : typeof task.plan?.summary?.totalKg === "number"
      ? task.plan.summary.totalKg!
      : task.plan?.boxes?.reduce((s, b) => s + (b.estWeightKg || 0), 0) ?? 0

  const totalL =
    typeof task.totalLiters === "number"
      ? task.totalLiters
      : typeof task.plan?.summary?.totalLiters === "number"
      ? task.plan.summary.totalLiters!
      : task.plan?.boxes?.reduce((s, b) => s + (b.estFillLiters || 0), 0) ?? 0

  const warnings = task.plan?.summary?.warnings ?? []
  const auditItems = (task as any)?.historyAuditTrail ?? []

  const estKgByItemId = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const box of task.plan?.boxes ?? []) {
      for (const piece of box.contents ?? []) {
        const id = String(piece.itemId)
        const w = Number(piece.estWeightKgPiece || 0)
        map.set(id, (map.get(id) || 0) + w)
      }
    }
    return map
  }, [task.plan?.boxes])

  const getDisplayName = (c: { itemId?: string; itemName?: string }) => {
    const id = c.itemId ? String(c.itemId) : undefined
    const cat = id ? catalogById[id] : undefined
    return c.itemName || cat?.variety || cat?.type || cat?.category || (id ? id : "-")
  }

  const getImageUrl = (itemId?: string) => {
    if (!itemId) return undefined
    const cat = catalogById[String(itemId)]
    return cat?.imageUrl
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="min(1100px, 96vw)" w="100%" zIndex="modal">
            <Dialog.CloseTrigger />
            <Dialog.Header>
              <Dialog.Title>
                Order <Code>{shortId(task.orderId)}</Code> • {titleCase(task.status)}
              </Dialog.Title>
              <Text fontSize="sm" color="fg.muted">
                {task.shiftDate} • {task.shiftName}
              </Text>
            </Dialog.Header>

            <Dialog.Body>
              <Stack gap="5">
                {/* Summary badges */}
                <HStack flexWrap="wrap" gap="3">
                  <Badge colorPalette="teal">Boxes: {totalBoxes}</Badge>
                  <Badge colorPalette="cyan">Est. kg: {fmtKg(totalKg)}</Badge>
                  <Badge colorPalette="blue">Est. L: {fmtL(totalL)}</Badge>
                </HStack>

                {/* Warnings */}
                {warnings.length ? (
                  <Box bg="bg.subtle" p="3" borderRadius="md">
                    <Text fontWeight="medium">Warnings</Text>
                    <Stack gap="1" mt="2">
                      {warnings.map((w, i) => (
                        <Text key={i} fontSize="sm" color="fg.muted">
                          • {w}
                        </Text>
                      ))}
                    </Stack>
                  </Box>
                ) : null}

                <Separator />

                {/* Boxes */}
                <Heading size="sm">Boxes</Heading>
                <Stack>
                  {task.plan?.boxes?.map((b) => {
                    const p = pct(b.fillPct)
                    const fc = fillColor(p)
                    const isOpen = expandedBoxNo === b.boxNo
                    return (
                      <Box key={b.boxNo} borderWidth="1px" borderRadius="md" overflow="hidden">
                        <Box
                          px="3"
                          py="2"
                          borderBottomWidth={isOpen ? "1px" : "0"}
                          cursor="pointer"
                          onClick={() => setExpandedBoxNo(isOpen ? null : b.boxNo)}
                          _hover={{ bg: "bg.subtle" }}
                        >
                          <HStack justifyContent="space-between" w="full">
                            <HStack gap="3">
                              <Badge>#{b.boxNo}</Badge>
                              <Text fontWeight="medium">{b.boxType}</Text>
                              {b.vented ? <Badge colorPalette="green">Vented</Badge> : null}
                            </HStack>
                            <HStack gap="4" alignItems="center">
                              <HStack gap="2" alignItems="center">
                                <Text fontSize="sm">Fill:</Text>
                                <Badge colorPalette={fc} variant="subtle" size="sm">
                                  {p}%
                                </Badge>
                              </HStack>
                              <FillBar pct={p} color={fc} />
                              <Text fontSize="sm">~{fmtKg(b.estWeightKg)} kg</Text>
                            </HStack>
                          </HStack>
                        </Box>

                        {isOpen ? (
                          <Box p="3" overflowX="auto">
                            <Table.Root size="sm" width="full">
                              <Table.Header>
                                <Table.Row>
                                  <Table.ColumnHeader>Item</Table.ColumnHeader>
                                  <Table.ColumnHeader>Type</Table.ColumnHeader>
                                  <Table.ColumnHeader>Qty</Table.ColumnHeader>
                                  <Table.ColumnHeader textAlign="end">Liters</Table.ColumnHeader>
                                  <Table.ColumnHeader textAlign="end">Est. kg</Table.ColumnHeader>
                                </Table.Row>
                              </Table.Header>
                              <Table.Body>
                                {b.contents.map((c, idx) => {
                                  const name = getDisplayName(c)
                                  const img = getImageUrl(c.itemId as unknown as string)
                                  return (
                                    <Table.Row key={idx}>
                                      <Table.Cell>
                                        <HStack gap="2">
                                          {img ? (
                                            <Image
                                              src={img}
                                              alt={name}
                                              boxSize="24px"
                                              borderRadius="sm"
                                              objectFit="cover"
                                            />
                                          ) : null}
                                          <Text fontSize="sm">{name}</Text>
                                        </HStack>
                                      </Table.Cell>
                                      <Table.Cell>
                                        <Badge variant="surface">{c.pieceType}</Badge>
                                      </Table.Cell>
                                      <Table.Cell>
                                        <Text fontSize="sm">
                                          {typeof c.qtyKg === "number" ? `${c.qtyKg.toFixed(2)} kg` : ""}
                                          {typeof c.units === "number"
                                            ? `${typeof c.qtyKg === "number" ? " · " : ""}${c.units}u`
                                            : ""}
                                          {typeof c.qtyKg !== "number" && typeof c.units !== "number"
                                            ? c.mode === "kg"
                                              ? "— kg"
                                              : "— u"
                                            : null}
                                        </Text>
                                      </Table.Cell>
                                      <Table.Cell textAlign="end">{fmtL(c.liters)}</Table.Cell>
                                      <Table.Cell textAlign="end">{fmtKg(c.estWeightKgPiece)} kg</Table.Cell>
                                    </Table.Row>
                                  )
                                })}
                              </Table.Body>
                            </Table.Root>
                          </Box>
                        ) : null}
                      </Box>
                    )
                  }) ?? null}
                </Stack>

                <Separator />

                {/* Per-item totals */}
                {task.plan?.summary?.byItem?.length ? (
                  <>
                    <Heading size="sm">Per-Item Totals</Heading>
                    <Box borderWidth="1px" borderRadius="md" overflowX="auto">
                      <Table.Root size="sm" width="full">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>Item</Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">Bags</Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">Bundles</Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">Est. kg</Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">Total units</Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {task.plan.summary.byItem.map((row) => {
                            const cat = row.itemId ? catalogById[String(row.itemId)] : undefined
                            const name =
                              row.itemName ||
                              cat?.variety ||
                              cat?.type ||
                              cat?.category ||
                              String(row.itemId)

                            const id = String(row.itemId)
                            const derivedKg = estKgByItemId.get(id) ?? 0
                            const summaryKg = typeof row.totalKg === "number" ? row.totalKg : 0
                            const estKgForItem = derivedKg > 0 ? derivedKg : summaryKg

                            return (
                              <Table.Row key={String(row.itemId)}>
                                <Table.Cell>
                                  <HStack gap="2">
                                    {cat?.imageUrl ? (
                                      <Image
                                        src={cat.imageUrl}
                                        alt={name}
                                        boxSize="24px"
                                        borderRadius="sm"
                                        objectFit="cover"
                                      />
                                    ) : null}
                                    <Text fontSize="sm">{name}</Text>
                                  </HStack>
                                </Table.Cell>
                                <Table.Cell textAlign="end">{row.bags ?? "—"}</Table.Cell>
                                <Table.Cell textAlign="end">{row.bundles ?? "—"}</Table.Cell>
                                <Table.Cell textAlign="end">{fmtKg(estKgForItem)}</Table.Cell>
                                <Table.Cell textAlign="end">
                                  {typeof row.totalUnits === "number" ? row.totalUnits : "—"}
                                </Table.Cell>
                              </Table.Row>
                            )
                          })}
                        </Table.Body>
                      </Table.Root>
                    </Box>
                  </>
                ) : null}

                {/* ⬇️ Move audit section here at the bottom */}
                <Separator />
                <AuditSection
                  items={auditItems}
                  title="Order Audit"
                  map={(e: any): AuditEvent => ({
                    action: e?.action ?? "",
                    note: e?.note ?? "",
                    by: e?.by ?? "system",
                    at: e?.at ?? e?.timestamp ?? null,
                    timestamp: e?.timestamp ?? e?.at ?? null,
                    meta: e?.meta ?? null,
                  })}
                />
              </Stack>
            </Dialog.Body>

            <Dialog.Footer />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
