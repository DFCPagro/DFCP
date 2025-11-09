import { memo } from "react"
import { Box, IconButton, Tooltip } from "@chakra-ui/react"
import { FiMapPin } from "react-icons/fi"

export type PinButtonProps = {
  /** Open the Address/Shift drawer */
  onClick: () => void

  /** If true, shows a small green badge to indicate selection is active */
  active?: boolean

  /** Accessible label (default: "Address & shift") */
  ariaLabel?: string

  /** Distance from left edge (default: 16px) */
  left?: string | number

  /**
   * Distance from bottom edge (default: "calc(96px + env(safe-area-inset-bottom))")
   * Keep this ABOVE the Cart FAB; adjust if your Cart FAB bottom is different.
   */
  bottom?: string | number

  /** Tooltip text (default: "Address & shift") */
  tooltip?: string

  /** z-index (default: 50) */
  zIndex?: number
}

/**
 * Floating action button for opening the Address/Shift drawer.
 * Meant to sit above the Cart FAB on bottom-left.
 */
function PinButtonBase({
  onClick,
  active = false,
  ariaLabel = "Address & shift",
  left = 16,
  bottom = "calc(96px + env(safe-area-inset-bottom))",
  tooltip = "Address & shift",
  zIndex = 50,
}: PinButtonProps) {
  return (
    <Box position="fixed" left={left} bottom={bottom} zIndex={zIndex}>
      <Tooltip.Root openDelay={300}>
        <Tooltip.Trigger asChild>
          <IconButton
            aria-label={ariaLabel}
            size="lg"
            rounded="full"
            colorPalette="teal"
            variant="solid"
            onClick={onClick}
          >
            <FiMapPin />
          </IconButton>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>{tooltip} </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      {/* Active indicator badge (top-right of button) */}
      {active ? (
        <Box
          position="absolute"
          top="-2px"
          right="-2px"
          w="10px"
          h="10px"
          rounded="full"
          bg="green.500"
          border="2px solid"
          borderColor="bg.canvas"
        />
      ) : null}
    </Box>
  )
}

export const PinButton = memo(PinButtonBase)
