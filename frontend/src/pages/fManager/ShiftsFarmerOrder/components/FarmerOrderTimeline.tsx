import { memo, useMemo } from "react";
import {
    Box,
    HStack,
    Stack,
    Text,
    Button,
    Tooltip,
    Icon,
} from "@chakra-ui/react";
import { FiArrowRight } from "react-icons/fi";
import {
    prepareTimelineModel,
    stepState,
    labelFor,
    type RawStage,
} from "./farmerTimeline.helpers";
import {
    FARMER_ORDER_STAGE_KEYS,
    type FarmerOrderStageKey,
} from "@/types/farmerOrders";

export type FarmerOrderTimelineProps = {
    /** Array of stage objects from the BE payload (can be loose/unknown-shaped) */
    stages?: RawStage[] | null;
    /** Optional BE fallback current stage key (e.g., record.stageKey) */
    stageKey?: string | null;

    /** Called when the user clicks "Next stage". Parent decides what key to send to API. */
    onNextStage?: (nextKey: FarmerOrderStageKey) => void;
    /** Loading state while advancing stage */
    isAdvancing?: boolean;
    /** Force-disable the advance action (e.g., terminal/problem) */
    disableAdvance?: boolean;

    /**
     * NEW meaning:
     * - compact=false  => show ALL stages (old normal mode)
     * - compact=true   => show ONLY [prev | current | next] (new shortened mode)
     */
    compact?: boolean;
};

/** pick [prev, current, next] with sane edges (dedup + bounds) */
function computeWindowedKeys(
    all: ReadonlyArray<FarmerOrderStageKey>,   // <-- accept readonly
    currentKey: FarmerOrderStageKey | null
): FarmerOrderStageKey[] {
    const arr = Array.from(all);               // <-- mutable copy
    const n = arr.length;

    if (!currentKey) {
        return arr.slice(0, Math.min(3, n));
    }

    const i = arr.indexOf(currentKey);
    if (i < 0) return arr.slice(0, Math.min(3, n));

    if (i === 0) {
        const k1 = arr[0];
        const k2 = arr[1] ?? arr[0];
        const k3 = arr[2] ?? arr[1] ?? arr[0];
        return Array.from(new Set([k1, k2, k3]));
    }

    if (i === n - 1) {
        const k3 = arr[n - 1];
        const k2 = arr[n - 2] ?? k3;
        const k1 = arr[n - 3] ?? k2 ?? k3;
        return Array.from(new Set([k1, k2, k3]));
    }

    return [arr[i - 1], arr[i], arr[i + 1]];
}


/**
 * Renders the Farmer Order timeline.
 * - compact=false => full rail (all stages)  ✅ (old behavior)
 * - compact=true  => 3 steps only: prev | current | next ✅
 */
