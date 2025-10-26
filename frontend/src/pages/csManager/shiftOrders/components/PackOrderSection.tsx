import { useState } from "react"
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
  Progress,
  Table,
  Accordion,
} from "@chakra-ui/react"
import { useMutation } from "@tanstack/react-query"
import type { PackingPlan } from "@/types/packing"
import { packOrder } from "@/api/packing"

/** Optional helper if you want to show item names instead of IDs */
type ItemsById = Record<
  string,
  { displayName?: string; name?: string; type?: string; variety?: string }
>

function pct(n: number) {
  return Math.round(n * 100)
}

export default function PackOrderSection({
  orderId,
  itemsById,
  onClose,
}: {
  orderId: string
  itemsById?: ItemsById // optional map to render names
  onClose?: () => void
}) {
  const [plan, setPlan] = useState<PackingPlan | null>(null)

  const { mutate, isPending, isError, error } = useMutation({
    mutationKey: ["packOrder", orderId],
    mutationFn: async () => packOrder(orderId),
    onSuccess: (res) => setPlan(res),
  })

  const handlePack = () => {
    setPlan(null)
    mutate()
  }

  const totalKg = plan?.boxes.reduce((s, b) => s + b.estWeightKg, 0) ?? 0
  const totalL = plan?.boxes.reduce((s, b) => s + b.estFillLiters, 0) ?? 0

  return (
    <Box borderWidth="1px" borderRadius="md" p="4">
      <Stack gap="4">
        <HStack justify="space-between">
          <Heading size="md">Packing</Heading>
          <HStack>
            {onClose ? (
              <Button variant="subtle" onClick={onClose}>
                Close
              </Button>
            ) : null}
            <Button onClick={handlePack} colorPalette="teal" disabled={isPending}>
              {isPending ? <Spinner size="sm" /> : "Pack"}
            </Button>
          </HStack>
        </HStack>

        <Text fontSize="sm" color="fg.muted">
          Compute how many packages are needed and the order to place items (sturdy base → fragile on top).
        </Text>

        <Separator />

        {isError ? (
          <Alert.Root status="error">
            <Alert.Description>
              {(error as Error)?.message || "Failed to compute packing."}
            </Alert.Description>
          </Alert.Root>
        ) : null}

        {!plan && !isPending ? (
          <Box opacity={0.8}>
            <Text fontSize="sm">
              Click <Badge>Pack</Badge> to generate the packing plan.
            </Text>
          </Box>
        ) : null}

        {isPending ? (
          <HStack>
            <Spinner />
            <Text>Computing packing plan…</Text>
          </HStack>
        ) : null}

        {plan ? (
          <Stack gap="5">
            {/* Summary badges */}
            <HStack flexWrap="wrap" gap="3">
              <Badge colorPalette="teal">Boxes: {plan.summary.totalBoxes}</Badge>
              <Badge colorPalette="cyan">Est. kg: {totalKg.toFixed(2)}</Badge>
              <Badge colorPalette="blue">Est. L: {totalL.toFixed(2)}</Badge>
            </HStack>

            {/* Warnings */}
            {plan.summary.warnings.length ? (
              <Box bg="bg.subtle" p="3" borderRadius="md">
                <Text fontWeight="medium">Warnings</Text>
                <Stack gap="1" mt="2">
                  {plan.summary.warnings.map((w, i) => (
                    <Text key={i} fontSize="sm" color="fg.muted">
                      • {w}
                    </Text>
                  ))}
                </Stack>
              </Box>
            ) : null}

            <Separator />

            {/* Boxes list (accordion) */}
            <Heading size="sm">Boxes</Heading>
            <Accordion.Root multiple>
              {plan.boxes.map((b) => (
                <Accordion.Item
                  key={b.boxNo}
                  value={String(b.boxNo)}
                  style={{ borderWidth: "1px", borderRadius: "0.375rem", overflow: "hidden", marginBottom: "0.5rem" }}
                >
                  <Accordion.ItemTrigger style={{ width: "100%" }}>
                    <HStack justify="space-between" w="full">
                      <HStack gap="3">
                        <Badge>#{b.boxNo}</Badge>
                        <Text fontWeight="medium">{b.boxType}</Text>
                        {b.vented ? <Badge colorPalette="green">Vented</Badge> : null}
                      </HStack>
                      <HStack gap="4">
                        <Text fontSize="sm">Fill: {pct(b.fillPct)}%</Text>
                        <Box minW="160px">
                          <Progress.Root value={pct(b.fillPct)} max={100} aria-label="fill">
                            <Progress.Track />
                            <Progress.Range />
                          </Progress.Root>
                        </Box>
                        <Text fontSize="sm">~{b.estWeightKg.toFixed(2)} kg</Text>
                      </HStack>
                    </HStack>
                  </Accordion.ItemTrigger>
                  <Accordion.ItemContent>
                    <Table.Root size="sm" width="full">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Item</Table.ColumnHeader>
                          <Table.ColumnHeader>Type</Table.ColumnHeader>
                          <Table.ColumnHeader>Mode</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">Qty (kg)</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">Units</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="end">Liters</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {b.contents.map((c, idx) => (
                          <Table.Row key={idx}>
                            <Table.Cell>
                              <Text fontSize="sm">
                                {itemsById?.[c.itemId]?.displayName ||
                                  itemsById?.[c.itemId]?.name ||
                                  itemsById?.[c.itemId]?.type ||
                                  c.itemId}
                              </Text>
                              <Text fontFamily="mono" fontSize="xs" color="fg.muted">
                                {c.itemId}
                              </Text>
                            </Table.Cell>
                            <Table.Cell>
                              <Badge variant="surface">{c.pieceType}</Badge>
                            </Table.Cell>
                            <Table.Cell>{c.mode}</Table.Cell>
                            <Table.Cell textAlign="end">
                              {typeof c.qtyKg === "number" ? c.qtyKg.toFixed(2) : "—"}
                            </Table.Cell>
                            <Table.Cell textAlign="end">
                              {typeof c.units === "number" ? c.units : "—"}
                            </Table.Cell>
                            <Table.Cell textAlign="end">{c.liters.toFixed(2)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Accordion.ItemContent>
                </Accordion.Item>
              ))}
            </Accordion.Root>

            <Separator />

            {/* Per-item totals */}
            <Heading size="sm">Per-Item Totals</Heading>
            <Box borderWidth="1px" borderRadius="md" overflowX="auto">
              <Table.Root size="sm" width="full">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Item</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Bags</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Bundles</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Total kg</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Total units</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {plan.summary.byItem.map((row) => (
                    <Table.Row key={row.itemId}>
                      <Table.Cell>
                        <Text fontSize="sm">
                          {itemsById?.[row.itemId]?.displayName ||
                            itemsById?.[row.itemId]?.name ||
                            itemsById?.[row.itemId]?.type ||
                            row.itemId}
                        </Text>
                        <Text fontFamily="mono" fontSize="xs" color="fg.muted">
                          {row.itemId}
                        </Text>
                      </Table.Cell>
                      <Table.Cell textAlign="end">{row.bags}</Table.Cell>
                      <Table.Cell textAlign="end">{row.bundles}</Table.Cell>
                      <Table.Cell textAlign="end">
                        {typeof row.totalKg === "number" ? row.totalKg.toFixed(2) : "—"}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        {typeof row.totalUnits === "number" ? row.totalUnits : "—"}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  )
}
