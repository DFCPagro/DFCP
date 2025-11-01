import { memo, useMemo } from "react";
import {
    Box,
    Card,
    CardHeader,
    CardBody,
    Heading,
    Text,
    HStack,
    Stack,
    Badge,
    Separator,
    Tooltip,
} from "@chakra-ui/react";
import { FiCalendar, FiClock } from "react-icons/fi";

export type HeaderCardProps = {
    /** ISO date string (YYYY-MM-DD) */
    date: string;
    /** Shift name literal: morning | afternoon | evening | night */
    shiftName: string;
    /** Optional timezone identifier to display (e.g., "Asia/Jerusalem") */
    tz?: string;
    /** Computed on client */
    okCount: number;
    pendingCount: number;
    problemCount: number;
    /** Optional: total rows returned by API (items.length) */
    totalCount?: number;
    /** Optional: Logistic center display (if you want to show it) */
    lcName?: string;
};

function titleCase(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function formatDateLabel(dateISO: string, tz?: string) {
    if (!dateISO) return "";
    // Prefer Intl for correct weekday/month names; fallback to raw
    try {
        const d = new Date(dateISO + "T00:00:00" + (tz ? "" : "Z"));
        const fmt = new Intl.DateTimeFormat("en-GB", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "2-digit",
            timeZone: tz || undefined,
        });
        return fmt.format(d);
    } catch {
        return dateISO;
    }
}

export const HeaderCard = memo(function HeaderCard({
    date,
    shiftName,
    tz,
    okCount,
    pendingCount,
    problemCount,
    totalCount,
    lcName,
}: HeaderCardProps) {
    const dateLabel = useMemo(() => formatDateLabel(date, tz), [date, tz]);
    const shiftLabel = useMemo(() => titleCase(shiftName), [shiftName]);

    const totals = useMemo(
        () => ({
            ok: okCount ?? 0,
            pending: pendingCount ?? 0,
            problem: problemCount ?? 0,
            total:
                typeof totalCount === "number"
                    ? totalCount
                    : (okCount ?? 0) + (pendingCount ?? 0) + (problemCount ?? 0),
        }),
        [okCount, pendingCount, problemCount, totalCount]
    );

    return (
        <Card.Root borderWidth="1px" borderColor="border" bg="bg" borderRadius="lg">
            <CardHeader pb={2}>
                <Stack gap={1}>
                    <HStack justify="space-between" align="center" wrap="wrap">
                        <HStack gap={2} align="center">
                            <Heading size="md">Shift Farmer Orders</Heading>
                            {lcName ? (
                                <Badge variant="subtle" colorPalette="teal" title="Logistic Center">
                                    {lcName}
                                </Badge>
                            ) : null}
                        </HStack>

                        <HStack gap={2} align="center">
                            <HStack gap={1} align="center">
                                <FiCalendar aria-hidden />
                                <Text fontWeight="medium">{dateLabel || date || "—"}</Text>
                            </HStack>
                            <Separator orientation="vertical" />
                            <HStack gap={1} align="center">
                                <FiClock aria-hidden />
                                <Text fontWeight="medium">{shiftLabel || "—"}</Text>
                            </HStack>
                            {tz ? (
                                <>
                                    <Separator orientation="vertical" />
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            <Badge variant="surface" colorPalette="gray">{tz}</Badge>
                                        </Tooltip.Trigger>
                                        <Tooltip.Content>
                                            Timezone used for date formatting
                                        </Tooltip.Content>
                                    </Tooltip.Root>
                                </>
                            ) : null}
                        </HStack>
                    </HStack>
                </Stack>
            </CardHeader>

            <CardBody pt={2}>
                <HStack gap={3} wrap="wrap">
                    <StatPill label="Total" value={totals.total} palette="gray" />
                    <StatPill label="OK" value={totals.ok} palette="green" ariaLabel="OK farmer orders" />
                    <StatPill label="Pending" value={totals.pending} palette="yellow" ariaLabel="Pending farmer orders" />
                    <StatPill label="Problem" value={totals.problem} palette="red" ariaLabel="Problem farmer orders" />
                </HStack>
            </CardBody>
        </Card.Root>
    );
});

type StatPillProps = {
    label: string;
    value: number | string;
    palette: "gray" | "green" | "yellow" | "red" | "teal" | "blue";
    ariaLabel?: string;
};

function StatPill({ label, value, palette, ariaLabel }: StatPillProps) {
    return (
        <Box
            aria-label={ariaLabel ?? `${label} count`}
            borderWidth="1px"
            borderColor="border"
            borderRadius="full"
            px={3}
            py={1.5}
            bg="bg.subtle"
        >
            <HStack gap={2} align="center">
                <Badge variant="solid" colorPalette={palette}>
                    {label}
                </Badge>
                <Text fontWeight="semibold">{value}</Text>
            </HStack>
        </Box>
    );
}
