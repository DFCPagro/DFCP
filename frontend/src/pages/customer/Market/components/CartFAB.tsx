import { memo, useMemo } from "react"
import { Box, IconButton, Tooltip } from "@chakra-ui/react"
import { FiShoppingCart } from "react-icons/fi"

/**
 * Floating Cart button.
 * Notes:
 * - All pricing/availability logic lives elsewhere.
 * - Badge shows number of different items (rows) regardless of unit mode.
 */
export type CartFABProps = {
  onClick: () => void
  /** Deprecated: total quantity. Ignored if `uniqueCount` is provided. */
  count?: number
  /** Number of different items (rows) in cart. Used for the badge in all modes. */
  uniqueCount?: number
  ariaLabel?: string
  left?: string | number
  right?: string | number
  bottom?: string | number
  zIndex?: number
  disabled?: boolean
  tooltip?: string
  /** Only affects copy in aria/tooltip, not the count logic. */
  unitMode?: "unit" | "kg"
  /** Hide badge when zero. */
  hideWhenZero?: boolean
}

function CartFABBase({
  onClick,
  count,
  uniqueCount,
  ariaLabel,
  left,
  right,
  bottom = "calc(24px + env(safe-area-inset-bottom))",
  zIndex = 40,
  disabled = false,
  tooltip,
  unitMode,
  hideWhenZero = true,
}: CartFABProps) {
  // Always display number of different items (rows).
  const distinctItems = typeof uniqueCount === "number" ? uniqueCount : count ?? 0

  // Auto RTL placement when neither left nor right provided
  const { finalLeft, finalRight } = useMemo(() => {
    if (left != null || right != null) return { finalLeft: left, finalRight: right }
    const isRTL =
      typeof document !== "undefined" &&
      (document.documentElement.dir === "rtl" || document.body?.dir === "rtl")
    return isRTL ? { finalLeft: undefined, finalRight: 16 } : { finalLeft: 16, finalRight: undefined }
  }, [left, right])

  const badgeText = distinctItems > 0 ? (distinctItems > 99 ? "99+" : String(distinctItems)) : null

  // Keep mode mention if helpful, but the count refers to different items.
  const computedTooltip =
    tooltip ??
    (unitMode === "kg"
      ? "Cart (kg mode) • different items"
      : unitMode === "unit"
      ? "Cart (unit mode) • different items"
      : "Cart • different items")

  const computedAria = ariaLabel ?? "Open cart"

  // Announce distinct items (rows) for screen readers.
  const ariaDesc =
    typeof distinctItems === "number"
      ? `${distinctItems} different item${distinctItems === 1 ? "" : "s"} in cart`
      : undefined

  return (
    <Box position="fixed" left={finalLeft} right={finalRight} bottom={bottom} zIndex={zIndex}>
      <Tooltip.Root openDelay={300}>
        <Tooltip.Trigger asChild>
          <IconButton
            aria-label={computedAria}
            aria-description={ariaDesc}
            size="lg"
            borderRadius="full"
            colorPalette="teal"
            variant="solid"
            onClick={onClick}
            disabled={disabled}
            boxShadow="lg"
            data-count={distinctItems}
            data-count-type="distinct-items"
          >
            <FiShoppingCart />
          </IconButton>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>{computedTooltip}</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      {!hideWhenZero || (badgeText && distinctItems > 0) ? (
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
          aria-live="polite"
          aria-atomic="true"
          title={`${badgeText ?? 0} different items in cart`}
        >
          {badgeText ?? 0}
        </Box>
      ) : null}
    </Box>
  )
}

export const CartFAB = memo(CartFABBase)
