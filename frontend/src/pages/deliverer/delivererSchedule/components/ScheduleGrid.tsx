// src/pages/deliverer/schedule/components/ScheduleGrid.tsx

import * as React from "react";
import {
    Box,
    Grid,
    GridItem,
    HStack,
    Stack,
    Text,
    Tooltip,
    useToken,
} from "@chakra-ui/react";
import type { ScheduleBitmap } from "@/api/schedule";

// If your global ShiftName includes "none", that's fine — we only use these four here.
type ShiftKey = "morning" | "afternoon" | "evening" | "night";

export type ScheduleGridProps = {
    /** Numeric year (e.g., 2025). */
    year: number;
    /** Numeric month, 1–12. */
    month: number;

    /** Bitmaps for this month. index 0 = day 1, etc. */
    activeBitmap: ScheduleBitmap;
    standByBitmap: ScheduleBitmap;

    /** Called when a calendar day is clicked. Receives 1-based day number. */
    onDayClick?: (day: number) => void;

    /** Optional UI tweaks */
    showWeekdayHeader?: boolean;
    compact?: boolean;
    /** Override colors to align with your design system if needed. */
    colors?: {
        active?: string; // e.g., "green.500"
        standby?: string; // e.g., "yellow.500"
        none?: string; // e.g., "gray.400"
        todayRing?: string; // outline color for today
    };
};

const SHIFT_BITS: Record<ShiftKey, number> = {
    morning: 0b0001,
    afternoon: 0b0010,
    evening: 0b0100,
    night: 0b1000,
};

