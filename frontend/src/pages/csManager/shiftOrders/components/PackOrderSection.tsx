import { useState, useEffect, useMemo } from "react"
import {
  Box,
  Stack,
  Heading,
  Text,
  Button,
  Separator,
  Alert,
  Spinner,
  HStack,
  Badge,
  Table,
  Accordion,
} from "@chakra-ui/react"
import { useMutation } from "@tanstack/react-query"

import type { PackedOrder, PackedPiece } from "@/types/packing"
import { packOrder } from "@/api/packing"
import { getItemsCatalog } from "@/api/farmerInventory"

// ----------------- helper types -----------------

type CatalogItem = {
  _id?: string
  type?: string
  variety?: string
  category?: string
  imageUrl?: string
}

type ItemsById = Record<
  string,
  { displayName?: string; name?: string; type?: string; variety?: string }
>

// ----------------- helpers -----------------

function pct(n: number) {
  return Math.round(n * 100)
}

// <60% = green, 60-90% = yellow, >90% = red
function fillColor(fillPctNum: number): "green" | "yellow" | "red" {
  if (fillPctNum >= 90) return "red"
  if (fillPctNum >= 60) return "yellow"
  return "green"
}

// build nice item name from catalog record
function catalogNameFromItem(it?: CatalogItem): string | null {
  if (!it) return null
  const t = it.type?.trim() ?? ""
  const v = it.variety?.trim() ?? ""
  if (!t && !v) return null
  return v ? `${t} ${v}` : t
}

// pick a display name using (in order):
// 1. backend piece.itemName / summary.itemName
// 2. itemsById prop passed in from parent
// 3. locally fetched catalog
// 4. raw id
function resolveItemName(
  itemId: string,
  directName?: string,
  itemsById?: ItemsById,
  catalog?: CatalogItem[]
) {
  if (directName && directName.trim().length) return directName

  const meta = itemsById?.[itemId]
  if (meta) {
    if (meta.displayName && meta.displayName.trim().length)
      return meta.displayName
    if (meta.name && meta.name.trim().length) return meta.name
    if (meta.variety && meta.type) return `${meta.type} ${meta.variety}`
    if (meta.type) return meta.type
  }

  if (catalog && catalog.length) {
    const hit = catalog.find((c) => c._id === itemId)
    const name = catalogNameFromItem(hit)
    if (name) return name
  }

  return itemId
}

// "0.53 kg · 3u" or "2u" or "1.25 kg"
function renderQtyInline(piece: PackedPiece) {
  const parts: string[] = []

  if (typeof piece.qtyKg === "number") {
    parts.push(`${piece.qtyKg.toFixed(2)} kg`)
  }

  if (typeof piece.units === "number") {
    parts.push(`${piece.units}u`)
  }

  if (parts.length === 0) {
    return piece.mode === "kg" ? "— kg" : "— u"
  }

  return parts.join(" · ")
}

// lil inline progress bar for header line
function FillBar({
  pct,
  color,
}: {
  pct: number
  color: "green" | "yellow" | "red"
}) {
  const bgTrack = "bg.muted"
  const bgFill =
    color === "red"
      ? "red.400"
      : color === "yellow"
      ? "yellow.400"
      : "green.400"

  return (
    <Box
      w="160px"
      h="8px"
      borderRadius="full"
      bg={bgTrack}
      overflow="hidden"
    >
      <Box
        h="100%"
        bg={bgFill}
        style={{ width: `${pct}%` }}
        transition="width 0.2s ease"
      />
    </Box>
  )
}

