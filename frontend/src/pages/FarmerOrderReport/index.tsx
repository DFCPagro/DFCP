// src/features/farmerOrderReport/FarmerOrderReport.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Alert, Badge, Box, Button, Card, Dialog, EmptyState, Field, FormatNumber,
  HStack, Image, Input, Portal, Progress, Separator, Show, Stack, Stat, Table, Tag, Text,
  Tabs, VStack, SegmentGroup, SimpleGrid, Wrap, WrapItem,
} from "@chakra-ui/react"
import { QRCodeCanvas } from "qrcode.react"
import { LuShoppingCart } from "react-icons/lu"
import { Tooltip } from "@/components/ui/tooltip"

import type { Container as FoContainer, ContainerQR, PrintPayload } from "@/api/farmerOrders"

// constants & utils
import { TOLERANCE_PCT } from "./constants/metrics"
import { sizeCfg, type QrCardSize } from "./constants/sizing"
import { round2, formatNum } from "./utils/numbers"
import { hashString } from "./utils/strings"
import { getFarmerOrderIdFromUrl, getCategoryFromUrl } from "./utils/url"

// printing
import { generatePdfLabels } from "./printing/pdf"
import { printInHiddenFrameQRCards } from "./printing/printInHiddenFrame"

// components
import { InlineNumber } from "./components/InlineNumber"
import { InlineWeightEditor } from "./components/InlineWeightEditor"
import { MonoToken } from "./components/MonoToken"
import { StepPill } from "./components/StepPill"
import QualityStandardsSwitch from "./components/QualityStandardsSwitch"
import { Reveal } from "./components/Animated"

// dev helper for slight latency feel (optional)
import { mockMode, delay } from "./services/farmerOrders.mock"

// ✅ real API (load + weights)
import {
  getFarmerOrderPrintPayload,
  patchContainerWeights,
} from "@/api/farmerOrders"

type Props = {
  farmerOrderId?: string
  /** ignored for header now; we show pickup-time from the API instead */
  pickupAddress?: string
  assignedDeliverer?: string | null
}

