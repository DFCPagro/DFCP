import { Box } from "@chakra-ui/react"
import Topbar from "./components/Topbar"
import Canvas from "./components/Canvas"
import { worldLayout as DEFAULT_WORLD } from "@/data/worldLayout"
import WorldMap from "./components/world/WorldMap"
import FloatingToolbar from "./components/FloatingToolbar"
import HUDControls from "./components/HUDControls"
import ScanDialog from "./components/ScanDialog"
import ShelfDetailDialog from "./components/ShelfDetailDialog"
import { useUIStore } from "@/store/useUIStore"
import { shelvesByZoneToCells } from "@/data/mockWorldShelves"
import { useEffect, useMemo } from "react"
import { filterShelvesByUI } from "@/selectors/filterShelves"
import { getShelfPixelCenter } from "@/utils/worldMath"

export default function App() {
  const { detailShelf, filterType, onlyAvoid, crowdedOnly } = useUIStore()
  const shelvesRaw = shelvesByZoneToCells()

  // Apply HUD filters
  const shelves = useMemo(
    () => filterShelvesByUI(shelvesRaw, { filterType, onlyAvoid, crowdedOnly }),
    [shelvesRaw, filterType, onlyAvoid, crowdedOnly],
  )

  const world = DEFAULT_WORLD

  // Go-to-shelf wiring
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ shelfId: string }>
      const shelfId = ce.detail?.shelfId
      if (!shelfId) return
      const pos = getShelfPixelCenter(world, shelves, shelfId)
      if (!pos) return
      window.dispatchEvent(new CustomEvent("board:focus", { detail: { x: pos.x, y: pos.y, scale: 1.2 } }))
    }
    window.addEventListener("app:gotoShelf", handler as any)
    return () => window.removeEventListener("app:gotoShelf", handler as any)
  }, [world, shelves])

  // Determine whether any filter is active; if yes, hideNulls=true
  const hideNulls = filterType !== "all" || onlyAvoid || crowdedOnly

  return (
    <>
      {/* Background */}
      <Box
        pos="fixed"
        top={0}
        left={0}
        w="100vw"
        h="100vh"
        zIndex={0}
        bg={`radial-gradient(900px 600px at 80% -10%, rgba(34,197,94,0.28) 0%, transparent 60%),
             radial-gradient(900px 600px at 20% 110%, rgba(13,148,136,0.22) 0%, transparent 65%),
             linear-gradient(180deg, #071018 0%, #0a1b15 100%)`}
      />

      {/* App */}
      <Box minH="100dvh" color="text" position="relative" zIndex={1}>
        <Topbar />
        <Canvas>
          <WorldMap world={world} shelvesByZone={shelves} hideNulls={hideNulls} />
        </Canvas>

        {/* Floating UI */}
        <FloatingToolbar />
        <HUDControls />

        {/* Dialogs */}
        <ScanDialog />
        <ShelfDetailDialog shelf={detailShelf} />
      </Box>
    </>
  )
}