export const FarmerOrderTimeline = memo(function FarmerOrderTimeline({
    stages,
    stageKey,
    onNextStage,
    isAdvancing = false,
    disableAdvance = false,
    compact = false,
}: FarmerOrderTimelineProps) {
    const { normalized, currentKey, nextKey } = useMemo(
        () => prepareTimelineModel({ stages, stageKey }),
        [stages, stageKey]
    );

    // Decide which keys we render:
    const keysToRender = useMemo<FarmerOrderStageKey[]>(
        () =>
            compact
                ? computeWindowedKeys(FARMER_ORDER_STAGE_KEYS, currentKey)
                : Array.from(FARMER_ORDER_STAGE_KEYS),          // <-- clone the readonly const
        [compact, currentKey]
    );


    const canAdvance = !!onNextStage && !!nextKey && !disableAdvance;

    return (
        <HStack align="center" justify="space-between" gap={4} py={compact ? 1 : 2}>
            {/* Timeline rail */}
            <HStack flex="1 1 auto" minW={0} overflowX="auto" gap={compact ? 2 : 3}>
                {keysToRender.map((key, renderIdx) => {
                    const idx = FARMER_ORDER_STAGE_KEYS.indexOf(key); // normalized aligns to constants
                    const s = normalized[idx];
                    const state = stepState(currentKey, key);
                    const label = labelFor(key, normalized);

                    const isDone = state === "done";
                    const isCurrent = state === "current";
                    const isUpcoming = state === "upcoming";

                    const circleBg = isDone ? "teal.500" : isCurrent ? "blue.500" : "fg.subtle";
                    const circleColor = isUpcoming ? "fg" : "whiteAlpha.900";
                    const railColor = isDone ? "teal.400" : isCurrent ? "blue.400" : "border.subtle";

                    const hasTimestamps = !!(s?.startedAt || s?.completedAt || s?.timestamp);

                    return (
                        <HStack key={key} minW="fit-content" gap={compact ? 2 : 3}>
                            {/* Step circle + label (with timestamps tooltip if present) */}
                            <Tooltip.Root openDelay={200} disabled={!hasTimestamps}>
                                <Tooltip.Trigger>
                                    <Stack gap={1} minW="fit-content" align="center">
                                        <Box
                                            as="span"
                                            w={compact ? 3 : 4}
                                            h={compact ? 3 : 4}
                                            borderRadius="full"
                                            bg={circleBg}
                                            color={circleColor}
                                            borderWidth={isCurrent ? "16px" : 0}
                                            borderColor={isCurrent ? "blue.400" : "transparent"}
                                        />
                                        <Text
                                            fontSize={compact ? "xs" : "sm"}
                                            color={isCurrent ? "fg" : isDone ? "fg.muted" : "fg.subtle"}
                                            whiteSpace="nowrap"
                                            textAlign="center"
                                        >
                                            {label}
                                        </Text>
                                    </Stack>
                                </Tooltip.Trigger>
                                <Tooltip.Positioner>
                                    <Tooltip.Content>
                                        <Stack gap={1}>
                                            <Text fontWeight="semibold" fontSize="sm">
                                                {label}
                                            </Text>
                                            {s?.startedAt && <Text fontSize="xs">Started: {s.startedAt}</Text>}
                                            {s?.completedAt && <Text fontSize="xs">Completed: {s.completedAt}</Text>}
                                            {!s?.startedAt && !s?.completedAt && s?.timestamp && (
                                                <Text fontSize="xs">Timestamp: {s.timestamp}</Text>
                                            )}
                                        </Stack>
                                        <Tooltip.Arrow />
                                    </Tooltip.Content>
                                </Tooltip.Positioner>
                            </Tooltip.Root>

                            {/* Connector to next rendered step */}
                            {renderIdx < keysToRender.length - 1 && (
                                <Box
                                    flex="1 1 48px"
                                    minW={compact ? "28px" : "48px"}
                                    h="1px"
                                    bg={railColor}
                                />
                            )}
                        </HStack>
                    );
                })}
            </HStack>

            {/* Advance button on the far right (kept same behavior: shows disabled at final) */}
            <Box flex="0 0 auto">
                {nextKey && !disableAdvance && (
                    <Tooltip.Root disabled={canAdvance}>
                        <Tooltip.Trigger asChild>
                            <Box as="span">
                                <Button
                                    size={compact ? "xs" : "sm"}
                                    variant="solid"
                                    colorPalette="blue"
                                    loading={isAdvancing}
                                    disabled={!canAdvance}
                                    aria-disabled={!canAdvance}
                                    aria-label={
                                        nextKey ? `Advance to ${labelFor(nextKey, normalized)}` : "Advance stage"
                                    }
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (canAdvance && nextKey) onNextStage?.(nextKey);
                                    }}
                                >
                                    Next stage
                                    <Icon as={FiArrowRight} ms="2" />
                                </Button>
                            </Box>
                        </Tooltip.Trigger>
                        <Tooltip.Positioner>
                            <Tooltip.Content>
                                You cannot advance this order right now.
                                <Tooltip.Arrow />
                            </Tooltip.Content>
                        </Tooltip.Positioner>
                    </Tooltip.Root>
                )}
            </Box>
        </HStack>
    );
});