export default function FarmerOrderReport({ farmerOrderId, pickupAddress, assignedDeliverer }: Props) {
  // Resolve FO id from props or URL
  const foIdFromUrl = useMemo(() => getFarmerOrderIdFromUrl(), [])
  const effectiveFoId = (farmerOrderId || foIdFromUrl || "").trim()

  // Category from URL (sent as &category=fruit|vegetable|egg_dairy|other)
  const urlCategory = useMemo(() => getCategoryFromUrl(), [])

  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<PrintPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Flow
  const [openInit, setOpenInit] = useState(false)
  const [initCount, setInitCount] = useState<number | string>(0)
  const [openPreview, setOpenPreview] = useState(false)

  // Views
  const [qrFilter, setQrFilter] = useState<"pending" | "weighed" | "all">("all")
  const [boardTab, setBoardTab] = useState<"cards" | "table">("cards")
  const [qrCardSize, setQrCardSize] = useState<QrCardSize>("md")

  // Draft weights
  const [weightsDraft, setWeightsDraft] = useState<Record<string, number>>({})
  const [savingWeights, setSavingWeights] = useState(false)

  // -------- Derived values --------
  const orderedKg = useMemo(() => {
    const fo = payload?.farmerOrder
    const committed =
      fo?.forcastedQuantityKg ??
      (fo as any)?.forecastedQuantityKg ??
      (fo as any)?.sumOrderedQuantityKg ??
      0
    return Math.max(0, Number(committed) || 0)
  }, [payload])

  const totalWeighedKg = useMemo(() => {
    const base = (payload?.farmerOrder?.containers ?? []).reduce(
      (sum, c) => sum + (Number(c.weightKg) || 0),
      0,
    )
    const draftAdded = Object.entries(weightsDraft).reduce(
      (sum, [, v]) => sum + (Number(v) || 0),
      0,
    )
    return round2(base + draftAdded)
  }, [payload, weightsDraft])

  const minAllowedTotal = useMemo(
    () => round2(orderedKg * (1 - TOLERANCE_PCT / 100)),
    [orderedKg],
  )

  const weighedIds = useMemo(() => {
    const set = new Set<string>()
    ;(payload?.farmerOrder?.containers ?? []).forEach((c) => {
      if ((Number(c.weightKg) || 0) > 0) set.add(c.containerId)
    })
    Object.entries(weightsDraft).forEach(([cid, w]) => {
      if (Number(w) > 0) set.add(cid)
    })
    return set
  }, [payload, weightsDraft])

  const filteredQrs = useMemo(() => {
    const all = payload?.containerQrs ?? []
    if (qrFilter === "all") return all
    if (qrFilter === "weighed") return all.filter((q) => weighedIds.has(q.subjectId))
    return all.filter((q) => !weighedIds.has(q.subjectId))
  }, [payload?.containerQrs, qrFilter, weighedIds])

  const assignedName = useMemo(() => {
    if (assignedDeliverer && assignedDeliverer.trim().length) return assignedDeliverer
    const pool = ["Avi Peretz", "Dana Levi", "Noam Cohen", "Tamar Azulay", "Yossi Ben-David", "Maya Oren"]
    const hash = hashString(effectiveFoId || "seed")
    return pool[hash % pool.length] + " (placeholder)"
  }, [assignedDeliverer, effectiveFoId])

  // NEW: pickup-time (Asia/Jerusalem)
  const pickupTimeText = useMemo(() => {
    const raw = payload?.farmerOrder?.pickUpTime
    if (!raw) return "-"
    try {
      const d = new Date(raw)
      return d.toLocaleString("en-GB", {
        timeZone: "Asia/Jerusalem",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    } catch {
      return String(raw)
    }
  }, [payload?.farmerOrder?.pickUpTime])

  const itemName = useMemo(() => {
    const fo = payload?.farmerOrder
    return (fo?.variety ? `${fo?.type ?? ""} ${fo?.variety}`.trim() : fo?.type) || "Unknown Item"
  }, [payload?.farmerOrder])

  /** Category resolution: URL param takes precedence; fall back to payload hints */
  const category = useMemo(() => {
    const fromUrl = (urlCategory ?? "").toLowerCase()
    if (fromUrl) return fromUrl
    const raw =
      (payload as any)?.farmerOrder?.category ??
      (payload as any)?.farmerOrder?.itemCategory ??
      (payload as any)?.farmerOrder?.type ??
      ""
    return String(raw ?? "").toLowerCase()
  }, [payload, urlCategory])

  // -------- Load (REAL API) --------
  const load = useCallback(async () => {
    if (!effectiveFoId) return
    setLoading(true)
    setError(null)
    try {
      if (mockMode) await delay(150)
      const data = await getFarmerOrderPrintPayload(effectiveFoId)
      setPayload(data)
      setWeightsDraft({})
    } catch (e: any) {
      setError(e?.message || "Failed to load farmer order")
    } finally {
      setLoading(false)
    }
  }, [effectiveFoId])

  useEffect(() => {
    load()
  }, [load])

  // -------- Create containers (STATIC / LOCAL ONLY) --------
  const onInitContainers = useCallback(async () => {
    const count = Number(initCount)
    if (!Number.isInteger(count) || count <= 0) return
    try {
      setLoading(true)
      setError(null)
      if (mockMode) await delay(120)

      // build locally (NO API)
      setPayload((prev) => {
        const base: PrintPayload =
          prev ??
          ({
            farmerOrder: {
              _id: effectiveFoId,
              itemId: "",
              type: "",
              shift: "morning",
              pickUpDate: "",
              pickUpTime: "",
              category: "",
              farmerName: "",
              farmName: "",
              farmerId: "",
              forcastedQuantityKg: 0,
              containers: [],
            },
            farmerOrderQR: { token: "", sig: "", scope: "farmer-order" },
            containerQrs: [],
          } as any)

        const start = (base.farmerOrder.containers?.length ?? 0) + 1
        const newContainers: FoContainer[] = []
        const newQrs: ContainerQR[] = []

        for (let i = 0; i < count; i++) {
          const seq = start + i
          const cid = `${base.farmerOrder._id}_${seq}`
          newContainers.push({ containerId: cid, weightKg: 0 })
          newQrs.push({
            token: `QR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            sig: Math.random().toString(36).slice(2, 18),
            scope: "container",
            subjectType: "Container",
            subjectId: cid,
          })
        }

        return {
          farmerOrder: {
            ...base.farmerOrder,
            containers: [...(base.farmerOrder.containers ?? []), ...newContainers],
          },
          farmerOrderQR: base.farmerOrderQR,
          containerQrs: [...(base.containerQrs ?? []), ...newQrs],
        }
      })

      setOpenInit(false)
      setQrFilter("pending")
      setBoardTab("cards")
      setOpenPreview(true)
    } catch (e: any) {
      setError(e?.message || "Failed to initialize containers")
    } finally {
      setLoading(false)
      setInitCount(0)
    }
  }, [effectiveFoId, initCount])

  // -------- Patch weights (REAL API) --------
  const putWeights = useCallback(
    async (weights: Record<string, number>) => {
      const list = Object.entries(weights).map(([containerId, weightKg]) => ({ containerId, weightKg }))
      if (!list.length) return
      setSavingWeights(true)
      try {
        await patchContainerWeights(effectiveFoId, list)

        // re-fetch from server to reflect validation/rounding
        const data = await getFarmerOrderPrintPayload(effectiveFoId)
        setPayload(data)

        setWeightsDraft((prev) => {
          const copy = { ...prev }
          for (const k of Object.keys(weights)) delete copy[k]
          return copy
        })
      } catch (e: any) {
        setError(e?.message || "Failed to update container weights")
      } finally {
        setSavingWeights(false)
      }
    },
    [effectiveFoId],
  )

  const saveWeights = useCallback(() => putWeights(weightsDraft), [putWeights, weightsDraft])

  const underfillWarning = useMemo(() => {
    if (!orderedKg) return null
    if (totalWeighedKg < minAllowedTotal) {
      return `Total weight ${formatNum(totalWeighedKg)} kg is below allowed minimum (${formatNum(minAllowedTotal)} kg, i.e. max ${TOLERANCE_PCT}% under ${formatNum(orderedKg)} kg). Please re-check.`
    }
    return null
  }, [orderedKg, totalWeighedKg, minAllowedTotal])

  // -------- Render --------
  return (
    <Stack gap="6" p={{ base: "3", md: "4" }} w="full" minW="0">
      {/* Header / Summary */}
      <Reveal>
        <Card.Root variant="outline" overflow="hidden" className="anim-pressable">
          <Card.Body gap="4">
            <HStack justifyContent="space-between" alignItems="flex-start" wrap="wrap" minW="0">
              <VStack alignItems="flex-start" gap="2" minW="200px" flex="1" minWidth={0}>
                <Text fontSize="xl" fontWeight="semibold">Farmer Order Report</Text>
                <HStack gap="2" wrap="wrap">
                  <Badge>{(payload?.farmerOrder?._id ?? effectiveFoId) || "—"}</Badge>
                  <Tag.Root><Tag.Label>Shift: {payload?.farmerOrder?.shift ?? "-"}</Tag.Label></Tag.Root>
                  <Tag.Root><Tag.Label>Date: {payload?.farmerOrder?.pickUpDate ?? "-"}</Tag.Label></Tag.Root>
                </HStack>
                {/* 🔁 CHANGED: show pickup-time from API instead of pickup address/string */}
                <Text color="fg.muted" lineClamp={1} minW="0">Pickup time: {pickupTimeText}</Text>
                <Text color="fg.muted" lineClamp={1} minW="0">Deliverer: {assignedName}</Text>
                <Text color="fg.muted" fontSize="sm" title={typeof window !== "undefined" ? window.location.href : ""}>
                  URL-bound FO: {effectiveFoId || "not detected"}
                </Text>
              </VStack>

              <HStack gap="4" alignItems="center" minW="260px" flexShrink={0}>
                {payload?.farmerOrder?.pictureUrl ? (
                  <Image
                    src={payload.farmerOrder.pictureUrl}
                    alt={itemName}
                    width="120px"
                    height="120px"
                    borderRadius="2xl"
                    objectFit="cover"
                    className="anim-float-hover"
                  />
                ) : null}

                <VStack alignItems="flex-end" minW="240px" gap="3">
                  <Stat.Root>
                    <Stat.Label>Item</Stat.Label>
                    <Stat.ValueText lineClamp={1} maxW="260px">{itemName}</Stat.ValueText>
                  </Stat.Root>
                  <Stat.Root>
                    <Stat.Label>Ordered amount</Stat.Label>
                    <Stat.ValueText>
                      <FormatNumber value={orderedKg} maximumFractionDigits={2} /> kg
                    </Stat.ValueText>
                    <Text color="fg.muted" fontSize="sm">Quality grade: A</Text>
                  </Stat.Root>
                </VStack>
              </HStack>
            </HStack>

            <Separator />

            {/* Actions */}
            <HStack gap="3" wrap="wrap">
              <Button onClick={() => setOpenInit(true)} disabled={loading || !effectiveFoId} className="anim-pressable">
                Create containers
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpenPreview(true)}
                disabled={!(payload?.containerQrs?.length ?? 0)}
                className="anim-pressable"
              >
                Preview & Print
              </Button>
              <Button onClick={load} variant="ghost" disabled={loading || !effectiveFoId} className="anim-pressable">
                Re-fetch
              </Button>
            </HStack>

            {/* Errors / loading */}
            <Show when={!!error}>
              <Alert.Root status="error" title="Error">
                <Alert.Description asChild>
                  <span>{error}</span>
                </Alert.Description>
              </Alert.Root>
            </Show>

            <Show when={loading}>
              <Progress.Root value={60} width="full" aria-label="Loading">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </Show>
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* Step indicator */}
      <Reveal>
        <Card.Root variant="subtle" overflow="hidden" className="anim-pressable">
          <Card.Body>
            <HStack gap="3" wrap="wrap">
              <StepPill active>1. Create containers</StepPill>
              <StepPill active={!!(payload?.containerQrs?.length ?? 0)}>2. Weigh-in</StepPill>
              <StepPill active={!!(payload?.containerQrs?.length ?? 0)}>3. Print labels</StepPill>
            </HStack>
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* Order-level Quality Standards (switches by category) */}
      <Reveal>
        <Card.Root className="anim-pressable" variant="subtle" overflow="hidden">
          <Card.Body>
            <QualityStandardsSwitch category={category} />
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* Containers – board */}
      <Reveal>
        <Card.Root variant="outline" overflow="hidden" className="anim-pressable">
          <Card.Body gap="4" minW="0">
            <HStack justifyContent="space-between" alignItems="center" wrap="wrap">
              <Text fontSize="lg" fontWeight="semibold">Containers – Weigh-in</Text>
              <HStack gap="3" wrap="wrap">
                <Tag.Root>
                  <Tag.Label>
                    Weighed total: <FormatNumber value={totalWeighedKg} maximumFractionDigits={2} /> kg
                  </Tag.Label>
                </Tag.Root>
                <Tag.Root>
                  <Tag.Label>
                    Min allowed: <FormatNumber value={minAllowedTotal} maximumFractionDigits={2} /> kg
                  </Tag.Label>
                </Tag.Root>

                <Tooltip content={Object.keys(weightsDraft).length ? "Save all edited weights" : ""}>
                  <Button
                    onClick={saveWeights}
                    colorPalette="green"
                    disabled={!Object.keys(weightsDraft).length || savingWeights}
                    loading={savingWeights}
                    className="anim-pressable"
                  >
                    Save weights
                  </Button>
                </Tooltip>
              </HStack>
            </HStack>

            <HStack gap="3" wrap="wrap" alignItems="center">
              {/* Filter */}
              <SegmentGroup.Root
                size="sm"
                value={qrFilter}
                onValueChange={(e) => setQrFilter((e.value as any) ?? "pending")}
                className="anim-scale-hover"
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Items items={["pending", "weighed", "all"]} />
              </SegmentGroup.Root>

              {/* Size */}
              <SegmentGroup.Root
                size="sm"
                value={qrCardSize}
                onValueChange={(e) => setQrCardSize((e.value as any) ?? "md")}
                className="anim-scale-hover"
              >
                <SegmentGroup.Indicator />
                <SegmentGroup.Items items={["sm", "md", "lg", "xl"]} />
              </SegmentGroup.Root>

              <Box flex="1" />

              <HStack gap="2" minW={{ base: "full", md: "420px" }} w={{ base: "full", md: "auto" }}>
                <Input readOnly value={payload?.farmerOrderQR?.token ?? ""} placeholder="Farmer Order QR token" />
                <Button onClick={() => setOpenPreview(true)} variant="subtle" className="anim-pressable">
                  Show QRs
                </Button>
              </HStack>
            </HStack>

            {/* Empty state */}
            <Show when={(payload?.containerQrs?.length ?? 0) === 0}>
              <EmptyState.Root>
                <EmptyState.Content>
                  <EmptyState.Indicator>
                    <LuShoppingCart />
                  </EmptyState.Indicator>
                  <VStack textAlign="center">
                    <EmptyState.Title>No containers yet</EmptyState.Title>
                    <EmptyState.Description>
                      Start by creating the number of containers to generate QR labels.
                    </EmptyState.Description>
                  </VStack>
                  <Box>
                    <Button onClick={() => setOpenInit(true)} colorPalette="primary" disabled={!effectiveFoId} className="anim-pressable">
                      Create containers
                    </Button>
                  </Box>
                </EmptyState.Content>
              </EmptyState.Root>
            </Show>

            {/* Board view */}
            <Show when={(payload?.containerQrs?.length ?? 0) > 0}>
              <Tabs.Root value={boardTab} onValueChange={(e) => setBoardTab(e.value as any)}>
                <Tabs.List>
                  <Tabs.Trigger value="cards">Card view</Tabs.Trigger>
                  <Tabs.Trigger value="table">Table view</Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>

              {/* Cards */}
              <Show when={boardTab === "cards"}>
                {(() => {
                  const qrPx = sizeCfg[qrCardSize].qr
                  return (
                    <SimpleGrid minChildWidth={sizeCfg[qrCardSize].minCard} gap="4">
                      {filteredQrs.map((q) => {
                        const draft = weightsDraft[q.subjectId]
                        const serverWeight =
                          (payload?.farmerOrder?.containers ?? []).find((c) => c.containerId === q.subjectId)?.weightKg ?? 0
                        const final = draft ?? serverWeight ?? 0
                        const hasServerWeight = (serverWeight || 0) > 0
                        const done = final > 0
                        const edited = draft !== undefined && draft !== serverWeight

                        return (
                          <Card.Root
                            key={q.subjectId}
                            variant="elevated"
                            _hover={{ shadow: "md" }}
                            borderRadius="xl"
                            h="full"
                            role="group"
                            overflow="hidden"
                            minW="0"
                            className="anim-pressable"
                          >
                            <Card.Body gap="3" minW="0">
                              {/* Header: id + status */}
                              <HStack justifyContent="space-between" alignItems="center" minH="28px" minW="0">
                                <Text fontWeight="semibold" fontSize="sm" title={q.subjectId} lineClamp={1} minW="0">
                                  {q.subjectId}
                                </Text>
                                <HStack gap="2" flexShrink={0}>
                                  {edited ? (
                                    <Tag.Root colorPalette="yellow" variant="subtle" title="Edited locally; not saved">
                                      <Tag.Label>edited</Tag.Label>
                                    </Tag.Root>
                                  ) : null}
                                  <Tag.Root colorPalette={done ? "green" : hasServerWeight ? "blue" : "gray"} variant="subtle">
                                    <Tag.Label>{done ? "set" : hasServerWeight ? "saved" : "pending"}</Tag.Label>
                                  </Tag.Root>
                                </HStack>
                              </HStack>

                              {/* QR */}
                              <Box display="grid" placeItems="center" py="2" bg="bg.subtle" borderRadius="lg">
                                <QRCodeCanvas value={q.token} size={qrPx} />
                              </Box>

                              {/* Token (NO ANIMATION) */}
                              <Box className="no-anim">
                                <MonoToken token={q.token} />
                              </Box>

                              {/* Controls */}
                              <Stack
                                direction={{ base: "column", sm: "row" }}
                                align={{ base: "stretch", sm: "center" }}
                                justify="space-between"
                                gap="2"
                                minW="0"
                              >
                                <HStack gap="2" align="center" wrap="wrap" minW="0">
                                  <InlineWeightEditor
                                    value={final}
                                    onChange={(kg) =>
                                      setWeightsDraft((prev) => ({ ...prev, [q.subjectId]: kg }))
                                    }
                                  />
                                  <Text color="fg.muted" flexShrink={0}>kg</Text>

                                  {/* quick bumps */}
                                  <HStack gap="1" wrap="wrap">
                                    {([0.5, 1, 5] as const).map((b) => (
                                      <Button
                                        key={b}
                                        size="xs"
                                        variant="outline"
                                        onClick={() =>
                                          setWeightsDraft((prev) => ({
                                            ...prev,
                                            [q.subjectId]: round2(Math.max(0, (final || 0) + b)),
                                          }))
                                        }
                                        title={`+${b} kg`}
                                        className="anim-pressable"
                                      >
                                        +{b}
                                      </Button>
                                    ))}
                                    <Button
                                      size="xs"
                                      variant="ghost"
                                      onClick={() =>
                                        setWeightsDraft((prev) => ({ ...prev, [q.subjectId]: 0 }))
                                      }
                                      title="Set to 0"
                                      className="anim-pressable"
                                    >
                                      Reset
                                    </Button>
                                  </HStack>
                                </HStack>
                              </Stack>
                            </Card.Body>
                          </Card.Root>
                        )
                      })}
                    </SimpleGrid>
                  )
                })()}
              </Show>

              {/* Table */}
              <Show when={boardTab === "table"}>
                <Box overflowX="auto">
                  <Table.Root size="sm" width="full">
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeader textAlign="start">Container</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="start">QR token</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Weight (kg)</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Status</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {(payload?.farmerOrder?.containers ?? []).map((c) => {
                        const draft = weightsDraft[c.containerId]
                        const finalWeight = draft ?? c.weightKg ?? 0
                        const done = finalWeight > 0
                        const token = payload?.containerQrs?.find((x) => x.subjectId === c.containerId)?.token ?? ""
                        return (
                          <Table.Row key={c.containerId}>
                            <Table.Cell>{c.containerId}</Table.Cell>
                            <Table.Cell>
                              {/* NO ANIMATION around token/copy */}
                              <Box className="no-anim">
                                <MonoToken token={token} inline />
                              </Box>
                            </Table.Cell>
                            <Table.Cell textAlign="end">
                              <FormatNumber value={finalWeight} maximumFractionDigits={2} />
                            </Table.Cell>
                            <Table.Cell textAlign="end">
                              {done ? <Badge colorPalette="green">set</Badge> : <Badge>pending</Badge>}
                            </Table.Cell>
                          </Table.Row>
                        )
                      })}
                    </Table.Body>
                  </Table.Root>
                </Box>
              </Show>

              <Separator />

              <Show when={!!underfillWarning}>
                <Alert.Root status="warning" title="Under the allowed total">
                  <Alert.Description asChild>
                    <span>{underfillWarning ?? ""}</span>
                  </Alert.Description>
                </Alert.Root>
              </Show>
            </Show>
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* Create containers dialog */}
      <Dialog.Root open={openInit} closeOnInteractOutside={false} closeOnEscape={false} onOpenChange={(e) => setOpenInit(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Create containers</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="4">
                  <Text>
                    Enter how many containers to add. You can preview and print the QR cards after creation.
                  </Text>
                  <Field.Root>
                    <Field.Label>Number of containers</Field.Label>
                    <InlineNumber value={Number(initCount) || 0} onValue={(num) => setInitCount(num)} min={1} max={2000} />
                    <Field.HelperText>Max 2000</Field.HelperText>
                  </Field.Root>
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button colorPalette="primary" onClick={onInitContainers} disabled={loading || Number(initCount) <= 0 || !effectiveFoId} className="anim-pressable">
                  Create & Continue
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Preview & Print */}
      <Dialog.Root open={openPreview} closeOnInteractOutside={false} closeOnEscape={false} onOpenChange={(e) => setOpenPreview(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content
              maxW={{ base: "95vw", md: "900px" }}
              css={{
                "@media print": {
                  boxShadow: "none",
                  border: "none",
                  width: "100%",
                  maxWidth: "none",
                },
              }}
            >
              <Dialog.Header>
                <Dialog.Title>QR Cards – Preview</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Stack gap="5">
                  {/* meta */}
                  <Stack
                    direction={{ base: "column", md: "row" }}
                    justify="space-between"
                    align={{ base: "stretch", md: "flex-start" }}
                    gap="4"
                  >
                    <VStack alignItems="flex-start" gap="2">
                      <Text fontWeight="medium">{itemName}</Text>
                      <Text color="fg.muted" lineClamp={1} minW="0">FO: {(payload?.farmerOrder?._id ?? effectiveFoId) || "—"}</Text>

                      <Wrap gap="2">
                        <WrapItem>
                          <Tag.Root><Tag.Label>{payload?.farmerOrder?.pickUpDate ?? "-"}</Tag.Label></Tag.Root>
                        </WrapItem>
                        <WrapItem>
                          <Tag.Root><Tag.Label>{payload?.farmerOrder?.shift ?? "-"}</Tag.Label></Tag.Root>
                        </WrapItem>
                        <WrapItem>
                          <Tag.Root><Tag.Label>Deliverer: {assignedName}</Tag.Label></Tag.Root>
                        </WrapItem>
                      </Wrap>
                    </VStack>

                    <Wrap gap="2" align="center">
                      <WrapItem>
                        <Tag.Root>
                          <Tag.Label><FormatNumber value={orderedKg} /> kg ordered</Tag.Label>
                        </Tag.Root>
                      </WrapItem>
                      <WrapItem>
                        <Tag.Root>
                          <Tag.Label>{payload?.containerQrs?.length ?? 0} containers</Tag.Label>
                        </Tag.Root>
                      </WrapItem>
                    </Wrap>
                  </Stack>

                  <Box display={{ base: "none", md: "block" }}>
                    <Text color="fg.muted" fontSize="sm">
                      Tip: Printing from desktop ensures consistent label sizing.
                    </Text>
                  </Box>

                  {/* grid */}
                  {(() => {
                    const qrPx = sizeCfg[qrCardSize].qr
                    return (
                      <SimpleGrid
                        minChildWidth={sizeCfg[qrCardSize].previewMin}
                        gap="4"
                        css={{ "@media print": { gap: "8px" } }}
                      >
                        {(payload?.containerQrs ?? []).map((q) => (
                          <Card.Root
                            key={q.subjectId}
                            overflow="hidden"
                            minW="0"
                            variant="subtle"
                            className="anim-pressable"
                            css={{
                              breakInside: "avoid",
                              "@media print": {
                                border: "1px solid",
                                borderColor: "var(--chakra-colors-border)",
                              },
                            }}
                          >
                            <Card.Body gap="2" alignItems="stretch" minW="0">
                              <Text fontWeight="semibold" fontSize="sm" lineClamp={1}>{q.subjectId}</Text>
                              <Box display="grid" placeItems="center" py="2">
                                <QRCodeCanvas value={q.token} size={qrPx} />
                              </Box>
                              {/* NO ANIMATION around token/copy */}
                              <Box className="no-anim">
                                <MonoToken token={q.token} />
                              </Box>
                            </Card.Body>
                          </Card.Root>
                        ))}
                      </SimpleGrid>
                    )
                  })()}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer css={{ "@media print": { display: "none" } }}>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Close</Button>
                </Dialog.ActionTrigger>

                {/* Silent print (hidden iframe, no focus change) */}
                <Button
                  variant="subtle"
                  onClick={() =>
                    printInHiddenFrameQRCards(
                      (payload?.containerQrs ?? []).map(q => ({ subjectId: q.subjectId, token: q.token })),
                      `Containers for FO ${payload?.farmerOrder?._id ?? ""}`,
                      sizeCfg[qrCardSize].qr,
                      4
                    )
                  }
                  disabled={!payload?.containerQrs?.length}
                  className="anim-pressable"
                >
                  Silent Browser Print
                </Button>

                {/* PDF open in new tab */}
                <Button
                  colorPalette="primary"
                  onClick={() =>
                    generatePdfLabels({
                      qrs: (payload?.containerQrs ?? []).map(q => ({ subjectId: q.subjectId, token: q.token })),
                      title: `Containers for FO ${payload?.farmerOrder?._id ?? ""}`,
                      fileBase: `FO-${payload?.farmerOrder?._id ?? "labels"}`,
                      cols: 4,
                      rows: "auto",
                      qrPx: sizeCfg[qrCardSize].qr,
                      marginMm: 10,
                      gapMm: 4,
                      cellPaddingMm: 4,
                      meta: {
                        itemName,
                        date: payload?.farmerOrder?.pickUpDate ?? "",
                        shift: payload?.farmerOrder?.shift ?? "",
                        deliverer: assignedName,
                      },
                      openMode: "tab",
                    })
                  }
                  disabled={!payload?.containerQrs?.length}
                  className="anim-pressable"
                >
                  Open PDF in New Tab
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Footer note */}
      <VStack alignItems="flex-start" gap="2">
        <Text fontSize="sm" color="fg.muted">
          When farmer report is complete, advance the pipeline using:
        </Text>
        <HStack gap="2" wrap="wrap">
          <Tag.Root><Tag.Label>PATCH /api/farmer-orders/:id/stage</Tag.Label></Tag.Root>
          <Tag.Root><Tag.Label>updateFarmerOrderStageService</Tag.Label></Tag.Root>
        </HStack>
      </VStack>
    </Stack>
  )
}
