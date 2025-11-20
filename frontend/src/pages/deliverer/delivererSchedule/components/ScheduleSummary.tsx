// src/pages/deliverer/schedule/components/ScheduleSummary.tsx
import * as React from "react";
import {
    Badge,
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

// month is 1..12
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

function formatDate(year: number, month: number, day: number, tz = "Asia/Jerusalem") {
    const d = new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC to avoid DST flips
    const fmt = new Intl.DateTimeFormat("en", {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "2-digit",
    });
    return fmt.format(d);
}

function anyShift(maskActive: number, maskStandby: number) {
    return (maskActive | maskStandby) !== 0;
}

function getNowPartsTZ(tz: string) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = fmt.formatToParts(new Date());
    const y = Number(parts.find(p => p.type === "year")?.value);
    const m1 = Number(parts.find(p => p.type === "month")?.value);
    const d = Number(parts.find(p => p.type === "day")?.value);
    return { year: y, month1: m1, day: d };
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

    /**
     * How many upcoming rows to show.
     * If omitted, we show the full rest of the month.
     */
    maxUpcoming?: number;

    /** Optional: timezone for "today" calculation (default Asia/Jerusalem) */
    tz?: string;
};

/* --------------------------------- main ---------------------------------- */

export default function ScheduleSummary({
    year,
    month,
    activeBitmap,
    standByBitmap,
    maxUpcoming, // undefined => rest of month
    tz = "Asia/Jerusalem",
}: ScheduleSummaryProps) {
    const { year: nowY, month1: nowM1, day: nowD } = getNowPartsTZ(tz);
    const isCurrentMonth = nowY === year && nowM1 === month;
    const todayDay = isCurrentMonth ? nowD : null;
    const dim = daysInMonth(year, month);

    // Today row (only if this is the current month and there are shifts today)
    const todayActive = todayDay ? maskAt(activeBitmap, todayDay) : 0;
    const todayStandby = todayDay ? maskAt(standByBitmap, todayDay) : 0;
    const showToday = !!todayDay && anyShift(todayActive, todayStandby);

    // Upcoming = remaining days strictly after today (or from day 1 if not current month)
    const start = isCurrentMonth ? Math.min((todayDay ?? 0) + 1, dim + 1) : 1;
    const upcoming: { day: number; a: number; s: number }[] = [];
    for (let d = start; d <= dim; d++) {
        const a = maskAt(activeBitmap, d);
        const s = maskAt(standByBitmap, d);
        if (anyShift(a, s)) {
            upcoming.push({ day: d, a, s });
            if (typeof maxUpcoming === "number" && upcoming.length >= maxUpcoming) break;
        }
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
                                {formatDate(year, month, todayDay!, tz)}
                            </Text>
                            <ShiftBadges activeMask={todayActive} standbyMask={todayStandby} />
                        </Stack>
                    ) : (
                        <Text color="fg.subtle" fontSize="sm">
                            {isCurrentMonth ? "No shifts today." : "Today is outside this month."}
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
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {upcoming.map(({ day, a, s }) => (
                                    <Table.Row key={day}>
                                        <Table.Cell>
                                            <Text>{formatDate(year, month, day, tz)}</Text>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <ShiftBadges activeMask={a} standbyMask={s} />
                                        </Table.Cell>
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
