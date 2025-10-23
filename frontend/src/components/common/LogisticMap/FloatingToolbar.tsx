import { Card, HStack, IconButton } from "@chakra-ui/react"
import { ZoomIn, ZoomOut, RefreshCcw } from "lucide-react"
import { useEffect, useRef } from "react"
import { Tooltip } from "@/components/ui/tooltip"
/**
 * Floating controls that talk to Board using a CustomEvent ("board:control").
 * Keep UI minimal and off the canvas area.
 */
export default function FloatingToolbar() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  // find nearest Board container (assumes Canvas wraps Board)
  const emit = (type: "zoomIn" | "zoomOut" | "reset") => {
    const board = document.querySelector("[data-board-root='1']")
    board?.dispatchEvent(new CustomEvent("board:control", { detail: { type } as any }))
  }

  useEffect(() => {
    // no-op; placeholder for future keyboard shortcuts
  }, [])

  return (
    <Card.Root
      position="fixed"
    //   top="16px"
    //   right="16px"
    bottom={"5rem"}
      zIndex={40}
      borderRadius="16px"
      ref={hostRef}
      bg={`linear-gradient(180deg, var(--chakra-colors-gamePanelTop), var(--chakra-colors-gamePanelBottom))`}
    >
      <Card.Body p="2">
        <HStack>
          <Tooltip content="Zoom in">
            <IconButton aria-label="Zoom in" onClick={() => emit("zoomIn")} variant="ghost" size="sm">
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip content="Zoom out">
            <IconButton aria-label="Zoom out" onClick={() => emit("zoomOut")} variant="ghost" size="sm">
              <ZoomOut />
            </IconButton>
          </Tooltip>
          <Tooltip content="Reset view">
            <IconButton aria-label="Reset" onClick={() => emit("reset")} variant="ghost" size="sm">
              <RefreshCcw />
            </IconButton>
          </Tooltip>
        </HStack>
      </Card.Body>
    </Card.Root>
  )
}
