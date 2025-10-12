// src/pages/picker/pick-task/index.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "@chakra-ui/react";
import toast from "react-hot-toast";

// ---- types ----
type PackagePlan = {
  packageId: string;
  sizeCode: "XS" | "S" | "M" | "L" | "XL";
  targetUse: "ambient" | "chilled" | "frozen";
};

type PickItem = {
  id: string;
  name: string;
  imageUrl: string;
  zone: string;
  shelf: string;
  unitsRequired: number;
  packageId: string;
  status: "pending" | "scanned" | "substituted" | "missing" | "damaged";
};

type PickTask = {
  id: string;
  orderId: string;
  packages: PackagePlan[];
  items: PickItem[];
  deliveryShelf: { row: string; bay: string };
};

// ---- mock loader (replace with real API) ----
async function loadTask(_taskId: string): Promise<PickTask> {
  const packages: PackagePlan[] = [
    { packageId: "P1", sizeCode: "M", targetUse: "ambient" },
    { packageId: "P2", sizeCode: "S", targetUse: "chilled" },
  ];
  const items: PickItem[] = [
    {
      id: "L1",
      name: "Tomato",
      imageUrl: "https://images.unsplash.com/photo-1546470427-0fd5b7160c97?w=640",
      zone: "A3",
      shelf: "S2",
      unitsRequired: 4,
      packageId: "P1",
      status: "pending",
    },
    {
      id: "L2",
      name: "Cucumber",
      imageUrl: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=640",
      zone: "A1",
      shelf: "S1",
      unitsRequired: 6,
      packageId: "P1",
      status: "pending",
    },
    {
      id: "L3",
      name: "Milk 1L",
      imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=640",
      zone: "C2",
      shelf: "S4",
      unitsRequired: 2,
      packageId: "P2",
      status: "pending",
    },
  ];
  return {
    id: _taskId,
    orderId: "O-23456",
    packages,
    items,
    deliveryShelf: { row: "B", bay: "12" },
  };
}

