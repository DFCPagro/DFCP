import { Box, Card, Grid, HStack, Text, VStack } from "@chakra-ui/react"
import type { WorldZone } from "@/types/logisticCenter"
import Cell from "@/components/common/LogisticMap/zone/Cell"
import { numToLetters } from "@/utils/labels"
import type { ShelfDTO } from "@/types/logisticCenter"
import type { MapMode, HighlightTarget } from "@/types/map"

export default function AbsoluteZone({
  zone,
  px,
  shelvesByCell,
  hideNulls = false,
  mode = "manager",
  highlight = null,
}: {
  zone: WorldZone
  px: (meters: number) => number
  shelvesByCell?: Record<string, ShelfDTO | null>
  hideNulls?: boolean
  mode?: MapMode
  highlight?: HighlightTarget
}) {
  const boxLeft = px(zone.x)
  const boxTop = px(zone.y)
  const boxW = px(zone.width)
  const boxH = px(zone.height)

  const pad = 16
  const axesTop = zone.grid.showColIndex ? 20 : 0
  const axesLeft = zone.grid.showRowIndex ? 26 : 0

  const innerW = Math.max(0, boxW - pad * 2 - axesLeft - 6)
  const innerH = Math.max(0, boxH - pad * 2 - (axesTop + 10))

  const gap = 8
  const cellW = Math.floor((innerW - gap * (zone.grid.cols - 1)) / zone.grid.cols)
  const cellH = Math.floor((innerH - gap * (zone.grid.rows - 1)) / zone.grid.rows)

  const finalCellW = Math.max(34, Math.min(72, cellW))
  const finalCellH = Math.max(30, Math.min(68, cellH))

  const gridW = zone.grid.cols * finalCellW + (zone.grid.cols - 1) * gap
  const gridH = zone.grid.rows * finalCellH + (zone.grid.rows - 1) * gap
  const gridOffsetX = Math.max(0, (innerW - gridW) / 2)
  const gridOffsetY = Math.max(0, (innerH - gridH) / 2)

  const pickerDim = mode === "picker" && (!highlight || highlight.zoneId !== zone.id)

  const squarePx = 27 // try 10–16; you can even derive from finalCellH if you want

    return (
    <Card.Root
      position="absolute"
      left={`${boxLeft}px`}
      top={`${boxTop}px`}
      w={`${boxW}px`}
      h={`${boxH}px`}
      borderRadius="16px"
      overflow="hidden" // important so grid respects rounding
      bg={`linear-gradient(180deg, token(colors.gamePanelTop), token(colors.gamePanelBottom))`}
      css={
        mode === "picker"
          ? {
              boxShadow:
                highlight && highlight.zoneId === zone.id
                  ? "0 0 0 2px rgba(34,197,94,.8), 0 12px 40px rgba(0,0,0,.35)"
                  : undefined,
              opacity: pickerDim ? 0.35 : 1,
              transition: "opacity .2s ease, box-shadow .2s ease",
            }
          : undefined
      }
    >
      {/* Graph-paper background layer */}
      <Box
        aria-hidden
        pointerEvents="none"
        position="absolute"
        inset="0"
        zIndex={0}
        // custom CSS vars to control square sizes
        style={
          {
            // @ts-ignore – allow custom CSS vars
            "--sq": `${squarePx}px`,
            "--sq5": `calc(${squarePx}px * 5)`,
          } as React.CSSProperties
        }
        // 1) base panel gradient (already on parent)
        // 2) fine grid (thin lines)
        // 3) major grid every 5 squares (slightly stronger)
        bg={`
          /* fine vertical lines */
          repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent calc(var(--sq) - 1px),
            rgba(255,255,255,0.05) calc(var(--sq) - 1px),
            rgba(255,255,255,0.05) var(--sq)
          ),
          /* fine horizontal lines */
          repeating-linear-gradient(
            0deg,
            transparent 0,
            transparent calc(var(--sq) - 1px),
            rgba(255,255,255,0.05) calc(var(--sq) - 1px),
            rgba(255,255,255,0.05) var(--sq)
          ),
          /* major vertical lines */
          repeating-linear-gradient(
            90deg,
            transparent 0,
            transparent calc(var(--sq5) - 1px),
            rgba(255,255,255,0.08) calc(var(--sq5) - 1px),
            rgba(255,255,255,0.08) var(--sq5)
          ),
          /* major horizontal lines */
          repeating-linear-gradient(
            0deg,
            transparent 0,
            transparent calc(var(--sq5) - 1px),
            rgba(255,255,255,0.08) calc(var(--sq5) - 1px),
            rgba(255,255,255,0.08) var(--sq5)
          )
        `}
        // optional tint to blend with your panel gradient
        opacity={0.9}
      />

      <Card.Body p={`${pad}px`} position="relative">
        <Text
          position="absolute"
          left="10px"
          top="8px"
          fontWeight="800"
          letterSpacing=".06em"
          color="gameZoneTitle"
          opacity=".9"
          pointerEvents="none"
          style={{ fontSize: `${zone.grid.titleSize ?? 26}px` }}
        >
          {zone.id}
        </Text>

        {/* Column labels (hidden for picker to reduce noise unless highlighted zone) */}
        {zone.grid.showColIndex && (mode !== "picker" || (highlight && highlight.zoneId === zone.id)) && (
          <HStack
            position="absolute"
            left={`${pad + axesLeft + gridOffsetX}px`}
            top={`${pad + 2}px`}
            gap={`${gap}px`}
            fontSize="11px"
            color="muted"
            pointerEvents="none"
          >
            {Array.from({ length: zone.grid.cols }).map((_, i) => (
              <Box key={i} w={`${finalCellW}px`} textAlign="center">
                {zone.grid.colLabels === "letters" ? numToLetters(i + 1) : i + 1}
              </Box>
            ))}
          </HStack>
        )}

        {/* Row labels */}
        {zone.grid.showRowIndex && (mode !== "picker" || (highlight && highlight.zoneId === zone.id)) && (
          <VStack
            position="absolute"
            left={`${pad + 2}px`}
            top={`${pad + axesTop + gridOffsetY}px`}
            gap={`${gap}px`}
            fontSize="11px"
            color="muted"
            pointerEvents="none"
          >
            {Array.from({ length: zone.grid.rows }).map((_, i) => (
              <Box key={i} h={`${finalCellH}px`} lineHeight={`${finalCellH}px`} textAlign="center">
                {i + 1}
              </Box>
            ))}
          </VStack>
        )}

        <Grid
          position="absolute"
          left={`${pad + axesLeft + gridOffsetX}px`}
          top={`${pad + axesTop + gridOffsetY}px`}
          templateColumns={`repeat(${zone.grid.cols}, ${finalCellW}px)`}
          autoRows={`${finalCellH}px`}
          gap={`${gap}px`}
        >
          {Array.from({ length: zone.grid.rows }).map((_, r) =>
            Array.from({ length: zone.grid.cols }).map((__, c) => {
              const row = r + 1
              const col = c + 1
              const shelf = shelvesByCell?.[`${row}-${col}`] ?? null
              const code = `${row}${zone.id}${col}`
              const isTarget = highlight && highlight.row === row && highlight.col === col && highlight.zoneId === zone.id

              return (
                <Cell
                  key={code}
                  code={code}
                  shelf={shelf}
                  size={{ w: finalCellW, h: finalCellH }}
                  hideWhenNull={hideNulls}
                  variant={mode}
                  highlight={!!isTarget}
                />
              )
            }),
          )}
        </Grid>
      </Card.Body>
    </Card.Root>
  )
}
