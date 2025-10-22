import type { WorldSpec, WorldZone, WorldGridSpec } from "@/types/logisticCenter"

/**
 * ----- RENDER CONSTANTS (mirror AbsoluteZone.tsx) -----
 */
const PAD = 16
const GAP = 8
const AXES_LEFT = 26 // when showRowIndex = true
const AXES_TOP = 20  // when showColIndex = true

/**
 * Compute minimal pixelsPerMeter so each cell >= minW x minH (px)
 */
export function computePixelsPerMeter(
  zones: Array<Pick<WorldZone, "width" | "height" | "grid">>,
  minCellPx = { w: 70, h: 66 },
): number {
  let requiredPPM = 1
  for (const z of zones) {
    const { rows, cols, showRowIndex, showColIndex } = z.grid
    const axL = showRowIndex ? AXES_LEFT : 0
    const axT = showColIndex ? AXES_TOP : 0

    const neededW = cols * minCellPx.w + GAP * (cols - 1) + PAD * 2 + axL + 6
    const neededH = rows * minCellPx.h + GAP * (rows - 1) + PAD * 2 + (axT + 10)

    const ppmW = neededW / Math.max(1, z.width)
    const ppmH = neededH / Math.max(1, z.height)
    requiredPPM = Math.max(requiredPPM, ppmW, ppmH)
  }
  return Math.ceil(requiredPPM + 1) // safety margin
}

/**
 * Build a WorldSpec from meter-based descriptors.
 */
export function makeWorldSpec(input: {
  zones: Array<{
    id: string
    x: number
    y: number
    width: number
    height: number
    grid: WorldGridSpec
  }>
  minCellPx?: { w: number; h: number }
  basePPM?: number
}): WorldSpec {
  const ppm = Math.max(
    input.basePPM ?? 1,
    computePixelsPerMeter(input.zones, input.minCellPx ?? { w: 70, h: 66 }),
  )
  return {
    pixelsPerMeter: ppm,
    zones: input.zones.map((z) => ({ ...z })),
  }
}

/**
 * ----- Your facility zones in METERS (raw) -----
 * You can reuse this in App to rebuild with different min cell sizes.
 */
export const ZONES_METERS: Array<{
  id: string
  x: number
  y: number
  width: number
  height: number
  grid: WorldGridSpec
}> = [
  {
    id: "A",
    x: 0,
    y: 0,
    width: 55,
    height: 12,
    grid: { rows: 3, cols: 18, showRowIndex: true, showColIndex: true, colLabels: "numbers", titleSize: 30 },
  },
  {
    id: "B",
    x: 0,
    y: 12,
    width: 18,
    height: 20,
    grid: { rows: 4, cols: 3, showRowIndex: true, showColIndex: true, colLabels: "numbers", titleSize: 28 },
  },
  {
    id: "C",
    x: 23,
    y: 12,
    width: 25,
    height: 20,
    grid: { rows: 4, cols: 9, showRowIndex: true, showColIndex: true, colLabels: "numbers", titleSize: 28 },
  },
]

/**
 * Default world spec guaranteeing ≥ 70x66px cells.
 * (Keeps your previous behavior out-of-the-box.)
 */
export const worldLayout: WorldSpec = makeWorldSpec({
  zones: ZONES_METERS,
  minCellPx: { w: 70, h: 66 },
})

/**
 * Convenience helper if you want to rebuild at runtime
 * with different minimum cell sizes (e.g., user setting).
 */
export function makeWorldWithMinCell(minW = 70, minH = 66, basePPM?: number): WorldSpec {
  return makeWorldSpec({
    zones: ZONES_METERS,
    minCellPx: { w: minW, h: minH },
    basePPM,
  })
}
