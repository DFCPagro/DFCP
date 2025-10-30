import { memo, useMemo } from "react";
import { Box, IconButton, Tooltip } from "@chakra-ui/react";
import { FiShoppingCart } from "react-icons/fi";

/**
 * Floating Cart button.
 * Notes:
 * - All pricing/availability logic lives elsewhere.
 * - `unitMode` ("unit" | "kg") is used only for labels/tooltips.
 */
export type CartFABProps = {
  onClick: () => void;
  count?: number;
  ariaLabel?: string;
  left?: string | number;
  right?: string | number;                      // NEW: support right positioning
  bottom?: string | number;
  zIndex?: number;
  disabled?: boolean;
  tooltip?: string;
  unitMode?: "unit" | "kg";
  hideWhenZero?: boolean;                       // NEW: hide badge when count = 0
};

function CartFABBase({
  onClick,
  count,
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
  // Auto RTL placement when neither left nor right provided
  const { finalLeft, finalRight } = useMemo(() => {
    if (left != null || right != null) return { finalLeft: left, finalRight: right };
    const isRTL =
      typeof document !== "undefined" &&
      (document.documentElement.dir === "rtl" ||
        document.body?.dir === "rtl");
    return isRTL ? { finalLeft: undefined, finalRight: 16 } : { finalLeft: 16, finalRight: undefined };
  }, [left, right]);

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
    ariaLabel ?? (unitMode ? `Open cart, ${unitMode} mode` : "Open cart");

  const ariaDesc =
    typeof count === "number"
      ? `${count} item${count === 1 ? "" : "s"} in cart`
      : undefined;

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
            data-count={count ?? 0}
          >
            <FiShoppingCart />
          </IconButton>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>{computedTooltip}</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      {(!hideWhenZero || (badgeText && Number(count) > 0)) ? (
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
          // SR-friendly badge
          aria-live="polite"
          aria-atomic="true"
          title={`${badgeText ?? 0} items in cart`}
        >
          {badgeText ?? 0}
        </Box>
      ) : null}
    </Box>
  );
}

export const CartFAB = memo(CartFABBase);
