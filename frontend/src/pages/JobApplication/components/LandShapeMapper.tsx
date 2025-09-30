"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Box,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  SimpleGrid,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { RotateCcw as RotateCcwIcon } from "lucide-react";
import type { LandInput } from "@/types/availableJobs";

type Meas = NonNullable<LandInput["measurements"]>;
type Pt = { x: number; y: number };
type Side = "ab" | "bc" | "cd" | "da";

/**
 * Geometry utils
 */
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

function edgeLengths(pts: Pt[]) {
  return pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length];
    return Math.hypot(p.x - q.x, p.y - q.y);
  });
}

function toPtsFromMeasurements(m: Meas): Pt[] {
  // Start as axis-aligned quad A(0,0) -> B(ab,0) -> C(ab,bc) -> D(0,bc)
  const ab = m.abM ?? 50;
  const bc = m.bcM ?? 40;
  return [
    { x: 0, y: 0 }, // A
    { x: ab, y: 0 }, // B
    { x: ab, y: bc }, // C
    { x: 0, y: bc }, // D
  ];
}

function toMeasurementsFromPts(pts: Pt[]): Meas {
  const [ab, bc, cd, da] = edgeLengths(pts);
  return { abM: ab, bcM: bc, cdM: cd, daM: da, rotationDeg: 0 };
}

// Move the "end" vertex of a side so that the side length equals target.
// A->B (AB): move B along direction AB; BC: move C; CD: move D; DA: move A.
function setSideLength(pts: Pt[], side: Side, target: number): Pt[] {
  const next = [...pts];
  const idx =
    side === "ab" ? 0 : side === "bc" ? 1 : side === "cd" ? 2 : /* da */ 3;
  const start = next[idx];
  const end = next[(idx + 1) % 4];
  let vx = end.x - start.x;
  let vy = end.y - start.y;
  const cur = Math.hypot(vx, vy);

  if (cur === 0) {
    // pick an arbitrary direction (x-axis)
    vx = 1;
    vy = 0;
  } else {
    vx /= cur;
    vy /= cur;
  }

  const moved = { x: start.x + vx * target, y: start.y + vy * target };

  if (side === "da") {
    // DA moves A (index 0) as the "end" of side D->A
    next[0] = moved;
  } else {
    next[(idx + 1) % 4] = moved;
  }
  return next;
}

// Drag hook
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

