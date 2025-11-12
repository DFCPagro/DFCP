import { useEffect, useMemo, useState, useCallback } from "react"
import {
  Grid,
  GridItem,
  Card,
  HStack,
  VStack,
  Heading,
  Text,
  Image,
  Badge,
  Separator,
  Spinner,
  Button,
} from "@chakra-ui/react"
import toast from "react-hot-toast"

import { claimFirstReadyTaskForCurrentShift, type PickerTask, type PlanBox, type PlanPiece } from "@/api/pickerTask"
import { getItemsCatalog } from "@/api/farmerInventory"
import { completePickerTask } from "@/api/pickerTask"

import HeaderBar from "@/pages/picker/picker-task/components/HeaderBar"
import TimerPill from "@/pages/picker/picker-task/components/TimerPill"
import SizeStrip, { type SizeCode } from "@/pages/picker/picker-task/components/SizeStrip"
import OverallCard from "@/pages/picker/picker-task/components/OverallCard"
import PackagesSelector from "@/pages/picker/picker-task/components/PackagesSelector"
import CurrentItemPanel from "@/pages/picker/picker-task/components/CurrentItemPanel"

/* Types */
type Phase = "load" | "pick"
const SLA_MIN = (priorityNum: number) => (priorityNum > 0 ? 20 : 45)
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

