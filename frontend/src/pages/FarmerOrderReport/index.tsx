import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  EmptyState,
  Field,
  Fieldset,
  FormatNumber,
  HStack,
  Image,
  Input,
  Portal,
  Progress,
  Separator,
  Show,
  Stack,
  Stat,
  Table,
  Tag,
  Text,
  Tabs,
  VStack,
  NumberInput,
  SegmentGroup,
  Kbd,
  SimpleGrid,
  Wrap,
  WrapItem,
} from "@chakra-ui/react"
import { QRCodeCanvas } from "qrcode.react"
import { LuShoppingCart, LuCopy, LuCheck } from "react-icons/lu"
import { Tooltip } from "@/components/ui/tooltip"

import type { Container as FoContainer, ContainerQR, FarmerOrder, PrintPayload } from "@/api/farmerOrders"

/**
 * Farmer order report – Chakra UI v3
 * Super robust against overflow & layout breakage.
 */

const mockMode = true

type QualityMetricConfig = {
  key: string
  label: string
  target: number
  unit?: string
  min?: number
  max?: number
}

type Props = {
  farmerOrderId: string
  qualityA?: QualityMetricConfig[]
  pickupAddress?: string
  assignedDeliverer?: string | null
}

type QrCardSize = "sm" | "md" | "lg" | "xl"