export function LandShapeMapper({
  value,
  onChange,
  editable = true,
  showMeasureInputs = true,
}: {
  value?: Meas;
  onChange: (next: Meas) => void;
  /** If false, the shape is view-only (no dragging). */
  editable?: boolean;
  /** Toggle to show/hide AB/BC/CD/DA inputs */
  showMeasureInputs?: boolean;
}) {
  // Maintain ordered A,B,C,D points (no automatic resort) to allow arbitrary quads.
  const [pts, setPts] = useState<Pt[]>(
    toPtsFromMeasurements(
      value ?? { abM: 120, bcM: 100, cdM: 120, daM: 100, rotationDeg: 0 }
    )
  );

  // Projection & geometry
  const project = useMemo(() => makeProjector(pts), [pts]);
  const screenScale = useMemo(() => {
    const p0 = project({ x: 0, y: 0 });
    const p1 = project({ x: 1, y: 0 });
    return Math.hypot(p1.x - p0.x, p1.y - p0.y);
  }, [project]);

  const polygonPoints = useMemo(() => {
    const closed = [...pts, pts[0]];
    return closed.map((p) => `${project(p).x},${project(p).y}`).join(" ");
  }, [pts, project]);

  const [abLen, bcLen, cdLen, daLen] = edgeLengths(pts);

  // Emit measurements on every geometry change
  React.useEffect(() => {
    onChange(toMeasurementsFromPts(pts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts.map((p) => `${p.x},${p.y}`).join("|")]);

  const reset = () =>
    setPts(
      toPtsFromMeasurements(
        value ?? { abM: 120, bcM: 100, cdM: 120, daM: 100, rotationDeg: 0 }
      )
    );

  // Inputs — keep them independent; live-commit when numeric
  const [abText, setAbText] = useState(String(abLen));
  const [bcText, setBcText] = useState(String(bcLen));
  const [cdText, setCdText] = useState(String(cdLen));
  const [daText, setDaText] = useState(String(daLen));
  const [active, setActive] = useState<Side | null>(null);
  const isNumLike = (s: string) =>
    s === "" || s === "." || /^(\d+(\.\d*)?)$/.test(s);

  // Sync texts from geometry except for the active one
  React.useEffect(() => {
    if (active !== "ab") setAbText(abLen.toFixed(2));
    if (active !== "bc") setBcText(bcLen.toFixed(2));
    if (active !== "cd") setCdText(cdLen.toFixed(2));
    if (active !== "da") setDaText(daLen.toFixed(2));
  }, [abLen, bcLen, cdLen, daLen, active]);

  const liveCommit = (side: Side, str: string) => {
    if (str === "" || str === ".") return; // allow transient
    const n = Number(str);
    if (!Number.isNaN(n)) {
      setPts((prev) => setSideLength(prev, side, n));
    }
  };

  return (
    <Grid templateColumns={{ base: "1fr" }} gap={6}>
      <GridItem>
        <Box bg="bg" rounded="xl" p="4" shadow="md" borderWidth="1px">
          <HStack justify="space-between" mb="3">
            <Heading size="sm">Land shape (A,B,C,D)</Heading>
            <HStack>
              <Tooltip
                content="Reset to defaults"
                positioning={{ placement: "top" }}
              >
                <IconButton
                  aria-label="reset"
                  size="sm"
                  variant="outline"
                  onClick={reset}
                >
                  <Icon as={RotateCcwIcon} boxSize="4" />
                </IconButton>
              </Tooltip>
            </HStack>
          </HStack>

          {showMeasureInputs && (
            <SimpleGrid columns={{ base: 2, sm: 4 }} gap="3" mb="4">
              {/* AB */}
              <Stack gap="1">
                <Text fontSize="sm" color="fg.muted">
                  Top (AB) m
                </Text>
                <Input
                  value={abText}
                  onFocus={() => setActive("ab")}
                  onBlur={() => setActive((s) => (s === "ab" ? null : s))}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!isNumLike(v)) return;
                    setAbText(v);
                    liveCommit("ab", v);
                  }}
                  inputMode="decimal"
                />
              </Stack>

              {/* BC */}
              <Stack gap="1">
                <Text fontSize="sm" color="fg.muted">
                  Right (BC) m
                </Text>
                <Input
                  value={bcText}
                  onFocus={() => setActive("bc")}
                  onBlur={() => setActive((s) => (s === "bc" ? null : s))}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!isNumLike(v)) return;
                    setBcText(v);
                    liveCommit("bc", v);
                  }}
                  inputMode="decimal"
                />
              </Stack>

              {/* CD */}
              <Stack gap="1">
                <Text fontSize="sm" color="fg.muted">
                  Bottom (CD) m
                </Text>
                <Input
                  value={cdText}
                  onFocus={() => setActive("cd")}
                  onBlur={() => setActive((s) => (s === "cd" ? null : s))}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!isNumLike(v)) return;
                    setCdText(v);
                    liveCommit("cd", v);
                  }}
                  inputMode="decimal"
                />
              </Stack>

              {/* DA */}
              <Stack gap="1">
                <Text fontSize="sm" color="fg.muted">
                  Left (DA) m
                </Text>
                <Input
                  value={daText}
                  onFocus={() => setActive("da")}
                  onBlur={() => setActive((s) => (s === "da" ? null : s))}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!isNumLike(v)) return;
                    setDaText(v);
                    liveCommit("da", v);
                  }}
                  inputMode="decimal"
                />
              </Stack>
            </SimpleGrid>
          )}

          <chakra.svg
            width="100%"
            height="560px"
            viewBox="0 0 720 520"
            bg="bg.subtle"
            rounded="lg"
          >
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

            {/* Edge labels */}
            {[abLen, bcLen, cdLen, daLen].map((len, i) => {
              const p = pts[i];
              const q = pts[(i + 1) % 4];
              const mid = project({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
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
                  {label}: {len.toFixed(1)} m
                </text>
              );
            })}

            {/* Draggable points (disabled if editable=false) */}
            {pts.map((p, i) => {
              const screen = project(p);
              const label = ["A", "B", "C", "D"][i];
              const dragHandlers = editable
                ? useDrag((dx, dy) => {
                    const wdx = dx / screenScale;
                    const wdy = -dy / screenScale;
                    setPts((prev) =>
                      prev.map((q, qIdx) =>
                        qIdx === i ? { x: q.x + wdx, y: q.y + wdy } : q
                      )
                    );
                  })
                : {
                    onPointerDown: undefined,
                    onPointerUp: undefined,
                    onPointerMove: undefined,
                  };

              return (
                <g key={i}>
                  <circle
                    cx={screen.x}
                    cy={screen.y}
                    r={7}
                    fill="#2F855A"
                    stroke="white"
                    strokeWidth={2}
                    style={{ cursor: editable ? "grab" : "default" }}
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
    </Grid>
  );
}
