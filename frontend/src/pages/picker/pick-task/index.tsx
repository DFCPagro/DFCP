// src/pages/picker/pick-task/index.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Grid, GridItem, Card, HStack, VStack, Heading, Text, Button,
  Progress, Image, Badge, Input, Separator,
} from "@chakra-ui/react";
import toast from "react-hot-toast";
import { buildPickTask, type PickTask, type PickItem } from "@/data/picker";

type Phase = "load" | "pick";
const SLA_MIN = (p: "normal" | "rush") => (p === "rush" ? 20 : 45);
const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

export default function PickTaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("load");
  const [task, setTask] = useState<PickTask | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [indexInPkg, setIndexInPkg] = useState(0);

  // SLA timer
  const [deadline, setDeadline] = useState<number>(() => Date.now() + 20*60*1000);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const timeLeft = Math.max(0, Math.floor((deadline - now)/1000));

  // load task
  useEffect(() => {
    const t = buildPickTask(taskId ?? "#DEMO");
    setTask(t);
    setSelectedPkg(t.packages[0]?.packageId ?? null);
    setDeadline(Date.now() + SLA_MIN(t.priority)*60*1000);
  }, [taskId]);

  // package fill
  const [pkgLoad, setPkgLoad] = useState<Record<string, number>>({});
  const cap = (pid: string) => task?.packages.find(p => p.packageId===pid)?.maxWeightKg ?? 0;
  const ratio = (pid: string) => ((pkgLoad[pid] ?? 0) / Math.max(1, cap(pid))) * 100;

  // item state
  const [weightInput, setWeightInput] = useState("");
  const itemsForPkg = useMemo(
    () => (!task || !selectedPkg) ? [] : task.items.filter(i => i.packageId===selectedPkg && i.status==="pending"),
    [task, selectedPkg]
  );
  const cur: PickItem | undefined = itemsForPkg[indexInPkg];

  const done = task?.items.filter(x => x.status!=="pending").length ?? 0;
  const total = task?.items.length ?? 0;
  const overall = total ? Math.round((done/total)*100) : 0;

  const setStatus = (id: string, s: PickItem["status"]) =>
    setTask(prev => !prev ? prev : ({...prev, items: prev.items.map(i => i.id===id ? {...i, status:s} : i)}));

  const nextItemOrPackage = () => {
    if (indexInPkg + 1 < itemsForPkg.length) setIndexInPkg(i => i+1);
    else {
      const ids = task?.packages.map(p=>p.packageId) ?? [];
      if (!selectedPkg || !ids.length) return;
      const next = ids[(ids.indexOf(selectedPkg)+1) % ids.length];
      setSelectedPkg(next);
      setIndexInPkg(0);
      toast.success(`Move to next package: ${next}`);
    }
  };

  if (!task) return <VStack align="start" p={4}><Text>Loading…</Text></VStack>;

  // page header
  const header = (
    <Box
      mb={4}
      p={4}
      borderRadius="2xl"
      bgGradient="to-r"
      gradientFrom="green.500"
      gradientTo="teal.500"
      color="white"
    >
      <HStack justify="space-between" wrap="wrap">
        <HStack gap={3}>
          <Heading size="md">Order {task.orderId}</Heading>
          <Badge variant="solid" colorPalette={task.priority==="rush" ? "red" : "blue"}>
            {task.priority.toUpperCase()}
          </Badge>
        </HStack>
        <HStack gap={4}>
          <HStack gap={2}>
            <Text fontWeight="bold">Time left</Text>
            <Text fontSize="xl">{fmt(timeLeft)}</Text>
          </HStack>
          <HStack gap={2} minW="160px">
            <Text fontWeight="bold">Progress</Text>
            <Progress.Root value={overall} w="120px"><Progress.Track/><Progress.Range/></Progress.Root>
          </HStack>
        </HStack>
      </HStack>
    </Box>
  );

  // Phase 1: load packages
  if (phase === "load") {
    return (
      <>
        {header}
        <Grid columns={{ base: 1, md: 12 }} gap={4}>
          <GridItem colSpan={{ base: 12, md: 8 }}>
            <Card.Root>
              <Card.Header><Heading size="md">Load packages onto cart</Heading></Card.Header>
              <Card.Body>
                <VStack align="stretch" gap={3}>
                  {task.packages.map(p => (
                    <HStack key={p.packageId} justify="space-between" p={2} borderRadius="lg" bg="bg.muted">
                      <HStack gap={3}>
                        <Badge>{p.packageId}</Badge>
                        <Text>{p.sizeCode}</Text>
                        <Badge variant="subtle">{p.targetUse}</Badge>
                      </HStack>
                      <Text fontSize="sm">Capacity {p.maxWeightKg} kg</Text>
                    </HStack>
                  ))}
                  <Separator />
                  <Text fontSize="sm" color="fg.muted">Confirm when packages are on your cart.</Text>
                </VStack>
              </Card.Body>
              <Card.Footer>
                <HStack gap={2}>
                  <Button size="lg" colorPalette="green" onClick={() => setPhase("pick")}>Confirm</Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/picker/dashboard")}>Cancel</Button>
                </HStack>
              </Card.Footer>
            </Card.Root>
          </GridItem>

          <GridItem colSpan={{ base: 12, md: 4 }} position="sticky" top="12">
            <Card.Root>
              <Card.Header><Heading size="sm">SLA</Heading></Card.Header>
              <Card.Body>
                <VStack align="start" gap={2}>
                  <Text fontSize="3xl">{fmt(timeLeft)}</Text>
                  <Text fontSize="sm">Finish before time runs out.</Text>
                </VStack>
              </Card.Body>
            </Card.Root>
          </GridItem>
        </Grid>
      </>
    );
  }

  // Phase 2: picking
  const confirmArrival = () => {
    if (!cur) return;
    setStatus(cur.id, "at_location");
    toast.success("Location confirmed");
  };

  const saveAndNext = () => {
    if (!cur) return;
    const isKg = (cur as any).required?.uom === "kg";
    const addKg = isKg ? Math.max(0, Number(weightInput) || 0) : (cur.unitsRequired || 0) * 0.3;
    if (isKg && addKg <= 0) { toast.error("Enter weight in kg"); return; }
    setPkgLoad(prev => ({...prev, [cur.packageId]: (prev[cur.packageId] ?? 0) + addKg}));
    setStatus(cur.id, "scanned");
    setWeightInput("");

    const will = ((pkgLoad[cur.packageId] ?? 0) + addKg) / Math.max(1, cap(cur.packageId));
    if (will >= 1) toast.success(`Package ${cur.packageId} is full. Moving on.`);
    nextItemOrPackage();
  };

  return (
    <>
      {header}
      <Grid columns={{ base: 1, md: 12 }} gap={4}>
        {/* Packages with fill */}
        <GridItem colSpan={{ base: 12, md: 3 }}>
          <Card.Root>
            <Card.Header><Heading size="sm">Packages</Heading></Card.Header>
            <Card.Body>
              <VStack align="stretch" gap={2}>
                {task.packages.map(p => (
                  <Button
                    key={p.packageId}
                    size="lg"
                    variant={selectedPkg===p.packageId ? "solid" : "outline"}
                    colorPalette="green"
                    onClick={() => { setSelectedPkg(p.packageId); setIndexInPkg(0); }}
                  >
                    <VStack w="full" align="stretch" gap={1}>
                      <HStack justify="space-between" w="full">
                        <Text>{p.packageId} • {p.sizeCode}</Text>
                        <Badge>{p.targetUse}</Badge>
                      </HStack>
                      <Progress.Root value={ratio(p.packageId)} w="full">
                        <Progress.Track/><Progress.Range/>
                      </Progress.Root>
                    </VStack>
                  </Button>
                ))}
              </VStack>
            </Card.Body>
          </Card.Root>
        </GridItem>

        {/* Current item */}
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Card.Root>
            <Card.Header>
              <HStack justify="space-between" w="full">
                <Heading size="sm">{cur?.name ?? "Package complete"}</Heading>
                <Badge colorPalette={cur?.status==="scanned" ? "green" : "gray"}>{cur?.status ?? "—"}</Badge>
              </HStack>
            </Card.Header>
            <Card.Body>
              {cur ? (
                <VStack align="stretch" gap={4}>
                  <Image src={cur.imageUrl} alt={cur.name} borderRadius="lg" maxH="220px" objectFit="cover" />
                  <HStack gap={4}><Text fontWeight="bold">Location:</Text><Text fontWeight="bold">{cur.shelf} · {cur.zone}</Text></HStack>
                  <HStack gap={4}><Text>Units required</Text><Badge>{cur.unitsRequired}</Badge></HStack>
                  <HStack gap={2} wrap="wrap">
                    <Button variant="outline" onClick={confirmArrival}>Confirm arrival</Button>
                    {(cur as any).required?.uom === "kg" && (
                      <HStack gap={2}><Text>Kg</Text>
                        <Input type="number" step="0.01" w="120px" value={weightInput} onChange={e=>setWeightInput(e.target.value)} />
                      </HStack>
                    )}
                  </HStack>
                </VStack>
              ) : <Text>All items done for this package.</Text>}
            </Card.Body>
            <Card.Footer>
              <HStack gap={2} wrap="wrap">
                <Button size="lg" colorPalette="green" onClick={saveAndNext} disabled={!cur}>Continue</Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/picker/dashboard")}>Finish later</Button>
              </HStack>
            </Card.Footer>
          </Card.Root>
        </GridItem>

        {/* Sticky timer + overall */}
        <GridItem colSpan={{ base: 12, md: 3 }} position="sticky" top="12">
          <Card.Root>
            <Card.Header><Heading size="sm">Timer</Heading></Card.Header>
            <Card.Body>
              <VStack align="start" gap={2}>
                <Text fontSize="3xl">{fmt(timeLeft)}</Text>
                <Text fontSize="sm">{done}/{total} items</Text>
                <Progress.Root value={overall} w="full"><Progress.Track/><Progress.Range/></Progress.Root>
              </VStack>
            </Card.Body>
            <Card.Footer>
              <Button
                colorPalette="green"
                onClick={() => {
                  if (done < total) { toast.error("Items still pending"); return; }
                  toast.success(`Order completed. Place on delivery shelf ${task.deliveryShelf.row}-${task.deliveryShelf.bay}`);
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
