///for when we manage for the first time and map out the land

import React, { useMemo, useRef, useState } from "react";


import {
  Box,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  Input,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  ChakraProvider,
  createSystem,
  defaultConfig,
  Table,
  NumberInput,
  Tooltip,
  Switch,
  chakra,
  Button,
} from "@chakra-ui/react";
import {
  RotateCcw as RotateCcwIcon,
  Sun as SunIcon,
  Moon as MoonIcon,
} from "lucide-react";
import { ThemeProvider, useTheme } from "next-themes";

type Pt = { x: number; y: number };

const system = createSystem(defaultConfig, {});

export function LandMapperProvider({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class" defaultTheme="system">
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}

function ColorModeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Tooltip.Root positioning={{ placement: "top" }}>
      <Tooltip.Trigger asChild>
        <IconButton
          aria-label="toggle-theme"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          size="sm"
          children={isDark ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        />
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content>{isDark ? "Light" : "Dark"}</Tooltip.Content>
        <Tooltip.Arrow />
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}

function centroid(pts: Pt[]): Pt {
  const s = pts.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  return { x: s.x / pts.length, y: s.y / pts.length };
}

function sortClockwise(pts: Pt[]): Pt[] {
  const c = centroid(pts);
  return [...pts].sort(
    (p1, p2) =>
      Math.atan2(p1.y - c.y, p1.x - c.x) -
      Math.atan2(p2.y - c.y, p2.x - c.x)
  );
}

function shoelaceArea(ptsCW: Pt[]): number {
  let area = 0;
  for (let i = 0; i < ptsCW.length; i++) {
    const j = (i + 1) % ptsCW.length;
    area += ptsCW[i].x * ptsCW[j].y - ptsCW[j].x * ptsCW[i].y;
  }
  return Math.abs(area) / 2;
}

function perimeter(pts: Pt[]): number {
  let peri = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const dx = pts[i].x - pts[j].x;
    const dy = pts[i].y - pts[j].y;
    peri += Math.hypot(dx, dy);
  }
  return peri;
}

function makeProjector(pts: Pt[], pad = 24) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const viewW = 720 - pad * 2;
  const viewH = 520 - pad * 2;
  const scale = Math.min(viewW / w, viewH / h);
  const offX = pad + (viewW - w * scale) / 2 - minX * scale;
  const offY = pad + (viewH - h * scale) / 2 + maxY * scale;
  return (p: Pt) => ({ x: p.x * scale + offX, y: -p.y * scale + offY });
}

// ✅ Pointer events version
function useDrag(onMove: (dx: number, dy: number) => void) {
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    last.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !last.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    onMove(dx, dy);
    last.current = { x: e.clientX, y: e.clientY };
  };

  return { onPointerDown, onPointerUp, onPointerMove } as const;
}

function edgeLengths(pts: Pt[]) {
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.hypot(p.x - q.x, p.y - q.y);
  });
}

export default function App() {
  return (
    <LandMapperProvider>
      <LandMapperDemo />
    </LandMapperProvider>
  );
}

