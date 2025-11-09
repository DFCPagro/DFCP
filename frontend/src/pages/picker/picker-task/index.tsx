import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
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
  Input,
  Separator,
  Spinner,
  Show,
  IconButton,
} from "@chakra-ui/react";
import { Package as PackageIcon, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

import {
  claimFirstReadyTaskForCurrentShift,
  type PickerTask,
  type PlanBox,
  type PlanPiece,
} from "@/api/pickerTask";

// ⬇️ same catalog API we used in the task modal
import { getItemsCatalog } from "@/api/farmerInventory";

type Phase = "load" | "pick";
const SLA_MIN = (priorityNum: number) => (priorityNum > 0 ? 20 : 45);
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type CatalogItem = {
  _id?: string;
  type?: string;
  variety?: string;
  category?: string;
  imageUrl?: string;
  name?: string; // if your BE provides a combined display name
};

function mapBoxTypeToSizeCode(boxType?: string): "L" | "M" | "S" | "U" {
  const t = String(boxType || "").toLowerCase();
  if (t.startsWith("large")) return "L";
  if (t.startsWith("medium")) return "M";
  if (t.startsWith("small")) return "S";
  return "U";
}

/* Small package glyph */
function PkgGlyph() {
  return (
    <Box
      w="36px"
      h="36px"
      rounded="md"
      borderWidth="1px"
      bg="bg.subtle"
      _dark={{ bg: "blackAlpha.300" }}
      display="grid"
      placeItems="center"
    >
      <PackageIcon size={18} />
    </Box>
  );
}

/* Size strip: renders only sizes that exist */
function SizeStrip({
  sizes,
  clickable = false,
  onPickSize,
  borderAccent = true,
}: {
  sizes: Partial<Record<"L" | "M" | "S" | "U", number>>;
  clickable?: boolean;
  onPickSize?: (sizeCode: "L" | "M" | "S" | "U") => void;
  borderAccent?: boolean;
}) {
  const order: Array<"L" | "M" | "S" | "U"> = ["L", "M", "S", "U"];
  const label: Record<"L" | "M" | "S" | "U", string> = { L: "Large", M: "Medium", S: "Small", U: "Box" };

  const visible = order.filter((sz) => (sizes[sz] ?? 0) > 0);
  if (visible.length === 0) return null;

  return (
    <Box
      rounded="xl"
      borderWidth="2px"
      borderColor={borderAccent ? "blackAlpha.600" : "blackAlpha.300"}
      _dark={{ borderColor: borderAccent ? "whiteAlpha.700" : "whiteAlpha.400" }}
      overflow="hidden"
    >
      <Grid templateColumns={`repeat(${visible.length}, 1fr)`} gap="5px">
        {visible.map((sz, idx) => {
          const count = sizes[sz] ?? 0;
          return (
            <Box
              key={sz}
              p={{ base: 4, md: 6 }}
              position="relative"
              cursor={clickable ? "pointer" : "default"}
              onClick={clickable && onPickSize ? () => onPickSize(sz) : undefined}
              _hover={clickable ? { bg: "bg.subtle", _dark: { bg: "blackAlpha.300" } } : undefined}
            >
              {idx < visible.length - 1 && (
                <Box
                  position="absolute"
                  top="0"
                  right="0"
                  bottom="0"
                  borderRightWidth="2px"
                  borderColor="blackAlpha.600"
                  _dark={{ borderColor: "whiteAlpha.400" }}
                />
              )}
              <VStack gap={2}>
                <PkgGlyph />
                <Text fontSize="xl" fontWeight="bold">
                  {label[sz]}
                </Text>
                <Text fontSize="lg" fontWeight="semibold">
                  x{count}
                </Text>
              </VStack>
            </Box>
          );
        })}
      </Grid>
    </Box>
  );
}

export default function PickTaskPage() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("load");
  const [task, setTask] = useState<PickerTask | null>(null);

  // item catalog (map by id)
  const [catalog, setCatalog] = useState<Record<string, CatalogItem>>({});
  const getMeta = useCallback(
    (itemId?: string) => {
      if (!itemId) return undefined;
      return catalog[itemId] || catalog[String(itemId)] || undefined;
    },
    [catalog]
  );

  // selection & progression
  const [selectedBoxNo, setSelectedBoxNo] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  // local input (for kg mode)
  const [weightInput, setWeightInput] = useState("");

  // timer
  const [deadline, setDeadline] = useState<number>(() => Date.now() + 20 * 60 * 1000);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeLeft = Math.max(0, Math.floor((deadline - now) / 1000));

  // CLAIM + LOAD CATALOG on mount
  const [claiming, setClaiming] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await claimFirstReadyTaskForCurrentShift();
        if (!alive) return;
        if (!res?.claimed || !res.task) {
          setClaiming(false);
          toast("No ready tasks for the current shift.", { icon: "ℹ️" });
          return;
        }

        const t = res.task;
        setTask(t);

        // SLA timer by priority
        const prioMin = SLA_MIN(Number(t.priority ?? 0));
        setDeadline(Date.now() + prioMin * 60 * 1000);

        // default selection
        setSelectedBoxNo(t.plan?.boxes?.[0]?.boxNo ?? null);
        setStepIndex(0);

        // ⬇️ Load catalog for all itemIds in the task (like the modal)
        const allIds = Array.from(
          new Set(
            (t.plan?.boxes ?? []).flatMap((b) => (b.contents ?? []).map((p) => String(p.itemId)))
          )
        );

        if (allIds.length) {
          const list = await getItemsCatalog(); // expected array of CatalogItem
          const map: Record<string, CatalogItem> = {};
          for (const it of list || []) {
            const id = String((it as any)?._id || "");
            if (id) map[id] = it;
          }
          setCatalog(map);
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to claim a task");
      } finally {
        if (alive) setClaiming(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // derived
  const currentBox: PlanBox | null = useMemo(() => {
    if (!task || selectedBoxNo == null) return null;
    return task.plan?.boxes?.find((b) => b.boxNo === selectedBoxNo) ?? null;
  }, [task, selectedBoxNo]);

  const piecesInBox: PlanPiece[] = useMemo(() => currentBox?.contents ?? [], [currentBox]);
  const cur: PlanPiece | undefined = piecesInBox[stepIndex];

  // total pieces across boxes (for progress)
  const totalPieces = useMemo(
    () => (task?.plan?.boxes || []).reduce((acc, b) => acc + (b.contents?.length || 0), 0),
    [task]
  );

  // local done flags (since API doesn’t carry per-piece status)
  const [localDoneKey, setLocalDoneKey] = useState<Record<string, boolean>>({});
  const pieceKey = (p: PlanPiece, i: number) =>
    `${selectedBoxNo ?? "?"}#${i}@${p.itemId}:${p.mode}:${p.pieceType}`;

  const done = useMemo(() => Object.values(localDoneKey).filter(Boolean).length, [localDoneKey]);
  const overall = totalPieces ? Math.min(100, Math.round((done / totalPieces) * 100)) : 0;

  // counts per size (from real boxes)
  const sizeCount = useMemo(() => {
    const m: Record<"L" | "M" | "S" | "U", number> = { L: 0, M: 0, S: 0, U: 0 };
    (task?.plan?.boxes ?? []).forEach((b) => {
      const code = mapBoxTypeToSizeCode(b.boxType);
      m[code] = (m[code] ?? 0) + 1;
    });
    return m;
  }, [task]);

  // next box with any unchecked piece
  const nextAvailableBoxNo = useMemo(() => {
    if (!task || selectedBoxNo == null) return null;
    const boxes = (task.plan?.boxes ?? []).map((b) => b.boxNo);
    if (!boxes.length) return null;
    const startIdx = boxes.indexOf(selectedBoxNo);
    for (let step = 1; step <= boxes.length; step++) {
      const next = boxes[(startIdx + step) % boxes.length];
      const hasAny = (task.plan?.boxes ?? [])
        .find((b) => b.boxNo === next)
        ?.contents?.some((p, i) => !localDoneKey[pieceKey(p, i)]);
      if (hasAny) return next;
    }
    return null;
  }, [task, selectedBoxNo, localDoneKey]);

  // actions
  const confirmArrival = () => {
    toast.success("Location confirmed"); // placeholder – not persisted
  };

  const saveAndNext = () => {
    if (!cur) return;
    // For kg mode, require weight > 0
    if (cur.mode === "kg") {
      const kg = Number(weightInput);
      if (!isFinite(kg) || kg <= 0) {
        toast.error("Enter weight in kg");
        return;
      }
    }
    setLocalDoneKey((prev) => ({ ...prev, [pieceKey(cur, stepIndex)]: true }));
    setWeightInput("");

    // advance within the same box
    if (stepIndex + 1 < piecesInBox.length) {
      setStepIndex((i) => i + 1);
      return;
    }
    // else move to next available box
    if (nextAvailableBoxNo != null) {
      setSelectedBoxNo(nextAvailableBoxNo);
      setStepIndex(0);
      toast.success(`Moved to box #${nextAvailableBoxNo}`);
    } else {
      toast.success("All pieces completed");
    }
  };

  const firstBoxBySize = useCallback(
    (sz: "L" | "M" | "S" | "U") => {
      if (!task) return null;
      const boxes = (task.plan?.boxes ?? []).filter((b) => mapBoxTypeToSizeCode(b.boxType) === sz);
      if (!boxes.length) return null;
      const withPending =
        boxes.find((b) => (b.contents ?? []).some((p, i) => !localDoneKey[pieceKey(p, i)])) || boxes[0];
      return withPending.boxNo;
    },
    [task, localDoneKey]
  );

  // loading / empty states
  if (claiming) {
    return (
      <VStack align="start" p={6}>
        <HStack gap={3}>
          <Spinner />
          <Text fontSize="lg">Loading your task and catalog…</Text>
        </HStack>
      </VStack>
    );
  }

  if (!task) {
    return (
      <VStack align="start" p={6} gap={4}>
        <Text fontSize="lg">No ready tasks available right now.</Text>
        <Button onClick={() => navigate("/picker/dashboard")} variant="outline">
          Back to dashboard
        </Button>
      </VStack>
    );
  }

  /* ---------- HEADER ---------- */
  const header = (
    <Box mb={5} p={4} rounded="2xl" borderWidth="1px" bg="bg.muted" _dark={{ bg: "gray.800" }}>
      <HStack justify="space-between" align="center" wrap="wrap" gap={4}>
        <HStack gap={4}>
          <Heading size="lg">Order {task.orderId}</Heading>
          <Badge size="lg" variant="solid" colorPalette={(task.priority ?? 0) > 0 ? "red" : "blue"}>
            {(task.priority ?? 0) > 0 ? "RUSH" : "NORMAL"}
          </Badge>
          <Badge size="lg" variant="subtle" colorPalette={phase === "load" ? "yellow" : "teal"}>
            {phase === "load" ? "Load" : "Pick"}
          </Badge>
        </HStack>

        <HStack gap={3} minW="260px">
          <Text fontWeight="bold" fontSize="lg">
            Progress
          </Text>
          <Progress.Root value={overall} size="lg" w="180px">
            <Progress.Track />
            <Progress.Range />
          </Progress.Root>
          <Text fontSize="md" fontWeight="semibold">
            {overall}%
          </Text>
        </HStack>
      </HStack>
    </Box>
  );

  const TimerPill = (
    <Box
      position="fixed"
      top="20"
      right="6"
      zIndex="modal"
      bg="white"
      _dark={{ bg: "gray.900" }}
      borderWidth="1px"
      rounded="full"
      px={4}
      py={2}
      shadow="md"
    >
      <HStack gap={3}>
        <Badge variant="solid" colorPalette={(task.priority ?? 0) > 0 ? "red" : "teal"}>
          SLA
        </Badge>
        <Text fontSize="xl" fontWeight="semibold" minW="80px" textAlign="center">
          {fmt(timeLeft)}
        </Text>
      </HStack>
    </Box>
  );

  // Helper to render an item piece with catalog data
  const renderPieceRow = (p: PlanPiece, idx: number) => {
    const meta = getMeta(String(p.itemId));
    const displayName = p.itemName || meta?.name || `${meta?.type ?? ""} ${meta?.variety ?? ""}`.trim() || p.itemId;
    const img = meta?.imageUrl || "/img/item-placeholder.png";

    const doneKey = pieceKey(p, idx);
    const isDone = !!localDoneKey[doneKey];

    return (
      <HStack key={doneKey} gap={4} align="center" py={2}>
        <Image src={img} alt={displayName} rounded="md" w="64px" h="64px" objectFit="cover" />
        <VStack align="start" gap={0} flex="1">
          <Text fontSize="md" fontWeight="semibold">
            {displayName}
          </Text>
          <HStack gap={3} wrap="wrap">
            <Badge size="sm" variant="surface">
              {p.pieceType}
            </Badge>
            <Badge size="sm" variant="surface" colorPalette={p.mode === "kg" ? "teal" : "purple"}>
              {p.mode === "kg" ? "Kg" : `Units${p.units ? `: ${p.units}` : ""}`}
            </Badge>
            <Text color="fg.muted" fontSize="sm">
              est kg/pc {Math.round(p.estWeightKgPiece * 100) / 100} • {Math.round(p.liters * 10) / 10}L
            </Text>
          </HStack>
        </VStack>
        <Badge variant={isDone ? "solid" : "outline"} colorPalette={isDone ? "green" : "gray"}>
          {isDone ? "Done" : "Pending"}
        </Badge>
      </HStack>
    );
  };

  /* ---------- PHASE: LOAD ---------- */
  if (phase === "load") {
    return (
      <>
        {header}
        {TimerPill}
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

                {/* Optional: preview items list like modal */}
                <Show when={catalogOpen}>
                  <Separator my={4} />
                  <VStack align="stretch" gap={2}>
                    {(task.plan?.summary?.byItem ?? []).map((bi, i) => {
                      const meta = getMeta(String(bi.itemId));
                      const displayName =
                        bi.itemName || meta?.name || `${meta?.type ?? ""} ${meta?.variety ?? ""}`.trim() || bi.itemId;
                      const img = meta?.imageUrl || "/img/item-placeholder.png";
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
                      );
                    })}
                  </VStack>
                </Show>
              </Card.Body>
              <Card.Footer>
                <HStack gap={3}>
                  <Button size="lg" colorPalette="teal" onClick={() => setPhase("pick")}>
                    Confirm
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
    );
  }

  /* ---------- PHASE: PICK ---------- */
  const curMeta = getMeta(cur?.itemId);
  const curName =
    cur?.itemName || curMeta?.name || `${curMeta?.type ?? ""} ${curMeta?.variety ?? ""}`.trim() || cur?.itemId || "";
  const curImg = curMeta?.imageUrl || "/img/item-placeholder.png";

  return (
    <>
      {header}
      {TimerPill}
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

        {/* Packages strip */}
        <GridItem colSpan={{ base: 12, md: 12 }}>
          <Card.Root rounded="2xl" borderWidth="1px">
            <Card.Header>
              <HStack justify="space-between" w="full">
                <Heading size="md">Packages</Heading>
                <Text color="fg.muted">Order {task.orderId}</Text>
              </HStack>
            </Card.Header>
            <Card.Body>
              <SizeStrip
                sizes={sizeCount}
                clickable
                onPickSize={(sz) => {
                  const target = firstBoxBySize(sz);
                  if (target == null) return;
                  setSelectedBoxNo(target);
                  setStepIndex(0);
                }}
              />
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* Current item */}
        <GridItem colSpan={{ base: 12, md: 12 }}>
          <Card.Root rounded="2xl" borderWidth="1px">
            <Card.Header>
              <HStack justify="space-between" w="full">
                <HStack gap={3}>
                  <Heading size="md">
                    {selectedBoxNo == null ? "Select a box to start" : cur ? curName : "Box complete"}
                  </Heading>
                  <Badge size="lg" variant="outline">
                    {selectedBoxNo != null ? `Box #${selectedBoxNo}` : "—"}
                  </Badge>
                </HStack>
              </HStack>
            </Card.Header>
            <Card.Body>
              {selectedBoxNo == null ? (
                <Text fontSize="lg">Choose a package above.</Text>
              ) : cur ? (
                <VStack align="stretch" gap={5}>
                  <Image src={curImg} alt={curName} rounded="lg" maxH="320px" objectFit="cover" />
                  <HStack gap={6} align="center" wrap="wrap">
                    <Badge size="lg" variant="surface" colorPalette="purple">
                      Piece: {cur.pieceType}
                    </Badge>
                    <Badge size="lg" variant="surface" colorPalette="teal">
                      Mode: {cur.mode}
                    </Badge>
                  </HStack>

                  {cur.mode === "kg" ? (
                    <HStack gap={3} align="center">
                      <Text fontSize="lg">Kg</Text>
                      <Input
                        size="lg"
                        type="number"
                        step="0.01"
                        w="180px"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                      />
                    </HStack>
                  ) : (
                    <HStack gap={6} align="center">
                      <Text fontSize="lg">Units</Text>
                      <Badge size="lg">{cur.units ?? 1}</Badge>
                    </HStack>
                  )}

                  <Text color="fg.muted">
                    Est kg/pc: {Math.round(cur.estWeightKgPiece * 100) / 100} • Liters: {Math.round(cur.liters * 10) / 10}
                  </Text>

                  <Separator my={2} />

                  {/* Show entire selected box list like the modal (with images) */}
                  <VStack align="stretch" gap={2}>
                    {(currentBox?.contents ?? []).map(renderPieceRow)}
                  </VStack>
                </VStack>
              ) : (
                <VStack align="start" gap={4}>
                  <Text fontSize="lg">All pieces done for this box.</Text>
                  {nextAvailableBoxNo != null && (
                    <Button
                      size="lg"
                      colorPalette="teal"
                      onClick={() => {
                        setSelectedBoxNo(nextAvailableBoxNo);
                        setStepIndex(0);
                      }}
                    >
                      Move to next box
                    </Button>
                  )}
                </VStack>
              )}
            </Card.Body>
            <Card.Footer>
              <HStack gap={3} wrap="wrap">
                <Button size="lg" variant="outline" onClick={confirmArrival}>
                  Confirm arrival
                </Button>
                <Button
                  size="lg"
                  colorPalette="teal"
                  onClick={saveAndNext}
                  disabled={selectedBoxNo == null || !cur}
                  rounded="full"
                >
                  Continue
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/picker/dashboard")} rounded="full">
                  Finish later
                </Button>
              </HStack>
            </Card.Footer>
          </Card.Root>
        </GridItem>
      </Grid>
    </>
  );
}
