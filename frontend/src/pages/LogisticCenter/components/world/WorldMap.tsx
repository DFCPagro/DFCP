import { Box } from "@chakra-ui/react"
import type { WorldSpec, ShelfDTO } from "@/types/logisticCenter"
import AbsoluteZone from "./AbsoluteZone"

export default function WorldMap({
  world,
  shelvesByZone,
  hideNulls = false, // NEW: forward hide behavior to zones
}: {
  world: WorldSpec
  shelvesByZone?: Record<string, Record<string, ShelfDTO | null>>
  hideNulls?: boolean
}) {
  const px = (m: number) => Math.round(m * world.pixelsPerMeter)
  const maxX = Math.max(...world.zones.map((z) => z.x + z.width))
  const maxY = Math.max(...world.zones.map((z) => z.y + z.height))
  const canvasW = px(maxX) + 240
  const canvasH = px(maxY) + 240

  return (
    <Box position="relative" w={`${canvasW}px`} h={`${canvasH}px`} minW="max-content" minH="max-content">
      {world.zones.map((z) => (
        <AbsoluteZone key={z.id} zone={z} px={px} shelvesByCell={shelvesByZone?.[z.id]} hideNulls={hideNulls} />
      ))}
    </Box>
  )
}
