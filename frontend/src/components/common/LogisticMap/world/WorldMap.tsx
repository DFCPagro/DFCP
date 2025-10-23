import { Box } from "@chakra-ui/react"
import type { WorldSpec, ShelfDTO } from "@/types/logisticCenter"
import type { MapMode, HighlightTarget } from "@/types/map"
import AbsoluteZone from "./AbsoluteZone"

export default function WorldMap({
  world,
  shelvesByZone,
  hideNulls = false,
  mode = "manager",
  highlight = null,
}: {
  world: WorldSpec
  shelvesByZone?: Record<string, Record<string, ShelfDTO | null>>
  hideNulls?: boolean
  mode?: MapMode
  highlight?: HighlightTarget
}) {
  const px = (m: number) => Math.round(m * world.pixelsPerMeter)
  const hasZones = world?.zones?.length > 0
  const maxX = hasZones ? Math.max(...world.zones.map((z) => z.x + z.width)) : 0
  const maxY = hasZones ? Math.max(...world.zones.map((z) => z.y + z.height)) : 0
  const canvasW = px(maxX) + 240
  const canvasH = px(maxY) + 240


  return (
    <Box position="relative" w={`${canvasW}px`} h={`${canvasH}px`} minW="max-content" minH="max-content">
      {world.zones.map((z) => (
        <AbsoluteZone
          key={z.id}
          zone={z}
          px={px}
          shelvesByCell={shelvesByZone?.[z.id]}
          hideNulls={hideNulls}
          mode={mode}
          highlight={highlight && highlight.zoneId === z.id ? highlight : null}
        />
      ))}
    </Box>
  )
}
