import Board from "./Board"
import WorldMap from "./world/WorldMap"
import type { MapMode, HighlightTarget } from "@/types/map"
import type { WorldSpec, ShelfDTO } from "@/types/logisticCenter"
import { parseShelfId } from "@/utils/worldMath"

export default function LogisticMap({
  mode,
  world,
  shelvesByZone,
  targetShelfId,
  hideNulls = false,
}: {
  mode: MapMode
  world: WorldSpec
  shelvesByZone?: Record<string, Record<string, ShelfDTO | null>>
  targetShelfId?: string | null
  hideNulls?: boolean
}) {
  const target: HighlightTarget =
    targetShelfId ? parseShelfId(targetShelfId.replace(/\s+/g, "")) : null

  return (
    <Board controls>
      <WorldMap
        world={world}
        shelvesByZone={shelvesByZone}
        hideNulls={hideNulls}
        mode={mode}
        highlight={target}
      />
    </Board>
  )
}
