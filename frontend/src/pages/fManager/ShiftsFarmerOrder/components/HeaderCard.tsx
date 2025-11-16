import { memo, useMemo, useState, useEffect } from "react";
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
import type { ShiftFarmerOrdersQuery } from "@/types/farmerOrders";
import { fetchShiftWindowsByName, type ShiftName } from "@/api/shifts";
import { StatCardsRow } from "./StatusStats";

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

// Assuming something like:
// async function fetchShiftWindowsByName(name: ShiftName): Promise<ShiftWindows | null> { ... }

async function getShiftWindow(shiftName: ShiftName) {
    const windows = await fetchShiftWindowsByName(shiftName);

    if (!windows?.general) return "";

    return `${shiftName} ${windows.general.start} to ${windows.general.end}`;
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
    const [shiftTime, setShiftTime] = useState<string>("");

    const dateLabel = useMemo(() => formatDateLabel(date, tz), [date, tz]);
    const shiftLabel = useMemo(() => titleCase(shiftName), [shiftName]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const windowLabel = await getShiftWindow(shiftName as ShiftName);
                if (!cancelled) {
                    setShiftTime(windowLabel);
                }
            } catch (err) {
                console.error("Failed to fetch shift window", err);
                if (!cancelled) setShiftTime("");
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [shiftName]);


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
                                <Text fontWeight="medium">{shiftTime || "—"}</Text>
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
                <Stack gap={3} wrap="wrap" direction="row" >
                    <StatCardsRow label="Total" value={totals.total} palette="gray" />
                    <StatCardsRow label="OK" value={totals.ok} palette="green" sub="OK farmer orders" />
                    <StatCardsRow label="Pending" value={totals.pending} palette="yellow" sub="Pending farmer orders" />
                    <StatCardsRow label="Problem" value={totals.problem} palette="red" sub="Problem farmer orders" />
                </Stack>
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
            background={palette}
        >
            <HStack gap={2} align="center" >
                <Text fontWeight="semibold">{label} :{value}</Text>
            </HStack>
        </Box>
    );
}
