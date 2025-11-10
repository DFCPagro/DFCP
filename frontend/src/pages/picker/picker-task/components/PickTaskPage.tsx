import { useEffect, useMemo, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Grid,
  GridItem,
  Card,
  HStack,
  VStack,
  Heading,
  Text,
  Button,
  Progress,
  Image,
  Badge,
  Separator,
  Spinner,
  Show,
  IconButton,
  Input,
} from "@chakra-ui/react"
import { ChevronDown, ChevronUp } from "lucide-react"
import toast from "react-hot-toast"

import {
  claimFirstReadyTaskForCurrentShift,
  type PickerTask,
  type PlanBox,
  type PlanPiece,
} from "@/api/pickerTask"
import { getItemsCatalog } from "@/api/farmerInventory"

import HeaderBar from "@/pages/picker/picker-task/components/HeaderBar"
import TimerPill from "@/pages/picker/picker-task/components/TimerPill"
import SizeStrip, { type SizeCode } from "@/pages/picker/picker-task/components/SizeStrip"
import { type CatalogItem } from "@/pages/picker/picker-task/components/PieceRow"

/* Types */
type Phase = "load" | "pick"
const SLA_MIN = (priorityNum: number) => (priorityNum > 0 ? 20 : 45)
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

/* Helpers */
function mapBoxTypeToSizeCode(boxType?: string): SizeCode {
  const t = String(boxType || "").toLowerCase()
  if (t.startsWith("large")) return "L"
  if (t.startsWith("medium")) return "M"
  if (t.startsWith("small")) return "S"
  return "U"
}

function normalizeBoxType(t?: string): "Small" | "Medium" | "Large" | "Unknown" {
  const s = String(t || "").trim().toLowerCase()
  if (s.startsWith("small")) return "Small"
  if (s.startsWith("medium")) return "Medium"
  if (s.startsWith("large")) return "Large"
  return "Unknown"
}