export type CatalogItem = {
  _id?: string
  type?: string
  variety?: string
  category?: string
  imageUrl?: string
  name?: string
}

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
  // track selected box size separately from the SizeStrip component
  const [selectedBoxSize, setSelectedBoxSize] = useState<SizeCode | null>(null)
  const [stepIndex, setStepIndex] = useState(0)

  // inputs
  const [weightInput, setWeightInput] = useState<string>("") // for kg
  const [unitsInput, setUnitsInput] = useState<string>("") // for unit

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
        if (!res?.task) {
          setClaiming(false)
          toast("No ready tasks for the current shift.", { icon: "ℹ️" })
          return
        }

        const t = res.task
        setTask(t)

        const prioMin = SLA_MIN(Number(t.priority ?? 0))
        setDeadline(Date.now() + prioMin * 60 * 1000)

        setSelectedBoxNo(null)
        setSelectedBoxSize(null)
        setStepIndex(0)

        const list = await getItemsCatalog()
        const map: Record<string, CatalogItem> = {}
        for (const it of list || []) {
          const id = String((it as any)?._id || "")
          if (id) map[id] = it
        }
        setCatalog(map)
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

  // done flags (local)
  const [localDoneKey, setLocalDoneKey] = useState<Record<string, boolean>>({})
  const pieceKey = (p: PlanPiece, i: number, boxNo: number | null = selectedBoxNo) =>
    `${boxNo ?? "?"}#${i}@${p.itemId}:${p.mode}:${p.pieceType}`

  const done = useMemo(() => Object.values(localDoneKey).filter(Boolean).length, [localDoneKey])
  const overall = totalPieces ? Math.min(100, Math.round((done / totalPieces) * 100)) : 0

  // compute "allDone" BEFORE any conditional returns to keep hook order stable
  const allDone = useMemo(() => {
    const boxes = task?.plan?.boxes ?? []
    for (const b of boxes) {
      for (let i = 0; i < (b.contents?.length ?? 0); i++) {
        const p = b.contents![i]
        if (!localDoneKey[pieceKey(p, i, b.boxNo ?? null)]) return false
      }
    }
    return boxes.length > 0
  }, [task, localDoneKey])

  // stats (all boxes)
  const boxStats = useMemo(() => {
    const acc: Record<"Small" | "Medium" | "Large" | "Unknown", { count: number; boxNos: number[]; liters: number; kg: number }> =
      { Small: { count: 0, boxNos: [], liters: 0, kg: 0 }, Medium: { count: 0, boxNos: [], liters: 0, kg: 0 }, Large: { count: 0, boxNos: [], liters: 0, kg: 0 }, Unknown: { count: 0, boxNos: [], liters: 0, kg: 0 } }
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
      const hasPending = (b.contents ?? []).some((p, i) => !localDoneKey[pieceKey(p, i, b.boxNo ?? null)])
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

  // first box by size with pending
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
      const target =
        firstBoxBySize(sz) ??
        // if first time, allow any box of that size
        (task?.plan?.boxes ?? []).find((b) => mapBoxTypeToSizeCode(b.boxType) === sz)?.boxNo ??
        null
      if (target == null) {
        toast("No boxes for that size.")
        return
      }
      setSelectedBoxNo(target)
      setSelectedBoxSize(sz)
      setStepIndex(0)
      setPhase("pick")
      setArrivalConfirmed(false)
      setWeightInput("")
      setUnitsInput("")
    },
    [task, firstBoxBySize],
  )

  // reset gating on item change
  useEffect(() => {
    setArrivalConfirmed(false)
    setWeightInput("")
    setUnitsInput("")
  }, [stepIndex, selectedBoxNo])

  const confirmArrival = () => {
    if (!cur) return
    setArrivalConfirmed(true)
    if (cur.mode === "kg") {
      const reqKg = Number(cur.units ?? 1) * Number(cur.estWeightKgPiece ?? 0)
      setWeightInput(reqKg > 0 ? String(Math.round(reqKg * 100) / 100) : "0")
    } else {
      setUnitsInput(String(cur.units ?? 1))
    }
    toast.success("Arrival confirmed")
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
    } else {
      const u = Number(unitsInput)
      if (!Number.isInteger(u) || u <= 0) {
        toast.error("Enter units")
        return
      }
    }

    setLocalDoneKey((prev) => ({ ...prev, [pieceKey(cur, stepIndex)]: true }))

    if (stepIndex + 1 < piecesInBox.length) {
      setStepIndex((i) => i + 1)
      return
    }

    toast.success(`Box #${selectedBoxNo ?? ""} completed. Select another package.`)
    setSelectedBoxNo(null)
    setSelectedBoxSize(null)
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
      </VStack>
    )
  }

  const timeLabel = fmt(timeLeft)

  /* ---------- PHASE: LOAD ---------- */
  if (phase === "load") {
    return (
      <>
        <HeaderBar orderId={task.orderId} priority={Number(task.priority ?? 0)} phase={phase} overall={overall} />
        <TimerPill priority={Number(task.priority ?? 0)} timeLabel={timeLabel} />

        <Grid templateColumns={{ base: "1fr", md: "repeat(12, 1fr)" }} gap={6}>
          <GridItem colSpan={{ base: 12, md: 12 }}>
            <Card.Root rounded="2xl" borderWidth="1px" alignItems="center">
              <Card.Header alignSelf={"flex-start"}>
                <HStack justify="space-between" w="full" align="left" alignItems="left">
                  <Text color="fg.muted" alignSelf={"flex-start"}>
                    {task.shiftDate} • {task.shiftName}
                  </Text>
                </HStack>
              </Card.Header>
              <Card.Body>
                {/* overall counts */}

                {/* <Text color="fg.muted">Show items</Text>
                <IconButton aria-label="Toggle items" size="sm" variant="ghost" onClick={() => setCatalogOpen((v) => !v)}>
                  {catalogOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </IconButton> */}

                {catalogOpen && (
                  <>
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
                  </>
                )}
              </Card.Body>

              <Card.Footer alignItems="center">
                <PackagesSelector
                  title="Start picking with:"
                  sizes={sizeCount}
                  unfinishedBoxNos={new Set<number>()}
                  onPickSize={(sz) => startWithSize(sz)}
                  onPickBox={null}
                  showBoxes={false}
                />
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
  const isUnitsValid = !isKg ? Number.isInteger(Number(unitsInput)) && Number(unitsInput) > 0 : true

  return (
    <>
      <HeaderBar orderId={task.orderId} priority={Number(task.priority ?? 0)} phase={phase} overall={overall} />
      <TimerPill priority={Number(task.priority ?? 0)} timeLabel={timeLabel} />

      <Grid templateColumns={{ base: "1fr", md: "repeat(12, 1fr)" }} gap={6}>
        {/* Overall */}
        <GridItem colSpan={{ base: 12, md: 12 }}>
          <OverallCard
            done={done}
            totalPieces={totalPieces}
            overallPercent={overall}
            totalBoxes={task.plan?.summary?.totalBoxes ?? task.plan?.boxes?.length ?? 0}
            totalKg={Math.round((task.plan?.summary?.totalKg ?? 0) * 10) / 10}
          />
        </GridItem>

        {/* Selector of unfinished when no box chosen */}
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
                <PackagesSelector
                  sizes={unfinishedSizeCount}
                  unfinishedBoxNos={unfinishedBoxNos}
                  onPickSize={(sz) => startWithSize(sz)}
                  onPickBox={(no) => {
                    setSelectedBoxNo(no)
                    // infer size from selected box
                    const bx = (task?.plan?.boxes ?? []).find((b) => b.boxNo === no)
                    setSelectedBoxSize(mapBoxTypeToSizeCode(bx?.boxType))
                    setStepIndex(0)
                  }}
                  showBoxes
                />
              </Card.Body>
            </Card.Root>
          </GridItem>
        )}

        {/* All done → finish button */}
        {selectedBoxNo == null && allDone && (
          <GridItem colSpan={{ base: 12, md: 12 }}>
            <Card.Root rounded="2xl" borderWidth="1px">
              <Card.Body>
                <VStack align="start" gap={3}>
                  <Heading size="md">All packages completed</Heading>
                  <Text>Press Finish packing to complete the task.</Text>
                  <Button
                    colorPalette="teal"
                    onClick={async () => {
                      try {
                        await completePickerTask(task._id || "")
                        toast.success("Task completed successfully.")
                        window.location.href = "/picker/dashboard"
                      } catch (e: any) {
                        toast.error(e?.message || "Failed to complete the task.")
                      }
                    }}
                  >
                    Finish packing
                  </Button>
                </VStack>
              </Card.Body>
            </Card.Root>
          </GridItem>
        )}

        {/* Current item panel */}
        {selectedBoxNo != null && (
          <GridItem colSpan={{ base: 12, md: 12 }}>
            <CurrentItemPanel
              cur={cur}
              curName={curName}
              curImg={curImg}
              selectedBoxNo={selectedBoxNo}
              // match CurrentItemPanel prop name expected previously: SizeStrip
              SizeStrip={selectedBoxSize || ""}
              arrivalConfirmed={arrivalConfirmed}
              isKg={!!isKg}
              isKgValid={!!isKgValid}
              isUnitsValid={!!isUnitsValid}
              weightInput={weightInput}
              unitsInput={unitsInput}
              setWeightInput={setWeightInput}
              setUnitsInput={setUnitsInput}
              onConfirmArrival={confirmArrival}
              onContinue={saveAndNext}
            />
          </GridItem>
        )}
      </Grid>
    </>
  )
}