export default function FarmerOrderReport({
  farmerOrderId,
  qualityA,
  pickupAddress,
  assignedDeliverer,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [payload, setPayload] = useState<PrintPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Flow
  const [openInit, setOpenInit] = useState(false)
  const [initCount, setInitCount] = useState<number | string>(0)
  const [openPreview, setOpenPreview] = useState(false)

  // Views
  const [qrFilter, setQrFilter] = useState<"pending" | "weighed" | "all">("pending")
  const [boardTab, setBoardTab] = useState<"cards" | "table">("cards")
  const [qrCardSize, setQrCardSize] = useState<QrCardSize>("md")

  // Draft weights
  const [weightsDraft, setWeightsDraft] = useState<Record<string, number>>({})
  const [savingWeights, setSavingWeights] = useState(false)

  // Grade A config
  const qualityConfig: QualityMetricConfig[] = useMemo(
    () =>
      qualityA && qualityA.length
        ? qualityA
        : [
            { key: "sizeMm", label: "Size", target: 60, unit: "mm", min: 58.8, max: 61.2 },
            { key: "brix", label: "Sugar (Brix)", target: 12, unit: "°Bx", min: 11.76, max: 12.24 },
            { key: "defectPct", label: "Defects", target: 0, unit: "%", min: 0, max: 2 },
            { key: "moisturePct", label: "Moisture", target: 85, unit: "%", min: 83.3, max: 86.7 },
          ],
    [qualityA],
  )

  const [qualityValues, setQualityValues] = useState<Record<string, number>>(() => ({
    sizeMm: 60,
    brix: 12,
    defectPct: 0,
    moisturePct: 85,
  }))

  // -------- MOCK data --------
  const mockMakeToken = () =>
    `QR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  const mockPayload = (id: string, containers = 0): PrintPayload => {
    const base: FarmerOrder = {
      _id: id,
      itemId: "66e0item0000000000000001",
      type: "Tomato",
      variety: "Cluster",
      pictureUrl:
        "https://images.unsplash.com/photo-1546470427-c5b384e0b66b?q=80&w=420&fit=crop",
      pickUpDate: "2025-11-07",
      shift: "morning",
      farmerName: "Moshe Levi",
      farmName: "Levi Farms – Valley A",
      farmerId: "66e0farmer0000000000000001",
      logisticCenterId: "66e007000000000000000001",
      forcastedQuantityKg: 520,
      containers: [],
      farmerStatus: "pending",
      pickupAddress: "Moshav HaYogev 12, Emek Yizrael",
    }

    const cQrs: ContainerQR[] = []
    const foContainers: FoContainer[] = []
    for (let i = 1; i <= containers; i++) {
      const cid = `${id}_${i}`
      foContainers.push({ containerId: cid, weightKg: 0 })
      cQrs.push({
        token: mockMakeToken(),
        sig: mockMakeToken().slice(0, 16),
        scope: "container",
        subjectType: "Container",
        subjectId: cid,
      })
    }

    return {
      farmerOrder: { ...base, containers: foContainers },
      farmerOrderQR: {
        token: mockMakeToken(),
        sig: mockMakeToken().slice(0, 16),
        scope: "farmer-order",
      },
      containerQrs: cQrs,
    }
  }

  // -------- Derived values --------
  const orderedKg = useMemo(() => {
    const fo = payload?.farmerOrder
    const committed =
      fo?.forcastedQuantityKg ??
      fo?.forecastedQuantityKg ??
      fo?.sumOrderedQuantityKg ??
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

  const tolerancePct = 2
  const minAllowedTotal = useMemo(
    () => round2(orderedKg * (1 - tolerancePct / 100)),
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
    const hash = hashString(farmerOrderId)
    return pool[hash % pool.length] + " (placeholder)"
  }, [assignedDeliverer, farmerOrderId])

  const pickup = useMemo(() => {
    if (pickupAddress && pickupAddress.trim().length) return pickupAddress
    return (
      payload?.farmerOrder?.pickupAddress ||
      `${payload?.farmerOrder?.farmName ?? "Unknown farm"} (pickup point)`
    )
  }, [pickupAddress, payload?.farmerOrder?.pickupAddress, payload?.farmerOrder?.farmName])

  const itemName = useMemo(() => {
    const fo = payload?.farmerOrder
    return (fo?.variety ? `${fo?.type ?? ""} ${fo?.variety}`.trim() : fo?.type) || "Unknown Item"
  }, [payload?.farmerOrder])

  // -------- Load --------
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (mockMode) {
        await delay(150)
        setPayload(mockPayload(farmerOrderId, 0))
      } else {
        // TODO: wire API
        setPayload(mockPayload(farmerOrderId, 0))
      }
      setWeightsDraft({})
    } catch (e: any) {
      setError(e?.message || "Failed to load farmer order")
    } finally {
      setLoading(false)
    }
  }, [farmerOrderId])

  useEffect(() => {
    load()
  }, [load])

  // -------- Actions --------
  const openPrintPopup = useCallback(
    (qrs: ContainerQR[], title: string, sizePx = 180, cols = 4) => {
      const w = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800")
      if (!w) return

      const cards = qrs
        .map(
          (q) => `
          <div class="card">
            <div class="id">${q.subjectId}</div>
            <div class="qr" id="qr-${q.subjectId}"></div>
            <div class="token">${q.token}</div>
          </div>`,
        )
        .join("")

      const tokensJson = JSON.stringify(
        qrs.map((q) => ({ id: q.subjectId, token: q.token })),
      )

      w.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            :root { --size: ${sizePx}px; }
            *{box-sizing:border-box}
            body{font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;padding:16px}
            .toolbar{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:8px;border-bottom:1px solid #eee;display:flex;gap:8px}
            .btn{padding:8px 12px;border-radius:10px;border:1px solid #444;background:#111;color:#fff;cursor:pointer}
            .grid{display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));gap:12px}
            .card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 16px;border:1px solid #e5e7eb;border-radius:12px;break-inside:avoid}
            .id{font-weight:600;font-size:12px}
            .token{font-family: ui-monospace, SFMono-Regular, Menlo, monospace;font-size:11px;color:#374151;word-break:break-all;text-align:center}
            canvas{width:var(--size);height:var(--size)}
            @media print { .toolbar{display:none} body{padding:0} .grid{gap:8px} .card{page-break-inside:avoid;break-inside:avoid} }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button class="btn" onclick="window.print()">Print</button>
            <button class="btn" onclick="window.close()">Close</button>
          </div>
          <h2 style="margin:8px 0 16px">${title}</h2>
          <div class="grid">${cards}</div>
          <script>
            const data = ${tokensJson};
            function render(canvas, text){
              const size = Number(getComputedStyle(document.documentElement).getPropertyValue('--size').replace('px','')) || ${sizePx};
              canvas.width = size; canvas.height = size;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = "#000"; ctx.font = "12px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.strokeStyle="#000"; ctx.strokeRect(0,0,size,size);
              ctx.fillText(text, size/2, size/2, size - 12);
            }
            data.forEach(({id, token}) => {
              const el = document.getElementById("qr-"+id);
              if(!el) return;
              const c = document.createElement("canvas");
              render(c, token);
              el.appendChild(c);
            });
          </script>
        </body>
      </html>
    `)
      w.document.close()
      w.focus()
    },
    [],
  )

  const onInitContainers = useCallback(async () => {
    const count = Number(initCount)
    if (!Number.isInteger(count) || count <= 0) return
    try {
      setLoading(true)
      setError(null)
      if (mockMode) {
        await delay(120)
        setPayload((prev) => {
          const base = prev ?? mockPayload(farmerOrderId, 0)
          const start = (base.farmerOrder.containers?.length ?? 0) + 1
          const newContainers: FoContainer[] = []
          const newQrs: ContainerQR[] = []
          for (let i = 0; i < count; i++) {
            const seq = start + i
            const cid = `${base.farmerOrder._id}_${seq}`
            newContainers.push({ containerId: cid, weightKg: 0 })
            newQrs.push({
              token: mockMakeToken(),
              sig: mockMakeToken().slice(0, 16),
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
      } else {
        // TODO: API call
      }
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
  }, [farmerOrderId, initCount])

  const putWeights = useCallback(
    async (weights: Record<string, number>) => {
      const list = Object.entries(weights).map(([containerId, weightKg]) => ({
        containerId,
        weightKg,
      }))
      if (!list.length) return
      setSavingWeights(true)
      try {
        if (mockMode) {
          await delay(120)
          setPayload((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              farmerOrder: {
                ...prev.farmerOrder,
                containers: (prev.farmerOrder.containers ?? []).map((c) =>
                  weights[c.containerId] != null ? { ...c, weightKg: weights[c.containerId] } : c,
                ),
              },
            }
          })
        } else {
          // TODO: API call
        }
        setWeightsDraft({})
      } catch (e: any) {
        setError(e?.message || "Failed to update container weights")
      } finally {
        setSavingWeights(false)
      }
    },
    [],
  )

  const saveWeights = useCallback(() => putWeights(weightsDraft), [putWeights, weightsDraft])

  const qualityWarnings = useMemo(() => {
    const warns: string[] = []
    for (const m of qualityConfig) {
      const v = Number(qualityValues[m.key])
      if (!Number.isFinite(v)) continue
      const t = Number(m.target)
      const lower = m.min ?? t * 0.98
      const upper = m.max ?? t * 1.02
      if (v < lower || v > upper) {
        warns.push(
          `${m.label}: ${formatNum(v)}${m.unit ?? ""} deviates from Quality A target ${formatNum(t)}${
            m.unit ?? ""
          } by >2%`,
        )
      }
    }
    return warns
  }, [qualityConfig, qualityValues])

  const underfillWarning = useMemo(() => {
    if (!orderedKg) return null
    if (totalWeighedKg < minAllowedTotal) {
      return `Total weight ${formatNum(
        totalWeighedKg,
      )} kg is below allowed minimum (${formatNum(minAllowedTotal)} kg, i.e. max 2% under ${formatNum(
        orderedKg,
      )} kg). Please re-check.`
    }
    return null
  }, [orderedKg, totalWeighedKg, minAllowedTotal])

  // Card sizing map
  const sizeCfg = useMemo(
    () =>
      ({
        sm: { qr: 112, minCard: "220px", previewMin: "180px" },
        md: { qr: 140, minCard: "260px", previewMin: "220px" },
        lg: { qr: 168, minCard: "300px", previewMin: "260px" },
        xl: { qr: 208, minCard: "360px", previewMin: "320px" },
      } as const),
    [],
  )

  // -------- Render --------
  return (
    <Stack gap="6" p={{ base: "3", md: "4" }} w="full" minW="0">
      {/* Header / Summary */}
      <Card.Root variant="outline" overflow="hidden">
        <Card.Body gap="4">
          <HStack justifyContent="space-between" alignItems="flex-start" wrap="wrap" minW="0">
            <VStack alignItems="flex-start" gap="2" minW="200px" flex="1" minWidth={0}>
              <Text fontSize="xl" fontWeight="semibold">
                Farmer Order Report
              </Text>
              <HStack gap="2" wrap="wrap">
                <Badge>{payload?.farmerOrder?._id ?? farmerOrderId}</Badge>
                <Tag.Root><Tag.Label>Shift: {payload?.farmerOrder?.shift ?? "-"}</Tag.Label></Tag.Root>
                <Tag.Root><Tag.Label>Date: {payload?.farmerOrder?.pickUpDate ?? "-"}</Tag.Label></Tag.Root>
              </HStack>
              <Text color="fg.muted" lineClamp={1} minW="0">Pickup: {pickup}</Text>
              <Text color="fg.muted" lineClamp={1} minW="0">Deliverer: {assignedName}</Text>
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
                  <Text color="fg.muted" fontSize="sm">
                    Quality grade: A
                  </Text>
                </Stat.Root>
              </VStack>
            </HStack>
          </HStack>

          <Separator />

          {/* Actions */}
          <HStack gap="3" wrap="wrap">
            <Button onClick={() => setOpenInit(true)} disabled={loading}>
              Create containers
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpenPreview(true)}
              disabled={!(payload?.containerQrs?.length ?? 0)}
            >
              Preview & Print
            </Button>
            <Button onClick={load} variant="ghost" disabled={loading}>
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

      {/* Step indicator */}
      <Card.Root variant="subtle" overflow="hidden">
        <Card.Body>
          <HStack gap="3" wrap="wrap">
            <StepPill active>1. Create containers</StepPill>
            <StepPill active={!!(payload?.containerQrs?.length ?? 0)}>2. Weigh-in</StepPill>
            <StepPill active={!!(payload?.containerQrs?.length ?? 0)}>3. Print labels</StepPill>
          </HStack>
        </Card.Body>
      </Card.Root>

      {/* Quality – Grade A */}
      <Card.Root variant="outline" overflow="hidden">
        <Card.Body gap="4">
          <HStack justifyContent="space-between" alignItems="center" wrap="wrap">
            <Text fontSize="lg" fontWeight="semibold">
              Quality Standard – Grade A
            </Text>
            <Tag.Root colorPalette="green">
              <Tag.Label>Allowed tolerance ±{tolerancePct}%</Tag.Label>
            </Tag.Root>
          </HStack>

          <Fieldset.Root size="lg">
            <Fieldset.Legend>Measure against target</Fieldset.Legend>
            <Fieldset.HelperText>Warn if value differs by &gt;2% from Grade A target.</Fieldset.HelperText>
            <Fieldset.Content>
              <SimpleGridAuto cols={{ base: 1, sm: 2, md: 3, lg: 4 }} gap="4">
                {qualityConfig.map((m) => {
                  const v = qualityValues[m.key]
                  const t = m.target
                  const lower = m.min ?? t * 0.98
                  const upper = m.max ?? t * 1.02
                  const outOfRange = Number(v) < lower || Number(v) > upper
                  const deviation = Math.min(100, Math.abs(((Number(v) - t) / (t || 1)) * 100))
                  return (
                    <Card.Root key={m.key} variant={outOfRange ? "subtle" : "elevated"} overflow="hidden">
                      <Card.Body gap="3">
                        <Field.Root invalid={outOfRange}>
                          <Field.Label>{m.label}</Field.Label>
                          <HStack align="center" gap="2" wrap="wrap">
                            <InlineNumber
                              value={Number(v ?? 0)}
                              onValue={(num) =>
                                setQualityValues((prev) => ({
                                  ...prev,
                                  [m.key]: num,
                                }))
                              }
                            />
                            <Text color="fg.muted">{m.unit ?? ""}</Text>
                          </HStack>
                          <Field.HelperText>
                            Target: {formatNum(t)} {m.unit ?? ""} (±{tolerancePct}%)
                          </Field.HelperText>

                          <Progress.Root value={deviation} width="full">
                            <Progress.Track>
                              <Progress.Range />
                            </Progress.Track>
                          </Progress.Root>

                          <Show when={outOfRange}>
                            <Field.ErrorText asChild>
                              <span>⚠️ Deviation &gt; {tolerancePct}% – please double-check.</span>
                            </Field.ErrorText>
                          </Show>
                        </Field.Root>
                      </Card.Body>
                    </Card.Root>
                  )
                })}
              </SimpleGridAuto>
            </Fieldset.Content>
          </Fieldset.Root>

          <Show when={(qualityWarnings.length ?? 0) > 0}>
            <Alert.Root status="warning" title="Quality deviations detected">
              <Alert.Description asChild>
                <span>
                  {qualityWarnings.map((w, i) => (
                    <span key={i} style={{ display: "block" }}>
                      • {w}
                    </span>
                  ))}
                </span>
              </Alert.Description>
            </Alert.Root>
          </Show>
        </Card.Body>
      </Card.Root>

      {/* Containers – board */}
      <Card.Root variant="outline" overflow="hidden">
        <Card.Body gap="4" minW="0">
          <HStack justifyContent="space-between" alignItems="center" wrap="wrap">
            <Text fontSize="lg" fontWeight="semibold">
              Containers – Weigh-in
            </Text>
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
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Items items={["pending", "weighed", "all"]} />
            </SegmentGroup.Root>

            {/* Size */}
            <SegmentGroup.Root
              size="sm"
              value={qrCardSize}
              onValueChange={(e) => setQrCardSize((e.value as any) ?? "md")}
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Items items={["sm", "md", "lg", "xl"]} />
            </SegmentGroup.Root>

            <Box flex="1" />

            <HStack gap="2" minW={{ base: "full", md: "420px" }} w={{ base: "full", md: "auto" }}>
              <Input readOnly value={payload?.farmerOrderQR?.token ?? ""} placeholder="Farmer Order QR token" />
              <Button onClick={() => setOpenPreview(true)} variant="subtle">
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
                  <Button onClick={() => setOpenInit(true)} colorPalette="primary">
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
                const cfg = sizeCfg[qrCardSize]
                const qrPx = cfg.qr

                return (
                  <SimpleGrid minChildWidth={cfg.minCard} gap="4">
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
                        >
                          <Card.Body
                            gap="3"
                            alignItems="stretch"
                            display="grid"
                            gridTemplateRows="auto auto auto auto"
                            minW="0"
                          >
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

                            {/* Token */}
                            <MonoToken token={q.token} />

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
                                    setWeightsDraft((prev) => ({
                                      ...prev,
                                      [q.subjectId]: kg,
                                    }))
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
                                    >
                                      +{b}
                                    </Button>
                                  ))}
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    onClick={() =>
                                      setWeightsDraft((prev) => ({
                                        ...prev,
                                        [q.subjectId]: 0,
                                      }))
                                    }
                                    title="Set to 0"
                                  >
                                    Reset
                                  </Button>
                                </HStack>
                              </HStack>

                              {/* <Text color="fg.muted" fontSize="sm" textAlign={{ base: "left", sm: "right" }}>
                                <FormatNumber value={final} maximumFractionDigits={2} /> kg
                              </Text> */}
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
                            <MonoToken token={token} inline />
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

      {/* Create containers dialog */}
      <Dialog.Root open={openInit} onOpenChange={(e) => setOpenInit(e.open)}>
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
                <Button colorPalette="primary" onClick={onInitContainers} disabled={loading || Number(initCount) <= 0}>
                  Create & Continue
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Preview & Print */}
      <Dialog.Root open={openPreview} onOpenChange={(e) => setOpenPreview(e.open)}>
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
                      <Text color="fg.muted" lineClamp={1} minW="0">FO: {payload?.farmerOrder?._id ?? farmerOrderId}</Text>

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
                    const cfg = sizeCfg[qrCardSize]
                    const qrPx = cfg.qr

                    return (
                      <SimpleGrid
                        minChildWidth={cfg.previewMin}
                        gap="4"
                        css={{
                          "@media print": { gap: "8px" },
                        }}
                      >
                        {(payload?.containerQrs ?? []).map((q) => (
                          <Card.Root
                            key={q.subjectId}
                            overflow="hidden"
                            minW="0"
                            variant="subtle"
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
                              <MonoToken token={q.token} />
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
                <Button
                  colorPalette="primary"
                  onClick={() =>
                    openPrintPopup(
                      payload?.containerQrs ?? [],
                      `Containers for FO ${payload?.farmerOrder?._id ?? ""}`,
                      sizeCfg[qrCardSize].qr,
                      4,
                    )
                  }
                  disabled={!payload?.containerQrs?.length}
                >
                  Print
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

/* ----------------------- * Inline Inputs & Small Helpers * ----------------------*/

function InlineNumber(props: {
  value: number
  onValue: (n: number) => void
  min?: number
  max?: number
  step?: number
  width?: string
  size?: "xs" | "sm" | "md" | "lg"
}) {
  const { value, onValue, min = 0, max = 1_000_000, step = 0.1, size = "sm" } = props
  return (
    <NumberInput.Root
      value={String(Number.isFinite(value) ? value : 0)}
      onValueChange={(d) => onValue(safeNumber(d.value))}
      min={min}
      max={max}
      step={step}
      width={props.width ?? "220px"}
      maxW="100%"
      size={size}
      aria-label="Numeric value"
    >
      <NumberInput.Control />
      <NumberInput.Input inputMode="decimal" />
    </NumberInput.Root>
  )
}

function InlineWeightEditor(props: { value: number; onChange: (n: number) => void }) {
  return (
    <NumberInput.Root
      value={String(props.value ?? 0)}
      onValueChange={(d) => props.onChange(safeNumber(d.value))}
      min={0}
      max={2000}
      step={0.5}
      width="160px"
      maxW="100%"
      size="sm"
      aria-label="Weight (kg)"
    >
      <NumberInput.Control />
      <NumberInput.Input inputMode="decimal" />
    </NumberInput.Root>
  )
}

function MonoToken({ token, inline = false }: { token: string; inline?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1000)
    } catch {}
  }

  return (
    <HStack
      gap="2"
      alignItems="center"
      justifyContent="space-between"
      bg="bg.subtle"
      borderRadius="lg"
      px="3"
      py="2"
      w="full"
      minW="0"
      overflow="hidden"
    >
      <Text
        as="span"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize={inline ? "xs" : "sm"}
        color="fg.muted"
        lineClamp={1}
        title={token}
        minW="0"
        flex={1}
      >
        {token}
      </Text>

      <Tooltip content={copied ? "Copied!" : "Copy token"}>
        <Button
          size="xs"
          variant="subtle"
          onClick={copy}
          aria-label="Copy QR token"
          flexShrink={0}
        >
          {copied ? <LuCheck /> : <LuCopy />}
        </Button>
      </Tooltip>
    </HStack>
  )
}

function StepPill(props: { children: React.ReactNode; active?: boolean }) {
  return (
    <Tag.Root colorPalette={props.active ? "green" : undefined} variant={props.active ? "solid" : "outline"}>
      <Tag.Label>{props.children}</Tag.Label>
    </Tag.Root>
  )
}

function SimpleGridAuto(props: { cols?: any; gap?: string; children: React.ReactNode }) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: "repeat(1, minmax(0, 1fr))",
        sm: "repeat(2, minmax(0, 1fr))",
        md: "repeat(3, minmax(0, 1fr))",
        lg: "repeat(4, minmax(0, 1fr))",
        ...(props.cols || {}),
      }}
      gap={props.gap ?? "4"}
      w="full"
    >
      {props.children}
    </Box>
  )
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function formatNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "0"
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function safeNumber(v: string | number): number {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v)
  if (!Number.isFinite(n)) return 0
  return n
}

function hashString(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}
