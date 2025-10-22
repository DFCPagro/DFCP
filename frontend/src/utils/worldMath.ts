import type { WorldSpec, WorldZone, ShelfDTO } from "@/types/logisticCenter"

/**
 * These constants MUST mirror the ones used in AbsoluteZone.tsx
 */
const PAD = 16
const GAP = 8
const AXES_LEFT = 26 // when showRowIndex = true
const AXES_TOP = 20  // when showColIndex = true

// These limits mirror the clamps used in AbsoluteZone
const CELL_MIN_W = 34
const CELL_MAX_W = 72
const CELL_MIN_H = 30
const CELL_MAX_H = 68

/** meters -> pixels using world's PPM */
export const px = (world: WorldSpec) => (m: number) => Math.round(m * world.pixelsPerMeter)

/** Find zone by id */
export function getZone(world: WorldSpec, id: string): WorldZone | undefined {
  return world.zones.find((z) => z.id === id)
}

/**
 * Compute effective grid metrics for a zone, EXACTLY as AbsoluteZone does.
 * Returns pixel sizes & offsets to top-left corner of the grid area inside the card.
 */
export function computeZoneGridMetrics(world: WorldSpec, zone: WorldZone) {
  const toPx = px(world)
  const boxW = toPx(zone.width)
  const boxH = toPx(zone.height)

  const axesLeft = zone.grid.showRowIndex ? AXES_LEFT : 0
  const axesTop = zone.grid.showColIndex ? AXES_TOP : 0

  const innerW = Math.max(0, boxW - PAD * 2 - axesLeft - 6)
  const innerH = Math.max(0, boxH - PAD * 2 - (axesTop + 10))

  const rawCellW = Math.floor((innerW - GAP * (zone.grid.cols - 1)) / zone.grid.cols)
  const rawCellH = Math.floor((innerH - GAP * (zone.grid.rows - 1)) / zone.grid.rows)

  const cellW = Math.max(CELL_MIN_W, Math.min(CELL_MAX_W, rawCellW))
  const cellH = Math.max(CELL_MIN_H, Math.min(CELL_MAX_H, rawCellH))

  const gridW = zone.grid.cols * cellW + (zone.grid.cols - 1) * GAP
  const gridH = zone.grid.rows * cellH + (zone.grid.rows - 1) * GAP

  const gridOffsetX = Math.max(0, (innerW - gridW) / 2)
  const gridOffsetY = Math.max(0, (innerH - gridH) / 2)

  // Absolute offsets from the card's top-left (which itself is at (zone.x, zone.y) in meters)
  const absGridLeft = PAD + axesLeft + gridOffsetX
  const absGridTop = PAD + axesTop + gridOffsetY

  return {
    cellW,
    cellH,
    gap: GAP,
    absGridLeft,
    absGridTop,
    boxW,
    boxH,
  }
}

/**
 * Parse shelf id like "C-3-6" -> { zoneId: "C", row: 3, col: 6 }
 */
export function parseShelfId(id: string): { zoneId: string; row: number; col: number } | null {
  const m = id.match(/^([A-Za-z]+)[-_](\d+)[-_](\d+)$/)
  if (!m) return null
  return { zoneId: m[1].toUpperCase(), row: Number(m[2]), col: Number(m[3]) }
}

/**
 * Compute the *content-space* pixel center of a shelf cell (before Board transforms).
 * You can send this to the Board via "board:focus" to center the viewport on it.
 */
export function getShelfPixelCenter(
  world: WorldSpec,
  shelvesByZone: Record<string, Record<string, ShelfDTO | null>>,
  shelfId: string,
): { x: number; y: number } | null {
  const parsed = parseShelfId(shelfId)
  if (!parsed) return null
  const zone = getZone(world, parsed.zoneId)
  if (!zone) return null

  const toPx = px(world)
  const zoneLeft = toPx(zone.x)
  const zoneTop = toPx(zone.y)
  const { cellW, cellH, gap, absGridLeft, absGridTop } = computeZoneGridMetrics(world, zone)

  const c = parsed.col - 1
  const r = parsed.row - 1
  const cellLeft = zoneLeft + absGridLeft + c * (cellW + gap)
  const cellTop = zoneTop + absGridTop + r * (cellH + gap)

  const centerX = cellLeft + cellW / 2
  const centerY = cellTop + cellH / 2
  return { x: centerX, y: centerY }
}