export default function PackOrderSection({
  orderId,
  itemsById,
  onClose,
}: {
  orderId: string
  itemsById?: ItemsById // optional fallback from parent
  onClose?: () => void
}) {
  const [plan, setPlan] = useState<PackedOrder | null>(null)

  // local catalog (for names)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])

  // load catalog once so we can resolve names in UI
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const list = await getItemsCatalog()
        if (mounted && Array.isArray(list)) {
          setCatalog(list)
        }
      } catch (e) {
        // swallow errors quietly
        console.warn("[PackOrderSection] getItemsCatalog failed:", e)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const { mutate, isPending, isError, error } = useMutation<PackedOrder>({
    mutationKey: ["packOrder", orderId],
    mutationFn: async () => {
      const result = await packOrder(orderId) // returns PackedOrder
      return result
    },
    onSuccess: (packed) => {
      setPlan(packed)
    },
  })

  function handlePack() {
    setPlan(null)
    mutate()
  }

  // ---- summary rollups for header badges ----
  const totalKg =
    plan?.boxes.reduce((s, b) => s + (b.estWeightKg || 0), 0) ?? 0

  const totalL =
    plan?.boxes.reduce((s, b) => s + (b.estFillLiters || 0), 0) ?? 0

  const totalBoxes = plan?.summary?.totalBoxes ?? plan?.boxes.length ?? 0

  const warnings = plan?.summary?.warnings ?? []

  // ---- compute estimated kg per itemId from the actual box contents ----
  // so if an item had only units, we still show nonzero estimated weight
  const estKgByItemId = useMemo(() => {
    const map = new Map<string, number>()
    if (!plan) return map

    for (const box of plan.boxes) {
      for (const piece of box.contents) {
        const w = piece.estWeightKgPiece ?? 0
        if (!map.has(piece.itemId)) {
          map.set(piece.itemId, w)
        } else {
          map.set(piece.itemId, map.get(piece.itemId)! + w)
        }
      }
    }

    return map
  }, [plan])

  return (
    <Box borderWidth="1px" borderRadius="md" p="4">
      <Stack gap="4">
        {/* Header row */}
        <HStack justify="space-between">
          <Heading size="md">Packing</Heading>
          <HStack>
            {onClose ? (
              <Button variant="subtle" onClick={onClose}>
                Close
              </Button>
            ) : null}
            <Button
              onClick={handlePack}
              colorPalette="teal"
              disabled={isPending}
            >
              {isPending ? <Spinner size="sm" /> : "Pack"}
            </Button>
          </HStack>
        </HStack>

        <Text fontSize="sm" color="fg.muted">
          Compute how many packages are needed and the order to place
          items (sturdy base → fragile on top).
        </Text>

        <Separator />

        {/* Error state */}
        {isError ? (
          <Alert.Root status="error">
            <Alert.Description>
              {(error as Error)?.message ||
                "Failed to compute packing."}
            </Alert.Description>
          </Alert.Root>
        ) : null}

        {/* Idle state before first Pack */}
        {!plan && !isPending ? (
          <Box opacity={0.8}>
            <Text fontSize="sm">
              Click <Badge>Pack</Badge> to generate the packing
              plan.
            </Text>
          </Box>
        ) : null}

        {/* Loading */}
        {isPending ? (
          <HStack>
            <Spinner />
            <Text>Computing packing plan…</Text>
          </HStack>
        ) : null}

        {/* Result view */}
        {plan ? (
          <Stack gap="5">
            {/* Summary badges */}
            <HStack flexWrap="wrap" gap="3">
              <Badge colorPalette="teal">Boxes: {totalBoxes}</Badge>
              <Badge colorPalette="cyan">
                Est. kg: {totalKg.toFixed(2)}
              </Badge>
              <Badge colorPalette="blue">
                Est. L: {totalL.toFixed(2)}
              </Badge>
            </HStack>

            {/* Warnings */}
            {warnings.length ? (
              <Box bg="bg.subtle" p="3" borderRadius="md">
                <Text fontWeight="medium">Warnings</Text>
                <Stack gap="1" mt="2">
                  {warnings.map((w, i) => (
                    <Text
                      key={i}
                      fontSize="sm"
                      color="fg.muted"
                    >
                      • {w}
                    </Text>
                  ))}
                </Stack>
              </Box>
            ) : null}

            <Separator />

            {/* Boxes */}
            <Heading size="sm">Boxes</Heading>
            <Accordion.Root multiple>
              {plan.boxes.map((b) => {
                const fillPctNum = pct(b.fillPct)
                const fc = fillColor(fillPctNum)

                return (
                  <Accordion.Item
                    key={b.boxNo}
                    value={String(b.boxNo)}
                    style={{
                      borderWidth: "1px",
                      borderRadius: "0.375rem",
                      overflow: "hidden",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <Accordion.ItemTrigger style={{ width: "100%" }}>
                      <HStack justify="space-between" w="full">
                        {/* Left side header */}
                        <HStack gap="3">
                          <Badge>#{b.boxNo}</Badge>
                          <Text fontWeight="medium">{b.boxType}</Text>
                          {b.vented ? (
                            <Badge colorPalette="green">
                              Vented
                            </Badge>
                          ) : null}
                        </HStack>

                        {/* Right side header */}
                        <HStack gap="4" align="center">
                          <HStack gap="2" align="center">
                            <Text fontSize="sm">Fill:</Text>
                            <Badge
                              colorPalette={fc}
                              variant="subtle"
                              size="sm"
                            >
                              {fillPctNum}%
                            </Badge>
                          </HStack>

                          <FillBar pct={fillPctNum} color={fc} />

                          <Text fontSize="sm">
                            ~{b.estWeightKg.toFixed(2)} kg
                          </Text>
                        </HStack>
                      </HStack>
                    </Accordion.ItemTrigger>

                    <Accordion.ItemContent>
                      <Table.Root size="sm" width="full">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader>
                              Item
                            </Table.ColumnHeader>
                            <Table.ColumnHeader>
                              Type
                            </Table.ColumnHeader>
                            <Table.ColumnHeader>
                              Qty
                            </Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">
                              Liters
                            </Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">
                              Est. kg
                            </Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>

                        <Table.Body>
                          {b.contents.map((c, idx) => (
                            <Table.Row key={idx}>
                              {/* name instead of raw ID */}
                              <Table.Cell>
                                <Text fontSize="sm">
                                  {resolveItemName(
                                    c.itemId,
                                    c.itemName,
                                    itemsById,
                                    catalog
                                  )}
                                </Text>
                              </Table.Cell>

                              {/* bag / bundle */}
                              <Table.Cell>
                                <Badge variant="surface">
                                  {c.pieceType}
                                </Badge>
                              </Table.Cell>

                              {/* "0.53 kg · 3u" */}
                              <Table.Cell>
                                <Text fontSize="sm">
                                  {renderQtyInline(c)}
                                </Text>
                              </Table.Cell>

                              {/* liters */}
                              <Table.Cell textAlign="end">
                                {c.liters.toFixed(2)}
                              </Table.Cell>

                              {/* est kg of this piece */}
                              <Table.Cell textAlign="end">
                                {c.estWeightKgPiece.toFixed(2)} kg
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table.Root>
                    </Accordion.ItemContent>
                  </Accordion.Item>
                )
              })}
            </Accordion.Root>

            <Separator />

            {/* Per-item totals */}
            <Heading size="sm">Per-Item Totals</Heading>
            <Box
              borderWidth="1px"
              borderRadius="md"
              overflowX="auto"
            >
              <Table.Root size="sm" width="full">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>
                      Item
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      Bags
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      Bundles
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      Est. kg
                    </Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">
                      Total units
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {plan.summary.byItem.map((row) => {
                    const estKgForItem =
                      estKgByItemId.get(row.itemId) ?? 0

                    return (
                      <Table.Row key={row.itemId}>
                        {/* Item name resolved with all fallbacks */}
                        <Table.Cell>
                          <Text fontSize="sm">
                            {resolveItemName(
                              row.itemId,
                              row.itemName,
                              itemsById,
                              catalog
                            )}
                          </Text>
                        </Table.Cell>

                        <Table.Cell textAlign="end">
                          {row.bags ?? "—"}
                        </Table.Cell>

                        <Table.Cell textAlign="end">
                          {row.bundles ?? "—"}
                        </Table.Cell>

                        {/* show estimated total kg, not just raw totalKg from summary */}
                        <Table.Cell textAlign="end">
                          {estKgForItem.toFixed(2)}
                        </Table.Cell>

                        <Table.Cell textAlign="end">
                          {typeof row.totalUnits === "number"
                            ? row.totalUnits
                            : "—"}
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>

            {/* Totals under table */}
            <Stack mt="3" gap="1" align="flex-end">
              <HStack>
                <Text fontWeight="medium">
                  Total boxes:
                </Text>
                <Text>{totalBoxes}</Text>
              </HStack>
              <HStack>
                <Text fontWeight="medium">
                  Total liters:
                </Text>
                <Text>{totalL.toFixed(2)} L</Text>
              </HStack>
              <HStack>
                <Text fontWeight="medium">
                  Total weight:
                </Text>
                <Text>{totalKg.toFixed(2)} kg</Text>
              </HStack>
            </Stack>

            {/* Pack again */}
            <Button
              mt="4"
              onClick={handlePack}
              colorPalette="teal"
              disabled={isPending}
            >
              {isPending ? (
                <Spinner size="sm" />
              ) : (
                "Pack"
              )}
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  )
}
