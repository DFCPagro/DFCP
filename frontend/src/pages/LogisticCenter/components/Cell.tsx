import { Box, HStack, VStack, Text } from "@chakra-ui/react"
import type { ShelfDTO } from "@/types/logisticCenter"
import { useUIStore } from "@/store/useUIStore"
import { Tooltip } from "@/components/ui/tooltip"

function pct(a: number, b: number) {
  if (b <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((a / b) * 100)))
}

/**
 * Visual policy for slots (subtle, game-like, low-noise):
 * - FREE (no containerOpsId): green (available)
 * - OCCUPIED with remaining capacity <= 10%: red (critical / "under X kg")
 * - OCCUPIED with remaining capacity <= 30%: yellow (warning / getting full)
 * - Otherwise: teal/green (healthy)
 *
 * We tint each slot background with a low-alpha color and color the slot border.
 * This avoids rainbow noise while still conveying state at-a-glance.
 */
// const CRIT_REMAINING = 0.10
// const WARN_REMAINING = 0.30

const CRIT_REMAINING = 0.10
const WARN_REMAINING = 0.30

function slotColor(remainFrac: number, isFree: boolean) {
  if (isFree) return { bg: "rgba(34,197,94,0.28)", border: "lime.500" } // free -> green
  if (remainFrac <= CRIT_REMAINING) return { bg: "rgba(239,68,68,0.32)", border: "red.500" } // critical
  if (remainFrac <= WARN_REMAINING) return { bg: "rgba(234,179,8,0.32)", border: "yellow.500" } // warning
  return { bg: "rgba(45,212,191,0.26)", border: "teal.400" } // healthy occupied
}

export default function Cell({
  code,
  shelf,
  size,
  hideWhenNull = false,
}: {
  code: string
  shelf: ShelfDTO | null
  size: { w: number; h: number }
  hideWhenNull?: boolean
}) {
  // selection is DISABLED by request; we only open detail on click
  const openDetail = useUIStore((s) => s.openDetail)

  if (!shelf && hideWhenNull) {
    return (
      <Box
        w={`${size.w}px`}
        h={`${size.h}px`}
        minW={`${size.w}px`}
        minH={`${size.h}px`}
        maxW={`${size.w}px`}
        maxH={`${size.h}px`}
        flexShrink={0}
        visibility="hidden"
      />
    )
  }

  const occupied = shelf ? shelf.occupiedSlots : 0
  const maxSlots = shelf ? shelf.maxSlots : 3
  const capacityPct = shelf ? pct(shelf.currentWeightKg, shelf.maxWeightKg) : 0
  const busy = shelf ? shelf.busyScore : 0
  const avoid = shelf ? shelf.isTemporarilyAvoid : false

  const hint = shelf
    ? `${shelf.shelfId}
${occupied}/${maxSlots} slots • ${capacityPct}% load
busy ${busy}/100 • tasks ${shelf.liveActiveTasks}`
    : "Empty location"

  const glow =
    busy >= 80
      ? "inset 0 0 0 2px rgba(255, 59, 59, .6)"
      : busy >= 50
      ? "inset 0 0 0 2px rgba(163, 230, 53, .55)"
      : undefined

  const handleClick = () => {
    if (!shelf) return
    openDetail(shelf)
  }

  // Determine how many visual slots to render (up to 3)
  const visibleSlots = Math.min(maxSlots, 3)

  return (
    <Tooltip content={hint}>
      <Box
        role="button"
        aria-label={shelf ? `Shelf ${shelf.shelfId}` : `Location ${code}`}
        tabIndex={0}
        borderRadius="12px"
        borderWidth="1px"
        borderColor="gameCellBorder"
        bg="gameCellBg"
        display="grid"
        placeItems="center"
        cursor={shelf ? "pointer" : "default"}
        outline="none"
        onClick={handleClick}
        _hover={{ boxShadow: shelf ? "inset 0 0 0 2px var(--colors-lime-500)" : undefined }}
        css={glow ? { boxShadow: glow } : undefined}
        position="relative"
        w={`${size.w}px`}
        h={`${size.h}px`}
        minW={`${size.w}px`}
        minH={`${size.h}px`}
        maxW={`${size.w}px`}
        maxH={`${size.h}px`}
        flexShrink={0}
        boxSizing="border-box"
      >
        {/* Crowded ribbon */}
        {shelf && busy >= 80 && (
          <Box
            position="absolute"
            top="0"
            left="0"
            w="0"
            h="0"
            borderTop="10px solid #ef4444"
            borderRight="10px solid transparent"
            borderTopLeftRadius="12px"
            title="Crowded"
          />
        )}

        {/* Status dots */}
        {shelf && (
  <Box
    position="absolute"
    top="4px"
    left="4px"
    w="8px"
    h="8px"
    borderRadius="full"
    bg={
      busy >= 80
        ? "red.500" // critical
        : avoid
        ? "yellow.400" // avoid
        : busy >= 50
        ? "lime.500" // moderate
        : "brand.600" // normal
    }
    title={
      busy >= 80
        ? `Critical: Busy ${busy}/100`
        : avoid
        ? "Avoid"
        : `Busy: ${busy}`
    }
  />
)}


        {/* Mini shelf (centered) */}
        <HStack
          w="72%"
          h="48%"
          mx="auto"
          border="2px solid"
          borderColor="gameShelfFrame"
          borderBottomWidth="3px"
          borderRadius="6px"
          gap="4px"
          px="4px"
          align="end"
          justify="space-between"
        >
          {Array.from({ length: visibleSlots }).map((_, i) => {
            // pull real slot data when available
            const s = shelf?.slots?.[i]
            const isFree = !s || !s.containerOpsId
            const capacity = s?.capacityKg ?? (shelf ? shelf.maxWeightKg / Math.max(1, shelf.maxSlots) : 1)
            const current = s?.currentWeightKg ?? 0
            const remaining = Math.max(0, capacity - current)
            const remainFrac = Math.max(0, Math.min(1, remaining / capacity))
            const colors = slotColor(remainFrac, isFree)

            // Subtle bar at top as a state "cap", plus tint background
            return (
              <VStack
                key={i}
                flex="1"
                minW={0}
                h="42%"
                border="2px solid"
                borderColor={colors.border}
                borderRadius="5px"
                position="relative"
                bg={colors.bg}
                _before={{
                  content: '""',
                  position: "absolute",
                  top: "2px",
                  left: "3px",
                  right: "3px",
                  height: "5px",
                  borderRadius: "3px",
                  backgroundColor: colors.border,
                  opacity: 0.9,
                }}
              />
            )
          })}
        </HStack>

        {/* code */}
        <Text
          position="absolute"
          bottom="2px"
          right="6px"
          fontFamily='ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
          fontSize="11px"
          fontWeight="700"
          lineHeight="1.1"
          color="gameCode"
          opacity=".95"
        >
          {shelf ? shelf.shelfId : code}
        </Text>
      </Box>
    </Tooltip>
  )
}
