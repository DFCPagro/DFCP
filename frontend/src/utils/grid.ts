export type GridMetrics = {
  cellW: number
  cellH: number
  gap: number
  marginTopBase: number
  marginLeftBase: number
}

/**
 * Compute compact grid metrics based on column count so dense zones shrink gracefully.
 * Keeps a readable, game-like density without overflowing.
 */
export function getGridMetrics(cols: number): GridMetrics {
  if (cols >= 12) {
    return { cellW: 40, cellH: 38, gap: 8, marginTopBase: 16, marginLeftBase: 30 }
  }
  if (cols >= 9) {
    return { cellW: 48, cellH: 44, gap: 8, marginTopBase: 16, marginLeftBase: 32 }
  }
  return { cellW: 56, cellH: 52, gap: 10, marginTopBase: 18, marginLeftBase: 34 }
}