function LandMapperDemo() {
  const [rawPts, setRawPts] = useState<Pt[]>([
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 120, y: 100 },
    { x: 0, y: 100 },
  ]);
  const [showGrid] = useState(true);

  const ptsCW = useMemo(() => sortClockwise(rawPts), [rawPts]);
  const stats = useMemo(
    () => ({ area: shoelaceArea(ptsCW), peri: perimeter(ptsCW) }),
    [ptsCW]
  );
  const project = useMemo(() => makeProjector(ptsCW), [ptsCW]);
  const screenScale = useMemo(() => {
    const p0 = project({ x: 0, y: 0 });
    const p1 = project({ x: 1, y: 0 });
    return Math.hypot(p1.x - p0.x, p1.y - p0.y);
  }, [project]);

  const reset = () =>
    setRawPts([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 100 },
      { x: 0, y: 100 },
    ]);

  const polygonPoints = useMemo(() => {
    if (!ptsCW.length) return "";
    const coords = ptsCW.map(project);
    const closed = [...coords, coords[0]];
    return closed.map((p) => `${p.x},${p.y}`).join(" ");
  }, [ptsCW, project]);

  const lengths = edgeLengths(ptsCW);

  const saveShape = () => {
    console.log("Coordinates:", ptsCW);
    console.log("Side lengths:", {
      AB: lengths[0].toFixed(2),
      BC: lengths[1].toFixed(2),
      CD: lengths[2].toFixed(2),
      DA: lengths[3].toFixed(2),
    });
    console.log("Area:", stats.area.toFixed(2));
  };

  return (
    <Grid templateColumns={{ base: "1fr", xl: "2fr 1fr" }} gap={6} p={6}>
      <GridItem>
        <Box bg="bg" rounded="xl" p={4} shadow="md" borderWidth="1px">
          <HStack justify="space-between" mb={2}>
            <Heading size="md">Land shape (A,B,C,D)</Heading>
            <HStack>
              <Tooltip.Root positioning={{ placement: "top" }}>
                <Tooltip.Trigger asChild>
                  <IconButton
                    aria-label="reset"
                    onClick={reset}
                    size="sm"
                    children={<RotateCcwIcon size={16} />}
                  />
                </Tooltip.Trigger>
                <Tooltip.Positioner>
                  <Tooltip.Content>Reset to defaults</Tooltip.Content>
                  <Tooltip.Arrow />
                </Tooltip.Positioner>
              </Tooltip.Root>
              <ColorModeToggle />
            </HStack>
          </HStack>

          <chakra.svg width="100%" height="560px" viewBox={`0 0 720 520`} bg="bg.subtle">
            <rect
              x={0}
              y={0}
              width={720}
              height={520}
              rx={12}
              fill="transparent"
              stroke="currentColor"
              opacity={0.15}
            />
            <polyline
              points={polygonPoints}
              fill="rgba(56, 161, 105, 0.15)"
              stroke="#48BB78"
              strokeWidth={2}
            />

            {/* Edge labels with distances */}
            {ptsCW.map((p, i) => {
              const q = ptsCW[(i + 1) % ptsCW.length];
              const mid = project({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
              const actual = lengths[i].toFixed(1);
              const label = ["AB", "BC", "CD", "DA"][i];
              return (
                <text
                  key={`len-${i}`}
                  x={mid.x}
                  y={mid.y}
                  fontSize={12}
                  fill="green"
                  fontWeight={600}
                  textAnchor="middle"
                >
                  {label}: {actual}
                </text>
              );
            })}

            {ptsCW.map((p, i) => {
              const screen = project(p);
              const label = ["A", "B", "C", "D"][i];
              const dragHandlers = useDrag((dx, dy) => {
                const wdx = dx / screenScale;
                const wdy = -dy / screenScale;
                const idxRaw = rawPts
                  .map((rp, ridx) => ({
                    ridx,
                    d: Math.hypot(rp.x - p.x, rp.y - p.y),
                  }))
                  .sort((a, b) => a.d - b.d)[0].ridx;
                setRawPts((prev) =>
                  prev.map((q, qIdx) =>
                    qIdx === idxRaw ? { x: q.x + wdx, y: q.y + wdy } : q
                  )
                );
              });
              return (
                <g key={i}>
                  <circle
                    cx={screen.x}
                    cy={screen.y}
                    r={7}
                    fill="#2F855A"
                    stroke="white"
                    strokeWidth={2}
                    style={{ cursor: "grab" }}
                    {...dragHandlers}
                  />
                  <text
                    x={screen.x + 10}
                    y={screen.y - 10}
                    fontSize={14}
                    fill="currentColor"
                    fontWeight={600}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </chakra.svg>
        </Box>
      </GridItem>

      <GridItem>
        <VStack align="stretch" gap={4}>
          <Box bg="bg" rounded="xl" p={4} shadow="md" borderWidth="1px">
            <Heading size="sm" mb={3}>
              Derived stats
            </Heading>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Metric</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Value</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                <Table.Row>
                  <Table.Cell>Area (shoelace)</Table.Cell>
                  <Table.Cell textAlign="end">{stats.area.toFixed(2)}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell>Perimeter</Table.Cell>
                  <Table.Cell textAlign="end">{stats.peri.toFixed(2)}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Box>
          <Button colorScheme="green" onClick={saveShape}>
            Save Shape
          </Button>
        </VStack>
      </GridItem>
    </Grid>
  );
}
