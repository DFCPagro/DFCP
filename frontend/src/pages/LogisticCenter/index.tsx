import { Box } from "@chakra-ui/react";
import Topbar from "./components/Topbar";
import Canvas from "./components/Canvas";
import LogisticMap from "@/components/common/LogisticMap";
import HUDControls from "./components/HUDControls";
import ScanDialog from "./components/ScanDialog";
import ShelfDetailDialog from "./components/ShelfDetailDialog";
import { useUIStore } from "@/store/useUIStore";
import { useEffect, useMemo, useState } from "react";
import { filterShelvesByUI } from "@/selectors/filterShelves";
import { getShelfPixelCenter } from "@/utils/worldMath";
import type { MapMode } from "@/types/map";
import { useAuthStore } from "@/store/auth";
import { useShelves } from "@/hooks/useShelves";
import { useWorldSpec } from "@/hooks/useWorld";

export default function App() {
  const { detailShelf, filterType, onlyAvoid, crowdedOnly } = useUIStore();

  // center id from auth (populated from backend login response)
  const centerId = useAuthStore((s) => s.logisticCenterId);

  // Backend-driven world spec (NO defaults passed)
  const {
    data: world,
    isLoading: worldLoading,
    isError: worldError,
  } = useWorldSpec(centerId);

  // Backend-driven shelves — filter to picker only
  const {
    shelvesByZone,
    isLoading: shelvesLoading,
    isError: shelvesError,
  } = useShelves(centerId, { type: "picker" });

  const [mode, setMode] = useState<MapMode>("manager");
  const [targetShelfId, setTargetShelfId] = useState<string | null>("1-A-1");

  // Apply HUD filters only in manager mode
  const shelves = useMemo(
    () =>
      mode === "manager"
        ? filterShelvesByUI(shelvesByZone, { filterType, onlyAvoid, crowdedOnly })
        : shelvesByZone,
    [shelvesByZone, filterType, onlyAvoid, crowdedOnly, mode]
  );

  // Go-to-shelf wiring (works in both modes) — only when world & shelves ready
  useEffect(() => {
    if (!world) return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ shelfId: string }>;
      const shelfId = ce.detail?.shelfId;
      if (!shelfId) return;
      const pos = getShelfPixelCenter(world, shelves, shelfId);
      if (!pos) return;
      window.dispatchEvent(
        new CustomEvent("board:focus", {
          detail: { x: pos.x, y: pos.y, scale: 1.2 },
        })
      );
      setTargetShelfId(shelfId);
    };
    window.addEventListener("app:gotoShelf", handler as any);
    return () => window.removeEventListener("app:gotoShelf", handler as any);
  }, [world, shelves]);

  // If the user is not associated with a center yet, don’t fetch anything.
  if (!centerId) {
    return (
      <>
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
        <Box minH="100dvh" color="text" position="relative" zIndex={1}>
          <Topbar />
          <Canvas>
            <Box p="6">
              No logistics center selected. Please sign in or choose a center.
            </Box>
          </Canvas>
        </Box>
      </>
    );
  }

  const loading = worldLoading || shelvesLoading;
  const error = worldError || shelvesError;

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
          {loading ? (
            <Box p="6">Loading map…</Box>
          ) : error ? (
            <Box p="6" color="red.300">
              Failed to load map or shelves.
            </Box>
          ) : world ? (
            <LogisticMap
              mode={mode}
              world={world}
              shelvesByZone={shelves}
              targetShelfId={mode === "picker" ? targetShelfId : null}
              hideNulls={
                mode === "manager"
                  ? filterType !== "all" || onlyAvoid || crowdedOnly
                  : false
              }
            />
          ) : null}
        </Canvas>

        {mode === "manager" && <HUDControls />}

        <ScanDialog />
        <ShelfDetailDialog shelf={detailShelf} />
      </Box>
    </>
  );
}
