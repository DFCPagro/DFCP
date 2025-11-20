// src/pages/deliverer/schedule/components/ScheduleLegend.tsx
import * as React from "react";
import { Box, HStack, Stack, Text, Badge, Separator } from "@chakra-ui/react";

/**
 * Visual legend for the deliverer monthly schedule (view-only).
 * - Status chips: Active / Standby / No shift
 * - Shift keys: M / A / E / N (Morning / Afternoon / Evening / Night)
 */
export type ScheduleLegendProps = {
    /** Title shown above the legend. */
    title?: string;

    /** Color tokens (Chakra palettes or semantic tokens) for statuses. */
    colors?: {
        active?: string;  // e.g. "green.500"
        standby?: string; // e.g. "yellow.500"
        none?: string;    // e.g. "gray.400"
    };

    /** Whether to show the shift key row (M / A / E / N). */
    showShiftKeys?: boolean;

    /** Optional compact mode (smaller paddings and font sizes). */
    compact?: boolean;
};

const DOT_SIZE = 3; // Chakra space unit (theme-aware)

function Dot({ color, label }: { color: string; label: string }) {
    return (
        <HStack gap="2">
            <Box
                role="img"
                aria-label={label}
                w={DOT_SIZE}
                h={DOT_SIZE}
                borderRadius="full"
                bg={color}
                borderWidth="1px"
                borderColor="blackAlpha.300"
                _dark={{ borderColor: "whiteAlpha.300" }}
            />
            <Text>{label}</Text>
        </HStack>
    );
}

function ShiftChip({ label, desc }: { label: string; desc: string }) {
    return (
        <HStack gap="2">
            <Badge borderRadius="md" px="2" py="0.5" variant="subtle">
                {label}
            </Badge>
            <Text color="fg.subtle" fontSize="sm">
                {desc}
            </Text>
        </HStack>
    );
}

export default function ScheduleLegend({
    title = "Legend",
    colors = { active: "green.500", standby: "yellow.500", none: "gray.400" },
    showShiftKeys = true,
    compact = false,
}: ScheduleLegendProps) {
    return (
        <Stack
            gap={compact ? "2" : "3"}
            p={compact ? "2" : "3"}
            borderWidth="1px"
            borderRadius="lg"
            bg="bg.panel"
        >
            <Text fontWeight="semibold" fontSize={compact ? "sm" : "md"}>
                {title}
            </Text>

            {/* Status row */}
            <HStack gap="6" wrap="wrap">
                <Dot color={colors.active!} label="Active shift" />
                <Dot color={colors.standby!} label="Standby shift" />
                <Dot color={colors.none!} label="No shift" />
            </HStack>

            {showShiftKeys && (
                <>
                    <Separator />
                    <Stack gap="2">
                        <Text fontWeight="medium" fontSize={compact ? "xs" : "sm"} color="fg.subtle">
                            Shift keys
                        </Text>
                        <HStack gap="6" wrap="wrap">
                            <ShiftChip label="M" desc="Morning" />
                            <ShiftChip label="A" desc="Afternoon" />
                            <ShiftChip label="E" desc="Evening" />
                            <ShiftChip label="N" desc="Night" />
                        </HStack>
                    </Stack>
                </>
            )}
        </Stack>
    );
}
