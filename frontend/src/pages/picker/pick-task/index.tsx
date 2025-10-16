// src/pages/picker/pick-task/index.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "@chakra-ui/react";
import toast from "react-hot-toast";
import { buildPickTask, type PickTask, type PickItem } from "@/data/picker";

type Phase = "load" | "pick";
const SLA_MIN = (p: "normal" | "rush") => (p === "rush" ? 20 : 45);
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function PickTaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("load");
  const [task, setTask] = useState<PickTask | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null); // start with none selected
  const [indexInPkg, setIndexInPkg] = useState(0);

  // SLA timer
  const [deadline, setDeadline] = useState<number>(() => Date.now() + 20 * 60 * 1000);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeLeft = Math.max(0, Math.floor((deadline - now) / 1000));

  // load task
  useEffect(() => {
    const t = buildPickTask(taskId ?? "#DEMO");
    setTask(t);
    // do NOT preselect a package
    setDeadline(Date.now() + SLA_MIN(t.priority) * 60 * 1000);
  }, [taskId]);

  // package fill
  const [pkgLoad, setPkgLoad] = useState<Record<string, number>>({});
  const cap = (pid: string) => task?.packages.find((p) => p.packageId === pid)?.maxWeightKg ?? 0;
  const ratio = (pid: string) => ((pkgLoad[pid] ?? 0) / Math.max(1, cap(pid))) * 100;

  // item state
  const [weightInput, setWeightInput] = useState("");

  const itemsForPkg = useMemo(() => {
    if (!task || !selectedPkg) return [];
    return task.items.filter((i) => i.packageId === selectedPkg && i.status === "pending");
  }, [task, selectedPkg]);

  const cur: PickItem | undefined = itemsForPkg[indexInPkg];

  const done = task?.items.filter((x) => x.status !== "pending").length ?? 0;
  const total = task?.items.length ?? 0;
  const overall = total ? Math.round((done / total) * 100) : 0;

  const setStatus = (id: string, s: PickItem["status"]) =>
    setTask((prev) =>
      !prev ? prev : { ...prev, items: prev.items.map((i) => (i.id === id ? { ...i, status: s } : i)) },
    );

  const gotoNextItemInPackage = () => {
    if (indexInPkg + 1 < itemsForPkg.length) setIndexInPkg((i) => i + 1);
    else setIndexInPkg(0); // end of this package; wait for user to choose next package
  };

  // size counters per sizeCode
  const sizeCount = useMemo(() => {
    const m: Record<string, number> = {};
    task?.packages.forEach((p) => {
      m[p.sizeCode] = (m[p.sizeCode] ?? 0) + 1;
    });
    return m;
  }, [task]);

  // derived meta for clearer UI
  const pkgMeta = useMemo(() => {
    if (!task) return [];
    return task.packages.map((p) => {
      const used = pkgLoad[p.packageId] ?? 0;
      const capKg = Math.max(1, p.maxWeightKg);
      const pct = Math.min(100, Math.round((used / capKg) * 100));
      const pending = task.items.filter(
        (i) => i.packageId === p.packageId && i.status === "pending",
      ).length;
      return { ...p, used, capKg, pct, pending, count: sizeCount[p.sizeCode] ?? 1 };
    });
  }, [task, pkgLoad, sizeCount]);

  // next package with pending items
  const nextAvailablePkg = useMemo(() => {
    if (!task || !selectedPkg) return null;
    const ids = task.packages.map((p) => p.packageId);
    const start = ids.indexOf(selectedPkg);
    for (let step = 1; step <= ids.length; step++) {
      const id = ids[(start + step) % ids.length];
      const pending = task.items.filter((i) => i.packageId === id && i.status === "pending").length;
      if (pending > 0) return id;
    }
    return null;
  }, [task, selectedPkg]);

  if (!task)
    return (
      <VStack align="start" p={6}>
        <Text fontSize="lg">Loading…</Text>
      </VStack>
    );

  /* ---------- HEADER ---------- */
  const header = (
    <Box mb={5} p={4} rounded="2xl" borderWidth="1px" bg="bg.muted" _dark={{ bg: "gray.800" }}>
      <HStack justify="space-between" align="center" wrap="wrap" gap={4}>
        <HStack gap={4}>
          <Heading size="lg">Order {task.orderId}</Heading>
          <Badge size="lg" variant="solid" colorPalette={task.priority === "rush" ? "red" : "blue"}>
            {task.priority.toUpperCase()}
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

  /* floating timer pill */
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
        <Badge variant="solid" colorPalette={task.priority === "rush" ? "red" : "teal"}>
          SLA
        </Badge>
        <Text fontSize="xl" fontWeight="semibold" minW="80px" textAlign="center">
          {fmt(timeLeft)}
        </Text>
      </HStack>
    </Box>
  );

  /* ---------- PHASE: LOAD ---------- */
  if (phase === "load") {
    return (
      <>
        {header}
        {TimerPill}
        <Grid columns={{ base: 1, md: 12 }} gap={6}>
          <GridItem colSpan={{ base: 12, md: 8 }}>
            <Card.Root rounded="2xl" borderWidth="1px">
              <Card.Header>
                <HStack justify="space-between" w="full">
                  <Heading size="lg">Packages</Heading>
                  <Text color="fg.muted">Order {task.orderId}</Text>
                </HStack>
              </Card.Header>
              <Card.Body>
                <VStack align="stretch" gap={4}>
                  {pkgMeta.map((p) => (
                    <HStack
                      key={p.packageId}
                      justify="space-between"
                      p={4}
                      rounded="xl"
                      bg="white"
                      _dark={{ bg: "gray.900" }}
                      borderWidth="1px"
                    >
                      <HStack gap={4}>
                        <Badge size="lg" variant="solid" colorPalette="teal">
                          {p.packageId}
                        </Badge>
                        <Text fontSize="lg" fontWeight="semibold">
                          Size {p.sizeCode}
                          <Text as="span" color="fg.muted" ml="1">
                            x{p.count}
                          </Text>
                        </Text>
                        <Badge size="lg" variant="subtle" colorPalette="teal">
                          {p.targetUse}
                        </Badge>
                      </HStack>

                      <VStack align="end" gap={1} minW="280px">
                        <HStack gap={3}>
                          <Text fontSize="sm" color="fg.muted">
                            Fill
                          </Text>
                          <Text fontSize="sm">
                            {p.used.toFixed(1)} / {p.capKg} kg
                          </Text>
                          <Badge variant="outline">{p.pct}%</Badge>
                          <Badge variant="surface" colorPalette="purple">
                            Pending {p.pending}
                          </Badge>
                        </HStack>
                        <Progress.Root value={p.pct} w="full">
                          <Progress.Track />
                          <Progress.Range />
                        </Progress.Root>
                      </VStack>
                    </HStack>
                  ))}
                  <Separator />
                  <Text fontSize="md" color="fg.muted">
                    Confirm when packages are on your cart.
                  </Text>
                </VStack>
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
  const confirmArrival = () => {
    if (!cur) return;
    setStatus(cur.id, "at_location");
    toast.success("Location confirmed");
  };

  const saveAndNext = () => {
    if (!cur) return;
    const isKg = (cur as any).required?.uom === "kg";
    const addKg = isKg ? Math.max(0, Number(weightInput) || 0) : (cur.unitsRequired || 0) * 0.3;
    if (isKg && addKg <= 0) {
      toast.error("Enter weight in kg");
      return;
    }
    setPkgLoad((prev) => ({ ...prev, [cur.packageId]: (prev[cur.packageId] ?? 0) + addKg }));
    setStatus(cur.id, "scanned");
    setWeightInput("");

    const will = ((pkgLoad[cur.packageId] ?? 0) + addKg) / Math.max(1, cap(cur.packageId));
    if (will >= 1) toast.success(`Package ${cur.packageId} is full.`);

    gotoNextItemInPackage();
  };

  return (
    <>
      {header}
      {TimerPill}
      <Grid columns={{ base: 1, md: 12 }} gap={6}>
        {/* Packages */}
        <GridItem colSpan={{ base: 12, md: 3 }}>
          <Card.Root rounded="2xl" borderWidth="1px">
            <Card.Header>
              <HStack justify="space-between" w="full">
                <Heading size="md">Packages</Heading>
                <Text color="fg.muted">Order {task.orderId}</Text>
              </HStack>
            </Card.Header>
            <Card.Body>
              <VStack align="stretch" gap={3}>
                {pkgMeta.map((p) => (
                  <Button
                    key={p.packageId}
                    size="lg"
                    variant={selectedPkg === p.packageId ? "outline" : "ghost"} // no solid fill
                    colorPalette="teal"
                    borderWidth={selectedPkg === p.packageId ? "2px" : "1px"}
                    onClick={() => {
                      setSelectedPkg(p.packageId);
                      setIndexInPkg(0);
                    }}
                    rounded="xl"
                    py={5}
                  >
                    <VStack w="full" align="stretch" gap={2}>
                      <HStack justify="space-between" w="full">
                        <HStack gap={3}>
                          <Text fontSize="lg" fontWeight="semibold">
                            {p.packageId} • Size {p.sizeCode}
                            <Text as="span" color="fg.muted" ml="1">
                              x{p.count}
                            </Text>
                          </Text>
                          <Badge variant="subtle" colorPalette="teal">
                            {p.targetUse}
                          </Badge>
                        </HStack>
                        <HStack gap={2}>
                          <Badge variant="outline">{p.pct}%</Badge>
                          <Badge variant="surface" colorPalette="purple">
                            Pending {p.pending}
                          </Badge>
                        </HStack>
                      </HStack>
                      <Progress.Root value={p.pct} w="full">
                        <Progress.Track />
                        <Progress.Range />
                      </Progress.Root>
                    </VStack>
                  </Button>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* Current item / instructions */}
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Card.Root rounded="2xl" borderWidth="1px">
            <Card.Header>
              <HStack justify="space-between" w="full">
                <HStack gap={3}>
                  <Heading size="md">
                    {selectedPkg ? cur?.name ?? "Package complete" : "Select a package to start"}
                  </Heading>
                  <Badge size="lg" variant="outline">
                    Order {task.orderId}
                  </Badge>
                </HStack>
                {selectedPkg && (
                  <Badge size="lg" colorPalette={cur?.status === "scanned" ? "teal" : "gray"}>
                    {cur?.status ?? (itemsForPkg.length ? "pending" : "—")}
                  </Badge>
                )}
              </HStack>
            </Card.Header>
            <Card.Body>
              {!selectedPkg ? (
                <Text fontSize="lg">Choose a package on the left.</Text>
              ) : cur ? (
                <VStack align="stretch" gap={5}>
                  <Image src={cur.imageUrl} alt={cur.name} rounded="lg" maxH="320px" objectFit="cover" />

                  <HStack gap={3} wrap="wrap">
                    <Badge size="lg" variant="surface" colorPalette="purple">
                      Shelf {cur.shelf}
                    </Badge>
                    <Badge size="lg" variant="surface" colorPalette="teal">
                      Zone {cur.zone}
                    </Badge>
                    <Badge size="lg" variant="outline">
                      Package {selectedPkg}
                    </Badge>
                  </HStack>

                  <HStack gap={6} align="center">
                    <Text fontSize="lg">Units required</Text>
                    <Badge size="lg">{cur.unitsRequired}</Badge>
                  </HStack>

                  <HStack gap={3} wrap="wrap">
                    <Button size="lg" variant="outline" onClick={confirmArrival}>
                      Confirm arrival
                    </Button>
                    {(cur as any).required?.uom === "kg" && (
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
                    )}
                  </HStack>
                </VStack>
              ) : (
                <VStack align="start" gap={4}>
                  <Text fontSize="lg">All items done for this package.</Text>
                  {nextAvailablePkg && (
                    <Button
                      size="lg"
                      colorPalette="teal"
                      onClick={() => {
                        setSelectedPkg(nextAvailablePkg);
                        setIndexInPkg(0);
                      }}
                    >
                      Move to next package
                    </Button>
                  )}
                </VStack>
              )}
            </Card.Body>
            <Card.Footer>
              <HStack gap={3} wrap="wrap">
                <Button
                  size="lg"
                  colorPalette="teal"
                  onClick={saveAndNext}
                  disabled={!cur}
                  rounded="full"
                >
                  Continue
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/picker/dashboard")}
                  rounded="full"
                >
                  Finish later
                </Button>
              </HStack>
            </Card.Footer>
          </Card.Root>
        </GridItem>

        {/* Overall */}
        <GridItem colSpan={{ base: 12, md: 3 }}>
          <Card.Root rounded="2xl" borderWidth="1px">
            <Card.Header>
              <HStack justify="space-between" w="full">
                <Heading size="md">Overall</Heading>
                <Text color="fg.muted">Order {task.orderId}</Text>
              </HStack>
            </Card.Header>
            <Card.Body>
              <VStack align="start" gap={3}>
                <Text fontSize="lg">
                  {done}/{total} items
                </Text>
                <Progress.Root value={overall} size="lg" w="full">
                  <Progress.Track />
                  <Progress.Range />
                </Progress.Root>
              </VStack>
            </Card.Body>
            <Card.Footer>
              <Button
                size="lg"
                colorPalette="teal"
                onClick={() => {
                  if (done < total) {
                    toast.error("Items still pending");
                    return;
                  }
                  toast.success(
                    `Order completed. Place on delivery shelf ${task.deliveryShelf.row}-${task.deliveryShelf.bay}`,
                  );
                  setTimeout(() => navigate("/picker/dashboard"), 800);
                }}
              >
                Finish order
              </Button>
            </Card.Footer>
          </Card.Root>
        </GridItem>
      </Grid>
    </>
  );
}
