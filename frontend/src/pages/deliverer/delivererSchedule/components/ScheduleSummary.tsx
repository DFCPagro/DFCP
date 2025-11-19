// src/pages/deliverer/schedule/components/ScheduleSummary.tsx

import * as React from "react";
import {
    Badge,
    Box,
    Button,
    Card,
    HStack,
    Stack,
    Table,
    Text,
    Tooltip,
} from "@chakra-ui/react";
import type { ScheduleBitmap } from "@/api/schedule";
import type { ShiftName } from "@/api/shifts";

/* --------------------------------- helpers -------------------------------- */

type ShiftKey = Exclude<ShiftName, "none">; // we only render the 4 real shifts

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

function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

function maskAt(bm: ScheduleBitmap, day: number): number {
    return bm?.[day - 1] ?? 0;
}

function getModeForShift(
    activeMask: number,
    standbyMask: number,
    shift: ShiftKey,
): "active" | "standby" | "none" {
    const bit = SHIFT_BITS[shift];
    const a = (activeMask & bit) !== 0;
    const s = (standbyMask & bit) !== 0;
    if (a && !s) return "active";
    if (!a && s) return "standby";
    if (a && s) return "active"; // normalized data should prevent this; prefer active
    return "none";
}

function formatDate(year: number, month: number, day: number) {
    const d = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("en", {
        weekday: "short",
        month: "short",
        day: "2-digit",
    }).format(d);
}

function anyShift(maskActive: number, maskStandby: number) {
    return (maskActive | maskStandby) !== 0;
}

/* ---------------------------------- UI ----------------------------------- */

function ShiftBadges({
    activeMask,
    standbyMask,
}: {
    activeMask: number;
    standbyMask: number;
}) {
    return (
        <HStack gap="1.5" wrap="wrap">
            {(Object.keys(SHIFT_BITS) as ShiftKey[]).map((k) => {
                const mode = getModeForShift(activeMask, standbyMask, k);
                if (mode === "none") return null;

                const palette = mode === "active" ? "green" : "yellow";
                const label = SHIFT_LABEL[k].short;

                return (
                    <Tooltip.Root key={k} openDelay={150}>
                        <Tooltip.Trigger asChild>
                            <Badge colorPalette={palette} variant="subtle" borderRadius="md" px="2" py="0.5">
                                {label}
                            </Badge>
                        </Tooltip.Trigger>
                        <Tooltip.Positioner>
                            <Tooltip.Content>
                                <Tooltip.Arrow />
                                {`${SHIFT_LABEL[k].full} • ${mode === "active" ? "Active" : "Standby"}`}
                            </Tooltip.Content>
                        </Tooltip.Positioner>
                    </Tooltip.Root>
                );
            })}
        </HStack>
    );
}

/* --------------------------------- props --------------------------------- */

export type ScheduleSummaryProps = {
    /** Month context (1–12) and year */
    year: number;
    month: number;

    /** Bitmaps for this month */
    activeBitmap: ScheduleBitmap;
    standByBitmap: ScheduleBitmap;

    /** How many upcoming rows to show (default 6) */
    maxUpcoming?: number;

    /** Optional: clicking a row should open the day editor */
    onDayClick?: (day: number) => void;
};

/* --------------------------------- main ---------------------------------- */

export default function ScheduleSummary({
    year,
    month,
    activeBitmap,
    standByBitmap,
    maxUpcoming = 6,
    onDayClick,
}: ScheduleSummaryProps) {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
    const todayDay = isCurrentMonth ? today.getDate() : null;
    const dim = daysInMonth(year, month);

    // Today row (only if this is the current month and there are shifts today)
    const todayActive = todayDay ? maskAt(activeBitmap, todayDay) : 0;
    const todayStandby = todayDay ? maskAt(standByBitmap, todayDay) : 0;
    const showToday = !!todayDay && anyShift(todayActive, todayStandby);

    // Upcoming = remaining days (strictly after today if current month; else from day 1)
    const start = isCurrentMonth ? Math.min(todayDay! + 1, dim + 1) : 1;
    const upcoming: { day: number; a: number; s: number }[] = [];
    for (let d = start; d <= dim; d++) {
        const a = maskAt(activeBitmap, d);
        const s = maskAt(standByBitmap, d);
        if (anyShift(a, s)) upcoming.push({ day: d, a, s });
        if (upcoming.length >= maxUpcoming) break;
    }

    return (
        <HStack align="stretch" gap="4" w="full" flexDir={{ base: "column", md: "row" }}>
            {/* Today card */}
            <Card.Root flex="1">
                <Card.Header pb="2">
                    <HStack justify="space-between">
                        <Text fontWeight="semibold">Today</Text>
                        {!isCurrentMonth && <Badge variant="subtle" colorPalette="gray">Different month</Badge>}
                    </HStack>
                </Card.Header>
                <Card.Body>
                    {showToday ? (
                        <Stack gap="2">
                            <Text color="fg.subtle" fontSize="sm">
                                {formatDate(year, month, todayDay!)}
                            </Text>
                            <ShiftBadges activeMask={todayActive} standbyMask={todayStandby} />
                            {onDayClick && (
                                <Box>
                                    <Button size="sm" onClick={() => onDayClick(todayDay!)}>Edit</Button>
                                </Box>
                            )}
                        </Stack>
                    ) : (
                        <Text color="fg.subtle" fontSize="sm">
                            {isCurrentMonth ? "No shifts scheduled for today." : "Today is outside this month."}
                        </Text>
                    )}
                </Card.Body>
            </Card.Root>

            {/* Upcoming card */}
            <Card.Root flex="1">
                <Card.Header pb="2">
                    <Text fontWeight="semibold">Upcoming</Text>
                </Card.Header>
                <Card.Body>
                    {upcoming.length === 0 ? (
                        <Text color="fg.subtle" fontSize="sm">No upcoming shifts in this month.</Text>
                    ) : (
                        <Table.Root size="sm" variant="line">
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeader w="40%">Date</Table.ColumnHeader>
                                    <Table.ColumnHeader>Shifts</Table.ColumnHeader>
                                    {onDayClick && <Table.ColumnHeader w="1%"></Table.ColumnHeader>}
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {upcoming.map(({ day, a, s }) => (
                                    <Table.Row key={day}>
                                        <Table.Cell>
                                            <Text>{formatDate(year, month, day)}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <ShiftBadges activeMask={a} standbyMask={s} />
                                        </Table.Cell>
                                        {onDayClick && (
                                            <Table.Cell>
                                                <Button size="xs" variant="ghost" onClick={() => onDayClick(day)}>
                                                    Edit
                                                </Button>
                                            </Table.Cell>
                                        )}
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Root>
                    )}
                </Card.Body>
            </Card.Root>
        </HStack>
    );
}
