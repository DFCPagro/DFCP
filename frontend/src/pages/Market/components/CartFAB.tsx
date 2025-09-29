import { memo } from "react"
import { Box, IconButton, Tooltip } from "@chakra-ui/react"
import { FiShoppingCart } from "react-icons/fi"

export type CartFABProps = {
  /** Open the Cart Drawer */
  onClick: () => void

  /** Number of items in cart (badge is hidden when 0 or undefined) */
  count?: number

  /** Accessible label (default: "Open cart") */
  ariaLabel?: string

  /** Positioning (default: 16px from left, 24px + safe-area from bottom) */
  left?: string | number
  bottom?: string | number

  /** z-index (default: 40, below PinButton’s default 50) */
  zIndex?: number

  /** Disable interactions (default: false) */
  disabled?: boolean

  /** Tooltip text (default: "Cart") */
  tooltip?: string
}

function CartFABBase({
  onClick,
  count,
  ariaLabel = "Open cart",
  left = 16,
  bottom = "calc(24px + env(safe-area-inset-bottom))",
  zIndex = 40,
  disabled = false,
  tooltip = "Cart",
}: CartFABProps) {
  // clamp badge text
  const badgeText =
    typeof count === "number" && count > 0 ? (count > 99 ? "99+" : String(count)) : null

  return (
    <Box position="fixed" left={left} bottom={bottom} zIndex={zIndex}>
      <Tooltip.Root openDelay={300}>
        <Tooltip.Trigger asChild>
          <IconButton
            aria-label={ariaLabel}
            size="lg"
            borderRadius="full"
            colorPalette="teal"
            variant="solid"
            onClick={onClick}
            disabled={disabled}
            boxShadow="lg"
          >
            <FiShoppingCart />
          </IconButton>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>{tooltip}</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      {/* Item count badge */}
      {badgeText ? (
        <Box
          position="absolute"
          top="-6px"
          right="-6px"
          minW="18px"
          h="18px"
          px="1"
          borderRadius="full"
          bg="red.500"
          color="white"
          fontSize="xs"
          fontWeight="bold"
          display="flex"
          alignItems="center"
          justifyContent="center"
          border="2px solid"
          borderColor="bg.canvas"
          pointerEvents="none"
        >
          {badgeText}
        </Box>
      ) : null}
    </Box>
  )
}

export const CartFAB = memo(CartFABBase)