// ---- util ----
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ---- page ----
export default function PickTaskPage() {
  const { taskId = "t-demo" } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState<PickTask | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [indexInPkg, setIndexInPkg] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [now, setNow] = useState<number>(() => Date.now());

  // timer tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // load
  useEffect(() => {
    loadTask(taskId).then((t) => {
      setTask(t);
      setSelectedPkg(t.packages[0]?.packageId ?? null);
      setStartedAt(Date.now());
    });
  }, [taskId]);

  const itemsForPkg = useMemo(
    () => (!task || !selectedPkg ? [] : task.items.filter((it) => it.packageId === selectedPkg)),
    [task, selectedPkg]
  );
  const currentItem = itemsForPkg[indexInPkg];

  const itemsDone = task?.items.filter((x) => x.status !== "pending").length ?? 0;
  const itemsTotal = task?.items.length ?? 0;
  const progressPct = itemsTotal ? Math.round((itemsDone / itemsTotal) * 100) : 0;
  const timeSec = Math.max(0, Math.floor((now - startedAt) / 1000));

  const setItemStatus = (id: string, status: PickItem["status"]) => {
    setTask((prev) =>
      !prev
        ? prev
        : { ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, status } : it)) }
    );
  };

  const nextItem = () => setIndexInPkg((i) => Math.min(i + 1, Math.max(0, itemsForPkg.length - 1)));

  const nextPackage = () => {
    if (!task || !selectedPkg) return;
    const ids = task.packages.map((p) => p.packageId);
    const next = ids[(ids.indexOf(selectedPkg) + 1) % ids.length];
    setSelectedPkg(next);
    setIndexInPkg(0);
  };

  const onScan = () => {
    if (!currentItem) return;
    setItemStatus(currentItem.id, "scanned");
    toast.success("Great, this is the right container");
    setTimeout(() => nextItem(), 100);
  };

  const allDone = !!task && task.items.every((x) => x.status !== "pending");

  const onFinish = () => {
    if (!task) return;
    if (!allDone) {
      toast.error("Items still pending");
      return;
    }
    toast.success(
      `Order completed. Place on delivery shelf ${task.deliveryShelf.row}-${task.deliveryShelf.bay}`
    );
    setTimeout(() => navigate("/picker/dashboard"), 700);
  };

  if (!task) return <VStack align="start" p={4}><Text>Loading task…</Text></VStack>;

  return (
    <Grid columns={{ base: 1, md: 12 }} gap={4}>
      {/* Left: packages */}
      <GridItem colSpan={{ base: 12, md: 3 }}>
        <Card.Root>
          <Card.Header>
            <Heading size="sm">Cart load plan</Heading>
          </Card.Header>
          <Card.Body>
            <VStack align="stretch" gap={2}>
              {task.packages.map((p) => (
                <Button
                  key={p.packageId}
                  variant={selectedPkg === p.packageId ? "solid" : "outline"}
                  onClick={() => {
                    setSelectedPkg(p.packageId);
                    setIndexInPkg(0);
                  }}
                >
                  <HStack justify="space-between" w="full">
                    <Text>
                      {p.packageId} • {p.sizeCode}
                    </Text>
                    <Badge>{p.targetUse}</Badge>
                  </HStack>
                </Button>
              ))}
            </VStack>
          </Card.Body>
        </Card.Root>
      </GridItem>

      {/* Center: current item */}
      <GridItem colSpan={{ base: 12, md: 6 }}>
        <Card.Root>
          <Card.Header>
            <HStack justify="space-between" w="full">
              <Heading size="sm">{currentItem?.name ?? "No items"}</Heading>
              <Badge colorPalette={currentItem?.status === "scanned" ? "green" : "gray"}>
                {currentItem?.status ?? "—"}
              </Badge>
            </HStack>
          </Card.Header>
        <Card.Body>
            {currentItem ? (
              <VStack align="stretch" gap={3}>
                <Image
                  src={currentItem.imageUrl}
                  alt={currentItem.name}
                  borderRadius="lg"
                  maxH="220px"
                  objectFit="cover"
                />
                <HStack gap={4}>
                  <Text fontWeight="bold">Shelf/Zone:</Text>
                  <Text fontWeight="bold">
                    {currentItem.shelf} · {currentItem.zone}
                  </Text>
                </HStack>
                <HStack gap={4}>
                  <Text>Units</Text>
                  <Badge>{currentItem.unitsRequired}</Badge>
                </HStack>
              </VStack>
            ) : (
              <Text>No more items in this package.</Text>
            )}
          </Card.Body>
          <Card.Footer>
            <HStack gap={2} wrap="wrap">
              <Button onClick={onScan} disabled={!currentItem}>
                Scan
              </Button>
              <Button variant="outline" onClick={nextItem} disabled={!currentItem}>
                Next item
              </Button>
              <Button variant="outline" onClick={nextPackage} disabled={!task.packages.length}>
                Next package
              </Button>
              <Button colorPalette="green" onClick={onFinish} disabled={!allDone}>
                Finish order
              </Button>
            </HStack>
          </Card.Footer>
        </Card.Root>
      </GridItem>

      {/* Right: timer + progress */}
      <GridItem colSpan={{ base: 12, md: 3 }}>
        <Card.Root>
          <Card.Header>
            <Heading size="sm">Timer</Heading>
          </Card.Header>
          <Card.Body>
            <VStack align="start" gap={2}>
              <Text fontSize="2xl">{fmtTime(timeSec)}</Text>
              <Text fontSize="sm">
                {itemsDone}/{itemsTotal} items
              </Text>
              <Progress.Root value={progressPct} aria-label="order-progress">
                <Progress.Track />
                <Progress.Range />
              </Progress.Root>
            </VStack>
          </Card.Body>
        </Card.Root>
      </GridItem>
    </Grid>
  );
}
