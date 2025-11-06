// FILE: src/components/common/LogisticMap/zone/Cell.tsx
import { Box, HStack, VStack, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import type { ShelfDTO } from "@/types/logisticCenter";
import { useUIStore } from "@/store/useUIStore";
import { Tooltip } from "@/components/ui/tooltip";
import type { MapMode } from "@/types/map";

/** Defensive numeric coercion (handles numbers/strings; tolerates old {$numberDecimal} just in case) */
function toNum(x: any, fallback = 0): number {
  if (x == null) return fallback;
  if (typeof x === "object" && "$numberDecimal" in x) {
    const n = Number((x as any).$numberDecimal);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}
function toInt(x: any, fallback = 0): number {
  const n = toNum(x, fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function pct(a: number, b: number) {
  if (b <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((a / b) * 100)));
}

/** New thresholds are based on FILL (current/capacity), not remaining */
const CRIT_FILL = 0.1; // ≤10% full → red (near empty)
const WARN_FILL = 0.3; // ≤30% full → yellow (low)

/** Slot color logic (free, near-empty, low, healthy/full) */
function slotColor(fillFrac: number, isFree: boolean) {
  if (isFree) return { bg: "rgba(34,197,94,0.28)", border: "lime.500" }; // 🟩 free
  if (fillFrac <= CRIT_FILL) return { bg: "rgba(239,68,68,0.32)", border: "red.500" }; // 🟥 near empty
  if (fillFrac <= WARN_FILL) return { bg: "rgba(234,179,8,0.32)", border: "yellow.500" }; // 🟨 low
  return { bg: "rgba(45,212,191,0.26)", border: "teal.400" }; // 🟦 healthy/full
}

/** Animations for target/highlight effect */
const pulse = keyframes`
  0% { opacity: .25; transform: scale(1); }
  50% { opacity: .55; transform: scale(1.04); }
  100% { opacity: .25; transform: scale(1); }
`;
const sweep = keyframes`
  0% { transform: translateX(-110%); }
  100% { transform: translateX(110%); }
`;

export default function Cell({
  code,
  shelf,
  size,
  hideWhenNull = false,
  variant = "manager",
  highlight = false,
}: {
  code: string;
  shelf: ShelfDTO | null;
  size: { w: number; h: number };
  hideWhenNull?: boolean;
  variant?: MapMode;
  highlight?: boolean;
}) {
  const openDetail = useUIStore((s) => s.openDetail);

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
    );
  }

  // ---- Derived, normalized values (primitives only) ----
  const occupied   = shelf ? toInt(shelf.occupiedSlots, 0) : 0;
  const maxSlots   = shelf ? toInt(shelf.maxSlots, 3) : 3;
  const currentKg  = shelf ? toNum(shelf.currentWeightKg, 0) : 0;
  const capacityKg = shelf ? toNum(shelf.maxWeightKg, 0) : 0;
  const capacityPct = capacityKg > 0 ? pct(currentKg, capacityKg) : 0;
  const busy       = shelf ? toInt(shelf.busyScore, 0) : 0;
  const liveTasks  = shelf ? toInt(shelf.liveActiveTasks, 0) : 0;
  const avoid      = !!(shelf && (shelf as any).isTemporarilyAvoid);

  // ---- Tooltip text ----
  const hint =
    variant === "picker"
      ? shelf
        ? `${shelf.shelfId}\nTap to open details`
        : "Empty location"
      : shelf
        ? `${shelf.shelfId}
${occupied}/${maxSlots} slots • ${capacityPct}% filled
busy ${busy}/100 • tasks ${liveTasks}`
        : "Empty location";

  // ---- Glows / styles ----
  const glowManager =
    busy >= 80
      ? "inset 0 0 0 2px rgba(255, 59, 59, .6)"
      : busy >= 50
        ? "inset 0 0 0 2px rgba(163, 230, 53, .55)"
        : undefined;
  const glow = variant === "manager" && !highlight ? glowManager : undefined;

  const handleClick = () => {
    if (!shelf) return;
    openDetail(shelf);
  };

  const visibleSlots = Math.min(maxSlots, 3);

  // Picker mode simplifications
  const showStatusDots = variant === "manager";
  const showCrowdedRibbon = variant === "manager" && busy >= 80;

  // Targeted styles (activated by highlight)
  const isTarget = !!highlight;
  const shelfFrameColor = isTarget ? "brand.500" : "gameShelfFrame";
  const shelfOutline = isTarget ? "inset 0 0 0 2px token(colors.brand.500)" : glow;

  return (
    <Tooltip content={hint}>
      <Box
        role="button"
        aria-label={shelf ? `Shelf ${shelf.shelfId}` : `Location ${code}`}
        aria-selected={isTarget ? true : undefined}
        tabIndex={0}
        data-target={isTarget ? "true" : undefined}
        borderRadius="12px"
        borderWidth="1px"
        borderColor="gameCellBorder"
        bg="gameCellBg"
        display="grid"
        placeItems="center"
        cursor={shelf ? "pointer" : "default"}
        outline="none"
        onClick={handleClick}
        _hover={{
          boxShadow: shelf ? "inset 0 0 0 2px token(colors.lime.500)" : undefined,
        }}
        css={shelfOutline ? { boxShadow: shelfOutline } : undefined}
        position="relative"
        w={`${size.w}px`}
        h={`${size.h}px`}
        minW={`${size.w}px`}
        minH={`${size.h}px`}
        maxW={`${size.w}px`}
        maxH={`${size.h}px`}
        flexShrink={0}
        boxSizing="border-box"
        transition="transform 160ms cubic-bezier(.2,.7,.2,1), filter 160ms ease"
        transform={isTarget ? "translateZ(0) scale(1.03)" : undefined}
        filter={isTarget ? "brightness(1.05) saturate(1.05)" : undefined}
        // GLOW RING
        _after={
          isTarget
            ? {
                content: '""',
                position: "absolute",
                inset: "-6px",
                borderRadius: "14px",
                boxShadow:
                  "0 0 0 3px token(colors.brand.500), 0 0 18px 6px rgba(59,130,246,.35)",
                opacity: 0.25,
                animation: `${pulse} 1200ms ease-in-out infinite`,
                pointerEvents: "none",
              }
            : undefined
        }
        // SCANLINE SWEEP
        _before={
          isTarget
            ? {
                content: '""',
                position: "absolute",
                top: "10%",
                bottom: "10%",
                left: "-20%",
                width: "40%",
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.18) 50%, rgba(255,255,255,0) 100%)",
                filter: "blur(1px)",
                borderRadius: "10px",
                animation: `${sweep} 1400ms linear infinite`,
                pointerEvents: "none",
                mixBlendMode: "overlay",
              }
            : undefined
        }
      >
        {/* Target chip */}
        {shelf && isTarget && (
          <Box
            position="absolute"
            top="4px"
            right="6px"
            px="6px"
            py="1px"
            borderRadius="full"
            fontSize="10px"
            fontWeight="800"
            letterSpacing="0.04em"
            bg="token(colors.brand.600)"
            color="white"
            boxShadow="0 1px 4px rgba(0,0,0,.25)"
          >
            TARGET
          </Box>
        )}

        {/* Crowded ribbon (manager only) */}
        {shelf && showCrowdedRibbon && (
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

        {/* Status dot (manager only; hide when targeted to reduce noise) */}
        {shelf && showStatusDots && !isTarget && (
          <Box
            position="absolute"
            top="4px"
            left="4px"
            w="10px"
            h="10px"
            borderRadius="full"
            border="2px solid"
            borderColor={avoid ? "yellow.400" : "transparent"}
            bg={
              avoid
                ? busy >= 80
                  ? "orange.500" // avoid + crowded
                  : busy >= 50
                    ? "yellow.500" // avoid + active
                    : "yellow.300" // avoid but calm
                : busy >= 80
                  ? "red.500" // crowded
                  : busy >= 50
                    ? "lime.500" // moderately busy
                    : "brand.600" // normal
            }
            title={`Busy: ${busy}${avoid ? " • Avoid" : ""}`}
          />
        )}

        {/* Mini shelf with up to 3 visual slots */}
        <HStack
          w="72%"
          h="48%"
          mx="auto"
          border="2px solid"
          borderColor={shelfFrameColor}
          borderBottomWidth="3px"
          borderRadius="6px"
          gap="4px"
          px="4px"
          align="center"
          justify="space-between"
          bg={
            isTarget
              ? "linear-gradient(180deg, rgba(59,130,246,.10), rgba(59,130,246,0))"
              : undefined
          }
        >
          {Array.from({ length: visibleSlots }).map((_, i) => {
            const s = shelf?.slots?.[i];
            const isFree = !s || !s.containerOpsId;

            // Normalize slot capacity/current (fallback: share of shelf capacity)
            const slotCap =
              s?.capacityKg != null
                ? toNum(s.capacityKg, 0)
                : shelf
                  ? toNum(shelf.maxWeightKg, 0) / Math.max(1, toInt(shelf.maxSlots, 1))
                  : 0;

            const slotCur = s?.currentWeightKg != null ? toNum(s.currentWeightKg, 0) : 0;

            // FILL = current / capacity (guard divide-by-zero)
            const fillFrac = Math.max(0, Math.min(1, slotCap > 0 ? slotCur / slotCap : 0));

            // In picker mode: reduce color noise unless cell is highlighted
            const colors =
              variant === "picker" && !isTarget
                ? { bg: "rgba(255,255,255,0.08)", border: "gameShelfSlot" }
                : slotColor(fillFrac, isFree);

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
            );
          })}
        </HStack>

        {/* code */}
        <Text
          position="absolute"
          bottom="4px"
          left="50%"
          transform="translateX(-50%)"
          fontFamily='ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
          fontSize={isTarget ? "12px" : "11px"}
          fontWeight="800"
          lineHeight="1.1"
          color={isTarget ? "brand.300" : "gameCode"}
          opacity=".95"
          textShadow={isTarget ? "0 0 6px rgba(59,130,246,.55)" : undefined}
          whiteSpace="nowrap"
        >
          {shelf ? shelf.shelfId : code}
        </Text>
      </Box>
    </Tooltip>
  );
}