export default function PickTaskPage() {
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>("load")
  const [task, setTask] = useState<PickerTask | null>(null)

  // catalog
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({})
  const getMeta = useCallback(
    (itemId?: string) => {
      if (!itemId) return undefined
      return catalog[itemId] || catalog[String(itemId)] || undefined
    },
    [catalog],
  )

  // selection & progression
  const [selectedBoxNo, setSelectedBoxNo] = useState<number | null>(null)
  const [stepIndex, setStepIndex] = useState(0)

  // weight entry
  const [weightInput, setWeightInput] = useState<string>("")

  // gating
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false)

  // timer
  const [deadline, setDeadline] = useState<number>(() => Date.now() + 20 * 60 * 1000)
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const timeLeft = Math.max(0, Math.floor((deadline - now) / 1000))

  // fetch task + catalog
  const [claiming, setClaiming] = useState(true)
  const [catalogOpen, setCatalogOpen] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await claimFirstReadyTaskForCurrentShift()
        if (!alive) return
        if (!res?.claimed || !res.task) {
          setClaiming(false)
          toast("No ready tasks for the current shift.", { icon: "ℹ️" })
          return
        }

        const t = res.task
        setTask(t)

        // SLA timer by priority
        const prioMin = SLA_MIN(Number(t.priority ?? 0))
        setDeadline(Date.now() + prioMin * 60 * 1000)

        // Picker must choose size
        setSelectedBoxNo(null)
        setStepIndex(0)

        // Load catalog
        const allIds = Array.from(
          new Set((t.plan?.boxes ?? []).flatMap((b) => (b.contents ?? []).map((p) => String(p.itemId)))),
        )
        if (allIds.length) {
          const list = await getItemsCatalog()
          const map: Record<string, CatalogItem> = {}
          for (const it of list || []) {
            const id = String((it as any)?._id || "")
            if (id) map[id] = it
          }
          setCatalog(map)
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to claim a task")
      } finally {
        if (alive) setClaiming(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // derived
  const currentBox: PlanBox | null = useMemo(() => {
    if (!task || selectedBoxNo == null) return null
    return task.plan?.boxes?.find((b) => b.boxNo === selectedBoxNo) ?? null
  }, [task, selectedBoxNo])

  const piecesInBox: PlanPiece[] = useMemo(() => currentBox?.contents ?? [], [currentBox])
  const cur: PlanPiece | undefined = piecesInBox[stepIndex]

  const totalPieces = useMemo(
    () => (task?.plan?.boxes || []).reduce((acc, b) => acc + (b.contents?.length || 0), 0),
    [task],
  )

  // local done flags
  const [localDoneKey, setLocalDoneKey] = useState<Record<string, boolean>>({})
  const pieceKey = (p: PlanPiece, i: number) =>
    `${selectedBoxNo ?? "?"}#${i}@${p.itemId}:${p.mode}:${p.pieceType}`

  const done = useMemo(() => Object.values(localDoneKey).filter(Boolean).length, [localDoneKey])
  const overall = totalPieces ? Math.min(100, Math.round((done / totalPieces) * 100)) : 0

  // stats (all boxes)
  const boxStats = useMemo(() => {
    const acc: Record<"Small" | "Medium" | "Large" | "Unknown", { count: number; boxNos: number[]; liters: number; kg: number }> =
      {
        Small: { count: 0, boxNos: [], liters: 0, kg: 0 },
        Medium: { count: 0, boxNos: [], liters: 0, kg: 0 },
        Large: { count: 0, boxNos: [], liters: 0, kg: 0 },
        Unknown: { count: 0, boxNos: [], liters: 0, kg: 0 },
      }
    for (const b of task?.plan?.boxes ?? []) {
      const t = normalizeBoxType(b.boxType)
      acc[t].count += 1
      if (typeof b.boxNo === "number") acc[t].boxNos.push(b.boxNo)
      if (typeof b.estFillLiters === "number") acc[t].liters += b.estFillLiters
      if (typeof b.estWeightKg === "number") acc[t].kg += b.estWeightKg
    }
    for (const k of Object.keys(acc) as Array<keyof typeof acc>) {
      acc[k].boxNos.sort((a, b) => a - b)
      acc[k].liters = Math.round(acc[k].liters * 100) / 100
      acc[k].kg = Math.round(acc[k].kg * 100) / 100
    }
    return acc
  }, [task])

  const sizeCount = useMemo(
    () =>
      ({
        L: boxStats.Large.count,
        M: boxStats.Medium.count,
        S: boxStats.Small.count,
        U: boxStats.Unknown.count,
      }) as Record<SizeCode, number>,
    [boxStats],
  )

  // unfinished boxes only
  const unfinishedBoxNos = useMemo(() => {
    const result = new Set<number>()
    for (const b of task?.plan?.boxes ?? []) {
      const hasPending = (b.contents ?? []).some((p, i) => !localDoneKey[`${b.boxNo ?? "?"}#${i}@${p.itemId}:${p.mode}:${p.pieceType}`])
      if (hasPending && typeof b.boxNo === "number") result.add(b.boxNo)
    }
    return result
  }, [task, localDoneKey])

  const unfinishedSizeCount = useMemo(() => {
    const counts: Record<SizeCode, number> = { L: 0, M: 0, S: 0, U: 0 }
    for (const b of task?.plan?.boxes ?? []) {
      if (!unfinishedBoxNos.has(b.boxNo as number)) continue
      counts[mapBoxTypeToSizeCode(b.boxType)] += 1
    }
    return counts
  }, [task, unfinishedBoxNos])

  // find next box by size with pending
  const firstBoxBySize = useCallback(
    (sz: SizeCode) => {
      if (!task) return null
      const boxes = (task.plan?.boxes ?? []).filter(
        (b) => mapBoxTypeToSizeCode(b.boxType) === sz && unfinishedBoxNos.has(b.boxNo as number),
      )
      if (!boxes.length) return null
      return boxes[0].boxNo
    },
    [task, unfinishedBoxNos],
  )

  const startWithSize = useCallback(
    (sz: SizeCode) => {
      const target = firstBoxBySize(sz)
      if (target == null) {
        toast("No unfinished boxes for that size.")
        return
      }
      setSelectedBoxNo(target)
      setStepIndex(0)
      setPhase("pick")
      setArrivalConfirmed(false)
      setWeightInput("")
    },
    [firstBoxBySize],
  )

  // reset gating on item change
  useEffect(() => {
    setArrivalConfirmed(false)
    setWeightInput("")
  }, [stepIndex, selectedBoxNo])

  const confirmArrival = () => {
    if (!cur) return
    toast.success("Arrival confirmed")
    setArrivalConfirmed(true)
  }

  const saveAndNext = () => {
    if (!cur) return
    if (!arrivalConfirmed) {
      toast.error("Press Confirm arrival first")
      return
    }
    if (cur.mode === "kg") {
      const kg = Number(weightInput)
      if (!isFinite(kg) || kg <= 0) {
        toast.error("Enter weight in kg")
        return
      }
    }

    setLocalDoneKey((prev) => ({ ...prev, [pieceKey(cur, stepIndex)]: true }))

    // next item in same box
    if (stepIndex + 1 < piecesInBox.length) {
      setStepIndex((i) => i + 1)
      return
    }

    // box completed: go back to unfinished packages selector
    toast.success(`Box #${selectedBoxNo ?? ""} completed. Select another package.`)
    setSelectedBoxNo(null)
    setStepIndex(0)
  }

  // loading / empty states
  if (claiming) {
    return (
      <VStack align="start" p={6}>
        <HStack gap={3}>
          <Spinner />
          <Text fontSize="lg">Loading your task and catalog…</Text>
        </HStack>
      </VStack>
    )
  }

  if (!task) {
    return (
      <VStack align="start" p={6} gap={4}>
        <Text fontSize="lg">No ready tasks available right now.</Text>
        <Button onClick={() => navigate("/picker/dashboard")} variant="outline">
          Back to dashboard
        </Button>
      </VStack>
    )
  }

  const timeLabel = fmt(timeLeft)
  const allDone = useMemo(() => {
    const boxes = task.plan?.boxes ?? []
    for (const b of boxes) {
      for (let i = 0; i < (b.contents?.length ?? 0); i++) {
        const p = b.contents![i]
        if (!localDoneKey[`${b.boxNo ?? "?"}#${i}@${p.itemId}:${p.mode}:${p.pieceType}`]) return false
      }
    }
    return boxes.length > 0
  }, [task, localDoneKey])

  /* ---------- PHASE: LOAD ---------- */
  if (phase === "load") {
    return (
      <>
        <HeaderBar orderId={task.orderId} priority={Number(task.priority ?? 0)} phase={phase} overall={overall} />
        <TimerPill priority={Number(task.priority ?? 0)} timeLabel={timeLabel} />

        <Grid templateColumns={{ base: "1fr", md: "repeat(12, 1fr)" }} gap={6}>
          <GridItem colSpan={{ base: 12, md: 12 }}>
            <Card.Root rounded="2xl" borderWidth="1px">
              <Card.Header>
                <HStack justify="space-between" w="full">
                  <Heading size="lg">Packages</Heading>
                  <Text color="fg.muted">
                    {task.shiftDate} • {task.shiftName}
                  </Text>
                </HStack>
              </Card.Header>
              <Card.Body>
                {/* overall counts */}
                <VStack align="stretch" gap={2} mb={3}>
                  {(["Large", "Medium", "Small", "Unknown"] as const).map((t) => {
                    const row = boxStats[t]
                    if (!row.count) return null
                    return (
                      <HStack key={t} justify="space-between" wrap="wrap">
                        <HStack gap={3}>
                          <Badge variant="solid">{t}</Badge>
                          <Text>x{row.count}</Text>
                        </HStack>
                        <HStack gap={3}>
                          <Badge variant="subtle">boxes: [{row.boxNos.join(", ")}]</Badge>
                          <Badge variant="surface">~{row.liters} L</Badge>
                          <Badge variant="surface" colorPalette="teal">
                            ~{row.kg} kg
                          </Badge>
                        </HStack>
                      </HStack>
                    )
                  })}
                </VStack>

                <SizeStrip sizes={sizeCount} />

                <Separator my={4} />
                <HStack justify="space-between" w="full">
                  <Text fontSize="md" color="fg.muted">
                    Confirm when boxes are on your cart.
                  </Text>
                  <HStack>
                    <Text color="fg.muted">Show items</Text>
                    <IconButton
                      aria-label="Toggle items"
                      size="sm"
                      variant="ghost"
                      onClick={() => setCatalogOpen((v) => !v)}
                    >
                      {catalogOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </IconButton>
                  </HStack>
                </HStack>

                <Show when={catalogOpen}>
                  <Separator my={4} />
                  <VStack align="stretch" gap={2}>
                    {(task.plan?.summary?.byItem ?? []).map((bi, i) => {
                      const meta = getMeta(String(bi.itemId))
                      const displayName =
                        bi.itemName || meta?.name || `${meta?.type ?? ""} ${meta?.variety ?? ""}`.trim() || bi.itemId
                      const img = meta?.imageUrl || "/img/item-placeholder.png"
                      return (
                        <HStack key={`${bi.itemId}-${i}`} gap={3} py={1}>
                          <Image src={img} alt={displayName} rounded="md" w="48px" h="48px" objectFit="cover" />
                          <VStack align="start" gap={0}>
                            <Text fontWeight="semibold">{displayName}</Text>
                            <HStack gap={3}>
                              <Badge variant="surface">bags {bi.bags}</Badge>
                              <Badge variant="surface">bundles {bi.bundles}</Badge>
                              {typeof bi.totalKg === "number" && (
                                <Badge variant="surface" colorPalette="teal">
                                  ~{Math.round(bi.totalKg * 10) / 10} kg
                                </Badge>
                              )}
                              {typeof bi.totalUnits === "number" && (
                                <Badge variant="surface" colorPalette="purple">
                                  {bi.totalUnits} units
                                </Badge>
                              )}
                            </HStack>
                          </VStack>
                        </HStack>
                      )
                    })}
                  </VStack>
                </Show>
              </Card.Body>

              <Card.Footer>
                <HStack gap={3} wrap="wrap" align="center">
                  <Text fontWeight="semibold" mr={2}>
                    Start picking with:
                  </Text>
                  <Button size="lg" onClick={() => startWithSize("L")} disabled={!sizeCount.L}>
                    Large
                  </Button>
                  <Button size="lg" onClick={() => startWithSize("M")} disabled={!sizeCount.M}>
                    Medium
                  </Button>
                  <Button size="lg" onClick={() => startWithSize("S")} disabled={!sizeCount.S}>
                    Small
                  </Button>

                  <Button size="lg" variant="outline" onClick={() => navigate("/picker/dashboard")}>
                    Cancel
                  </Button>
                </HStack>
              </Card.Footer>
            </Card.Root>
          </GridItem>
        </Grid>
      </>
    )
  }

  /* ---------- PHASE: PICK ---------- */
  const curMeta = getMeta(cur?.itemId)
  const curName =
    cur?.itemName || curMeta?.name || `${curMeta?.type ?? ""} ${curMeta?.variety ?? ""}`.trim() || cur?.itemId || ""
  const curImg = curMeta?.imageUrl || "/img/item-placeholder.png"

  const isKg = cur?.mode === "kg"
  const isKgValid = isKg ? isFinite(Number(weightInput)) && Number(weightInput) > 0 : true

  return (
    <>
      <HeaderBar orderId={task.orderId} priority={Number(task.priority ?? 0)} phase={phase} overall={overall} />
      <TimerPill priority={Number(task.priority ?? 0)} timeLabel={timeLabel} />

      <Grid templateColumns={{ base: "1fr", md: "repeat(12, 1fr)" }} gap={6}>
        {/* Overall */}
        <GridItem colSpan={{ base: 12, md: 12 }}>
          <Card.Root rounded="2xl" borderWidth="1px">
            <Card.Header>
              <HStack justify="space-between" w="full">
                <Heading size="md">Overall</Heading>
                <Text color="fg.muted">
                  {(task.plan?.summary?.totalBoxes ?? (task.plan?.boxes?.length ?? 0))} boxes • ~
                  {Math.round((task.plan?.summary?.totalKg ?? 0) * 10) / 10} kg
                </Text>
              </HStack>
            </Card.Header>
            <Card.Body>
              <VStack align="start" gap={3}>
                <Text fontSize="lg">
                  {done}/{totalPieces} pieces
                </Text>
                <Progress.Root value={overall} size="lg" w="full">
                  <Progress.Track />
                  <Progress.Range />
                </Progress.Root>
              </VStack>
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* Unfinished packages selector when no box chosen */}
        {selectedBoxNo == null && !allDone && (
          <GridItem colSpan={{ base: 12, md: 12 }}>
            <Card.Root rounded="2xl" borderWidth="1px">
              <Card.Header>
                <HStack justify="space-between" w="full">
                  <Heading size="md">Unfinished packages</Heading>
                  <Text color="fg.muted">Pick a size to continue</Text>
                </HStack>
              </Card.Header>
              <Card.Body>
                <SizeStrip
                  sizes={unfinishedSizeCount}
                  clickable
                  onPickSize={(sz) => startWithSize(sz)}
                />
                <Separator my={4} />
                <HStack wrap="wrap" gap={2}>
                  {Array.from(unfinishedBoxNos).sort((a, b) => a - b).map((no) => (
                    <Button
                      key={no}
                      size="md"
                      variant="surface"
                      onClick={() => {
                        setSelectedBoxNo(no)
                        setStepIndex(0)
                      }}
                    >
                      Box #{no}
                    </Button>
                  ))}
                </HStack>
              </Card.Body>
            </Card.Root>
          </GridItem>
        )}

        {/* All done message */}
        {selectedBoxNo == null && allDone && (
          <GridItem colSpan={{ base: 12, md: 12 }}>
            <Card.Root rounded="2xl" borderWidth="1px">
              <Card.Body>
                <VStack align="start" gap={3}>
                  <Heading size="md">All packages completed</Heading>
                  <Text>You can return to dashboard.</Text>
                  <Button onClick={() => navigate("/picker/dashboard")} colorPalette="teal">
                    Back to dashboard
                  </Button>
                </VStack>
              </Card.Body>
            </Card.Root>
          </GridItem>
        )}

        {/* Current item: image left, controls right */}
        {selectedBoxNo != null && (
          <GridItem colSpan={{ base: 12, md: 12 }}>
            <Card.Root rounded="2xl" borderWidth="1px">
              <Card.Header>
                <HStack justify="space-between" w="full">
                  <HStack gap={3}>
                    <Heading size="md">{cur ? curName : "Box complete"}</Heading>
                    <Badge size="lg" variant="outline">{`Box #${selectedBoxNo}`}</Badge>
                  </HStack>
                </HStack>
              </Card.Header>
              <Card.Body>
                {cur ? (
                  <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6} alignItems="start">
                    {/* Left: image */}
                    <Image src={curImg} alt={curName} rounded="lg" maxH="360px" w="100%" objectFit="cover" />

                    {/* Right: details, input, buttons */}
                    <VStack align="stretch" gap={5}>
                      <HStack gap={6} wrap="wrap">
                        <Badge size="lg" variant="surface" colorPalette="purple">
                          Piece: {cur.pieceType}
                        </Badge>
                        <Badge size="lg" variant="surface" colorPalette="teal">
                          Mode: {cur.mode}
                        </Badge>
                        {cur.units != null && cur.mode !== "kg" && (
                          <Badge size="lg" variant="surface" colorPalette="purple">
                            Units: {cur.units}
                          </Badge>
                        )}
                      </HStack>

                      {/* Show KG input only AFTER arrival is confirmed */}
                      {isKg && arrivalConfirmed && (
                        <VStack align="stretch" gap={2}>
                          <Text fontWeight="semibold">Enter measured weight</Text>
                          <HStack gap={3} maxW="sm">
                            <Input
                              inputMode="decimal"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={weightInput}
                              onChange={(e) => setWeightInput(e.target.value)}
                              aria-label="Actual weight in kilograms"
                            />
                            <Text>kg</Text>
                          </HStack>
                          <Text color="fg.muted" fontSize="sm">
                            Est kg/pc: {Math.round(cur.estWeightKgPiece * 100) / 100} • Liters: {Math.round(cur.liters * 10) / 10}
                          </Text>
                        </VStack>
                      )}

                      {!isKg && (
                        <Text color="fg.muted">
                          Est kg/pc: {Math.round(cur.estWeightKgPiece * 100) / 100} • Liters: {Math.round(cur.liters * 10) / 10}
                        </Text>
                      )}

                      {/* Right column buttons */}
                      <HStack gap={3} justify="center" align="center" minH="100px">
                        {!arrivalConfirmed && (
                          <Button
                            size="lg"
                            variant="solid"
                            colorPalette="blue"
                            onClick={confirmArrival}
                            disabled={!cur}
                            rounded="full"
                          >
                            Confirm arrival
                          </Button>
                        )}
                        {arrivalConfirmed && (
                          <Button
                            size="lg"
                            colorPalette="teal"
                            onClick={saveAndNext}
                            disabled={!cur || !selectedBoxNo || !isKgValid}
                            rounded="full"
                          >
                            Continue
                          </Button>
                        )}
                      </HStack>
                    </VStack>
                  </Grid>
                ) : (
                  <VStack align="start" gap={4}>
                    <Text fontSize="lg">All pieces done for this box.</Text>
                    <Button
                      size="lg"
                      colorPalette="teal"
                      onClick={() => {
                        // back to unfinished selector
                        setSelectedBoxNo(null)
                        setStepIndex(0)
                      }}
                    >
                      Select another package
                    </Button>
                  </VStack>
                )}
              </Card.Body>
            </Card.Root>
          </GridItem>
        )}
      </Grid>
    </>
  )
}
