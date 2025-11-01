// src/pages/ShiftFarmerOrder/components/FarmerOrderTimeline.tsx
"use client";

import { HStack, VStack, Box, Text } from "@chakra-ui/react";
import {
    FARMER_FLOW,
    stageIndex,
    stepState,
    shouldMarkRed,
    labelFor,
    type FarmerOrderStage,
} from "./farmerTimeline.helpers";

type Props = {
    /** Current stage of the farmer order row (e.g., "pending" | "assigned" | ...). */
    current: FarmerOrderStage | string;
    /** Visual size (affects circle/chip sizes). */
    size?: "sm" | "md";
};

/**
 * Row-level timeline rail for farmer orders.
 * - Linear flow (no branching)
 * - Red marker on the CURRENT step
 * - If current is a terminal ("problem" | "cancelled"), rail remains as-is and a red terminal chip is shown.
 *
 * Mirrors the look & feel of your OrderTimeline (spacing, chips, connectors)
 * while consuming ShiftFarmerOrder stages.
 */
export default function FarmerOrderTimeline({ current, size = "md" }: Props) {
    const curr = String(current) as FarmerOrderStage;

    // sizes
    const circle = size === "sm" ? 10 : 12; // px
    const activeCircle = size === "sm" ? 12 : 14; // px
    const chipPx = size === "sm" ? 2 : 3;
    const chipPy = size === "sm" ? 0.5 : 1;
    const fontSize = size === "sm" ? "xs" : "sm";

    const currentIdx = stageIndex(curr);
    const isTerminal = curr === "problem" || curr === "cancelled";

    return (
        <HStack gap={4} align="center">
            {/* Main rail */}
            <HStack gap={4} align="center">
                {FARMER_FLOW.map((step, i) => {
                    const state = stepState(curr, step);
                    const done = state === "done";
                    const active = state === "current";
                    const upcoming = state === "upcoming";

                    // Colors: active is red (per requirement), done uses teal, upcoming uses gray.
                    const fg = active
                        ? "red.600"
                        : done
                            ? "teal.700"
                            : "gray.500";
                    const bg = active
                        ? "red.100"
                        : done
                            ? "teal.50"
                            : "transparent";

                    // Connector color logic (between steps):
                    const lineColor =
                        i < currentIdx
                            ? "teal.600"
                            : i === currentIdx
                                ? "red.400"
                                : "gray.400";

                    return (
                        <HStack key={step} flex="0 0 auto" minW="max-content" gap={3}>
                            <VStack gap={1} align="center">
                                {/* Step circle */}
                                <Box
                                    boxSize={active ? activeCircle : circle}
                                    borderRadius="full"
                                    borderWidth="2px"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="center"
                                    color={fg}
                                    bg={bg}
                                    borderColor={fg}
                                />
                                {/* Step label chip */}
                                <Box
                                    px={chipPx}
                                    py={chipPy}
                                    borderRadius="full"
                                    borderWidth="1px"
                                    color={fg}
                                    bg={bg}
                                    borderColor={fg}
                                >
                                    <Text fontSize={fontSize} lineHeight="short" whiteSpace="nowrap">
                                        {labelFor(step)}
                                    </Text>
                                </Box>
                            </VStack>

                            {/* Connector to next step (skip after last) */}
                            {i < FARMER_FLOW.length - 1 && (
                                <Box
                                    flex="0 0 auto"
                                    h="2px"
                                    w={size === "sm" ? "36px" : "56px"}
                                    bg={lineColor}
                                    borderRadius="full"
                                />
                            )}
                        </HStack>
                    );
                })}
            </HStack>

            {/* Terminal chip for problem/cancelled, or optional explicit current marker */}
            {shouldMarkRed(curr) && isTerminal && (
                <Box
                    px={chipPx}
                    py={chipPy}
                    borderRadius="full"
                    borderWidth="1px"
                    color="red.700"
                    bg="red.100"
                    borderColor="red.600"
                >
                    <Text fontSize={fontSize} lineHeight="short" whiteSpace="nowrap">
                        {labelFor(curr)}
                    </Text>
                </Box>
            )}
        </HStack>
    );
}
