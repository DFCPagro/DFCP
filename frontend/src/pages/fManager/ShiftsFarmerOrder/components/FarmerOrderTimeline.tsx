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
import { FARMER_ORDER_STAGE_KEYS, type FarmerOrderStageKey } from "@/types/farmerOrders";

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

    /** Compact layout (slightly tighter spacing) */
    compact?: boolean;
};

/**
 * Renders the 8-stage Farmer Order timeline, using BE order + labels.
 * Shows per-step state (done/current/upcoming) and a right-aligned "Next stage" button.
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

    const canAdvance = !!onNextStage && !!nextKey && !disableAdvance;

    return (
        <HStack
            align="center"
            justify="space-between"
            gap={4}
            py={compact ? 1 : 2}
        >
            {/* Timeline rail */}
            <HStack flex="1 1 auto" minW={0} overflowX="auto" gap={compact ? 2 : 3}>
                {FARMER_ORDER_STAGE_KEYS.map((key, idx) => {
                    const s = normalized[idx]; // normalized aligns to order
                    const state = stepState(currentKey, key);
                    const label = labelFor(key, normalized);

                    const isDone = state === "done";
                    const isCurrent = state === "current";
                    const isUpcoming = state === "upcoming";

                    const circleBg =
                        isDone ? "teal.500" : isCurrent ? "blue.500" : "fg.subtle";
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
                                            {s?.startedAt && (
                                                <Text fontSize="xs">Started: {s.startedAt}</Text>
                                            )}
                                            {s?.completedAt && (
                                                <Text fontSize="xs">Completed: {s.completedAt}</Text>
                                            )}
                                            {!s?.startedAt && !s?.completedAt && s?.timestamp && (
                                                <Text fontSize="xs">Timestamp: {s.timestamp}</Text>
                                            )}
                                        </Stack>
                                        <Tooltip.Arrow />
                                    </Tooltip.Content>
                                </Tooltip.Positioner>
                            </Tooltip.Root>

                            {/* Connector to next step (skip after last) */}
                            {idx < FARMER_ORDER_STAGE_KEYS.length - 1 && (
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

            {/* Advance button on the far right */}
            <Box flex="0 0 auto">
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
                                aria-label={nextKey ? `Advance to ${labelFor(nextKey, normalized)}` : "Advance stage"}
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
                            {nextKey ? "You cannot advance this order right now." : "Already at final stage"}
                            <Tooltip.Arrow />
                        </Tooltip.Content>
                    </Tooltip.Positioner>
                </Tooltip.Root>
            </Box>

        </HStack>
    );
});
