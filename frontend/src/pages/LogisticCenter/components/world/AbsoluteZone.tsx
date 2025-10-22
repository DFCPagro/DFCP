import { Box, Card, Grid, HStack, Text, VStack } from "@chakra-ui/react"
import { Tooltip } from "@/components/ui/tooltip"
import type { WorldZone } from "@/types/logisticCenter"
import Cell from "../Cell"
import { numToLetters } from "@/utils/labels"
import type { ShelfDTO } from "@/types/logisticCenter"
export default function AbsoluteZone({
  zone,
  px,
  shelvesByCell,
  hideNulls = false, // NEW: hide cells that were filtered out
}: {
  zone: WorldZone
  px: (meters: number) => number
  shelvesByCell?: Record<string, ShelfDTO | null>
  hideNulls?: boolean
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

  return (
    <Card.Root
      position="absolute"
      left={`${boxLeft}px`}
      top={`${boxTop}px`}
      w={`${boxW}px`}
      h={`${boxH}px`}
      borderRadius="16px"
      bg={`linear-gradient(180deg, var(--colors-gamePanelTop), var(--colors-gamePanelBottom))`}
    >
      <Card.Body p={`${pad}px`} position="relative">
        <Tooltip content={`Zone ${zone.id} — ${zone.width}m × ${zone.height}m`}>
          <Text
            position="absolute"
            left="10px"
            top="8px"
            fontWeight="800"
            letterSpacing=".06em"
            color="gameZoneTitle"
            opacity=".9"
            pointerEvents="auto"
            style={{ fontSize: `${zone.grid.titleSize ?? 26}px` }}
          >
            {zone.id}
          </Text>
        </Tooltip>

        {zone.grid.showColIndex && (
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

        {zone.grid.showRowIndex && (
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
              return <Cell key={code} code={code} shelf={shelf} size={{ w: finalCellW, h: finalCellH }} hideWhenNull={hideNulls} />
            }),
          )}
        </Grid>
      </Card.Body>
    </Card.Root>
  )
}
