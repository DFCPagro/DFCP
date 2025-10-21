// src/pages/picker/pick-task/index.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { Package as PackageIcon } from "lucide-react";
import toast from "react-hot-toast";
import { buildPickTask, type PickTask, type PickItem } from "@/data/picker";

type Phase = "load" | "pick";
const SLA_MIN = (p: "normal" | "rush") => (p === "rush" ? 20 : 45);
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
  sizes: Partial<Record<"L" | "M" | "S", number>>;
  clickable?: boolean;
  onPickSize?: (sizeCode: "L" | "M" | "S") => void;
  borderAccent?: boolean;
}) {
  const order: Array<"L" | "M" | "S"> = ["L", "M", "S"];
  const label: Record<"L" | "M" | "S", string> = { L: "Large", M: "Medium", S: "Small" };

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
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("load");
  const [task, setTask] = useState<PickTask | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [indexInPkg, setIndexInPkg] = useState(0);
  const [weightInput, setWeightInput] = useState(""); // <-- moved ABOVE conditional returns

  const [deadline, setDeadline] = useState<number>(() => Date.now() + 20 * 60 * 1000);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeLeft = Math.max(0, Math.floor((deadline - now) / 1000));

  useEffect(() => {
    const t = buildPickTask(taskId ?? "#DEMO");
    setTask(t);
    setDeadline(Date.now() + SLA_MIN(t.priority) * 60 * 1000);
  }, [taskId]);

  const [pkgLoad, setPkgLoad] = useState<Record<string, number>>({});
  const cap = (pid: string) => task?.packages.find((p) => p.packageId === pid)?.maxWeightKg ?? 0;

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
    else setIndexInPkg(0);
  };

  // counts per sizeCode
  const sizeCount = useMemo(() => {
    const m: Record<"L" | "M" | "S", number> = { L: 0, M: 0, S: 0 };
    task?.packages.forEach((p) => {
      if (p.sizeCode === "L" || p.sizeCode === "M" || p.sizeCode === "S") {
        m[p.sizeCode] = (m[p.sizeCode] ?? 0) + 1;
      }
    });
    return m;
  }, [task]);

 
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

  const firstPendingPkgBySize = useCallback(
    (size: "L" | "M" | "S") => {
      if (!task) return null;
      const list = task.packages.filter((p) => p.sizeCode === size);
      for (const p of list) {
        const pending = task.items.filter(
          (i) => i.packageId === p.packageId && i.status === "pending",
        ).length;
        if (pending > 0) return p.packageId;
      }
      return list[0]?.packageId ?? null;
    },
    [task],
  );

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
          <GridItem colSpan={{ base: 12, md: 12 }}>
            <Card.Root rounded="2xl" borderWidth="1px">
              <Card.Header>
                <HStack justify="space-between" w="full">
                  <Heading size="lg">Packages</Heading>
                  <Text color="fg.muted">Order {task.orderId}</Text>
                </HStack>
              </Card.Header>
              <Card.Body>
                <SizeStrip sizes={sizeCount} />
                <Separator my={4} />
                <Text fontSize="md" color="fg.muted">
                  Confirm when packages are on your cart.
                </Text>
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
        {/* Left: sizes + packages */}
        <GridItem colSpan={{ base: 12, md: 2 }}></GridItem>
               <GridItem colSpan={{ base: 12, md: 12 }}>
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
        
          </Card.Root>
        </GridItem>
        <GridItem colSpan={{ base: 12, md: 12}}>
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
                  const pid = firstPendingPkgBySize(sz);
                  if (!pid) return;
                  setSelectedPkg(pid);
                  setIndexInPkg(0);
                }}
              />
              
            </Card.Body>
          </Card.Root>
        </GridItem>
 
        {/* Middle: current item */}
        <GridItem colSpan={{ base: 12, md: 12 }}>
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
                <Button size="lg" colorPalette="teal" onClick={saveAndNext} disabled={!cur} rounded="full">
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

        {/* Right: overall */}

      </Grid>
    </>
  );
}
