import { Box, HStack, VStack, Text } from "@chakra-ui/react"
import { useSelectionStore } from "@/store/useSelectionStore"
import type { ShelfDTO } from "@/types/logisticCenter"
import { useUIStore } from "@/store/useUIStore"
import { Tooltip } from "@/components/ui/tooltip"

function pct(a: number, b: number) {
  if (b <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((a / b) * 100)))
}

export default function Cell({
  code,
  shelf,
  size,
  hideWhenNull = false, // NEW: hide cells with no shelf (filtered out)
}: {
  code: string
  shelf: ShelfDTO | null
  size: { w: number; h: number }
  hideWhenNull?: boolean
}) {
  // If this cell was filtered out and we want to hide, render a spacer that preserves grid size
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
        visibility="hidden" // keeps layout, hides visuals
      />
    )
  }

  const toggle = useSelectionStore((s) => s.toggle)
  const isSelected = useSelectionStore((s) => s.isSelected(code))
  const openDetail = useUIStore((s) => s.openDetail)

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
    toggle(code)
    openDetail(shelf)
  }

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
        css={isSelected ? { boxShadow: "inset 0 0 0 2px var(--colors-brand-500)" } : glow ? { boxShadow: glow } : undefined}
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
          <>
            <Box
              position="absolute"
              top="4px"
              left="4px"
              w="8px"
              h="8px"
              borderRadius="full"
              bg={busy >= 80 ? "red.500" : busy >= 50 ? "lime.500" : "brand.600"}
              title={`Busy: ${busy}`}
            />
            {avoid && (
              <Box position="absolute" top="4px" right="4px" w="8px" h="8px" borderRadius="full" bg="yellow.400" title="Avoid" />
            )}
          </>
        )}

        {/* mini shelf */}
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
            const filled = i < Math.min(occupied, visibleSlots)
            const alpha = 0.25 + (capacityPct / 100) * 0.45
            return (
              <VStack
                key={i}
                flex="1"
                minW={0}
                h="42%"
                border="2px solid"
                borderColor="gameShelfSlot"
                borderRadius="3px"
                bg={filled ? `rgba(16,185,129,${alpha.toFixed(2)})` : "transparent"}
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