const SHIFT_LABEL: Record<ShiftKey, { short: string; full: string }> = {
    morning: { short: "M", full: "Morning" },
    afternoon: { short: "A", full: "Afternoon" },
    evening: { short: "E", full: "Evening" },
    night: { short: "N", full: "Night" },
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function daysInMonth(year: number, month: number): number {
    // month is 1–12; Date uses 0–11; day=0 → last day of previous month
    return new Date(year, month, 0).getDate();
}

function firstWeekday(year: number, month: number): number {
    // 0 = Sunday ... 6 = Saturday
    return new Date(year, month - 1, 1).getDay();
}

function getMask(bm: ScheduleBitmap, day: number): number {
    const idx = day - 1;
    return bm?.[idx] ?? 0;
}

function getShiftModeForDay(
    day: number,
    activeMask: number,
    standbyMask: number,
    shift: ShiftKey,
): "active" | "standby" | "none" {
    const bit = SHIFT_BITS[shift];
    const a = (activeMask & bit) !== 0;
    const s = (standbyMask & bit) !== 0;
    if (a && !s) return "active";
    if (!a && s) return "standby";
    // If both present (shouldn’t after normalization), treat as active.
    if (a && s) return "active";
    return "none";
}

export default function ScheduleGrid({
    year,
    month,
    activeBitmap,
    standByBitmap,
    onDayClick,
    showWeekdayHeader = true,
    compact = false,
    colors = {
        active: "green.500",
        standby: "yellow.500",
        none: "gray.400",
        todayRing: "blue.400",
    },
}: ScheduleGridProps) {
    const totalDays = daysInMonth(year, month);
    const startOffset = firstWeekday(year, month); // leading blanks
    const today = new Date();
    const isCurrentMonth =
        today.getFullYear() === year && today.getMonth() + 1 === month;

    const [activeColor, standbyColor, noneColor, todayRingColor] = useToken("colors", [
        colors.active!,
        colors.standby!,
        colors.none!,
        colors.todayRing!,
    ]);

    const cells: React.ReactNode[] = [];

    // Weekday header (optional)
    if (showWeekdayHeader) {
        for (let i = 0; i < 7; i++) {
            cells.push(
                <GridItem
                    key={`wh-${i}`}
                    textAlign="center"
                    fontWeight="medium"
                    color="fg.muted"
                    py="1.5"
                >
                    {WEEKDAY_LABELS[i]}
                </GridItem>,
            );
        }
    }

    // Leading empty cells
    for (let i = 0; i < startOffset; i++) {
        cells.push(<GridItem key={`lead-${i}`} />);
    }

    // Actual days
    for (let day = 1; day <= totalDays; day++) {
        const aMask = getMask(activeBitmap, day);
        const sMask = getMask(standByBitmap, day);

        // Build tooltip summary like "M: Active, A: —, E: Standby, N: —"
        const summaryParts: string[] = [];
        (Object.keys(SHIFT_BITS) as ShiftKey[]).forEach((shift) => {
            const mode = getShiftModeForDay(day, aMask, sMask, shift);
            const label = SHIFT_LABEL[shift].short;
            summaryParts.push(`${label}: ${mode === "none" ? "—" : mode}`);
        });
        const tooltipText = summaryParts.join(" · ");

        const isToday = isCurrentMonth && day === today.getDate();

        cells.push(
            <Tooltip.Root key={`d-${day}`} openDelay={150}>
                <Tooltip.Trigger asChild>
                    <GridItem>
                        <Box
                            role="button"
                            aria-label={`Day ${day}`}
                            tabIndex={0}
                            onClick={() => onDayClick?.(day)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") onDayClick?.(day);
                            }}
                            borderWidth="1px"
                            borderRadius="md"
                            p={compact ? 1.5 : 2}
                            cursor={onDayClick ? "pointer" : "default"}
                            _hover={onDayClick ? { bg: "bg.muted" } : undefined}
                            outline={isToday ? `2px solid ${todayRingColor}` : "none"}
                            outlineOffset={isToday ? "2px" : undefined}
                            minH={compact ? "72px" : "88px"}
                            display="flex"
                            flexDirection="column"
                            justifyContent="space-between"
                            bg="bg.panel"
                        >
                            {/* Day number */}
                            <HStack justify="space-between" align="start">
                                <Text fontWeight="semibold" fontSize={compact ? "sm" : "md"}>
                                    {day}
                                </Text>
                            </HStack>

                            {/* Shift row: M A E N */}
                            <HStack justify="space-between" gap="1" mt={1}>
                                {(Object.keys(SHIFT_BITS) as ShiftKey[]).map((shift) => {
                                    const mode = getShiftModeForDay(day, aMask, sMask, shift);
                                    const label = SHIFT_LABEL[shift].short;
                                    const color =
                                        mode === "active"
                                            ? activeColor
                                            : mode === "standby"
                                                ? standbyColor
                                                : noneColor;

                                    return (
                                        <Stack
                                            key={`${day}-${shift}`}
                                            align="center"
                                            gap={0}
                                            minW={compact ? "26px" : "32px"}
                                        >
                                            <Box
                                                w={compact ? "18px" : "20px"}
                                                h={compact ? "18px" : "20px"}
                                                borderRadius="full"
                                                borderWidth="1px"
                                                bg={color}
                                                borderColor="blackAlpha.300"
                                                _dark={{ borderColor: "whiteAlpha.300" }}
                                                aria-label={`${SHIFT_LABEL[shift].full}: ${mode}`}
                                            />
                                            <Text fontSize="xs" color="fg.subtle">
                                                {label}
                                            </Text>
                                        </Stack>
                                    );
                                })}
                            </HStack>
                        </Box>
                    </GridItem>
                </Tooltip.Trigger>
                <Tooltip.Positioner>
                    <Tooltip.Content>
                        <Tooltip.Arrow />
                        {tooltipText}
                    </Tooltip.Content>
                </Tooltip.Positioner>
            </Tooltip.Root>,
        );
    }

    // Trailing empties so the grid ends cleanly — optional
    const totalCells = (showWeekdayHeader ? 7 : 0) + startOffset + totalDays;
    const remainder = totalCells % 7;
    if (remainder !== 0) {
        const blanks = 7 - remainder;
        for (let i = 0; i < blanks; i++) {
            cells.push(<GridItem key={`trail-${i}`} />);
        }
    }

    return (
        <Grid templateColumns="repeat(7, 1fr)" gap={compact ? 2 : 3} alignItems="stretch">
            {cells}
        </Grid>
    );
}
