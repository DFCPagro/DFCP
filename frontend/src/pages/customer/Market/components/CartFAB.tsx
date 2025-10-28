import { memo } from "react";
import { Box, IconButton, Tooltip } from "@chakra-ui/react";
import { FiShoppingCart } from "react-icons/fi";

/**
 * Floating Cart button.
 * Notes:
 * - It does NOT read prices or availability. That logic lives in item/card pages.
 * - You can pass `unitMode` to auto-annotate tooltip/aria with "kg" or "unit" mode.
 */
export type CartFABProps = {
  onClick: () => void;
  count?: number;
  ariaLabel?: string;
  left?: string | number;
  bottom?: string | number;
  zIndex?: number;
  disabled?: boolean;
  tooltip?: string;
  /** Optional: "unit" | "kg" to reflect current market mode in labels when tooltip not provided */
  unitMode?: "unit" | "kg";
};

function CartFABBase({
  onClick,
  count,
  ariaLabel,
  left = 16,
  bottom = "calc(24px + env(safe-area-inset-bottom))",
  zIndex = 40,
  disabled = false,
  tooltip,
  unitMode,
}: CartFABProps) {
  const badgeText =
    typeof count === "number" && count > 0 ? (count > 99 ? "99+" : String(count)) : null;

  const computedTooltip =
    tooltip ??
    (unitMode === "kg"
      ? "Cart (kg mode)"
      : unitMode === "unit"
      ? "Cart (unit mode)"
      : "Cart");

  const computedAria =
    ariaLabel ??
    (unitMode ? `Open cart, ${unitMode} mode` : "Open cart");

  return (
    <Box position="fixed" left={left} bottom={bottom} zIndex={zIndex}>
      <Tooltip.Root openDelay={300}>
        <Tooltip.Trigger asChild>
          <IconButton
            aria-label={computedAria}
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
          <Tooltip.Content>{computedTooltip}</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

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
          aria-live="polite"
          title={`${badgeText} items in cart`}
        >
          {badgeText}
        </Box>
      ) : null}
    </Box>
  );
}

export const CartFAB = memo(CartFABBase);
