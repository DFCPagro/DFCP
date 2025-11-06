import { memo, useMemo } from "react";
import {
    Box,
    VStack,
    HStack,
    Text,
    Badge,
    Icon,
    Skeleton,
    Separator,
    Alert,
} from "@chakra-ui/react";
import { FiClock, FiCheckCircle, FiInfo } from "react-icons/fi";
import type { FarmerDetail, FarmerLandDetail, FarmerSection } from "@/types/farmer";

/* --------------------------------- Types --------------------------------- */

export type FarmerWorkHistoryPaneProps = {
    /** If you already fetched the farmer with useFarmerById, pass it here */
    farmer?: FarmerDetail | null;
    /** Loading state from parent while farmer is being fetched */
    isLoading?: boolean;
};

/* ------------------------------- Utilities ------------------------------- */
/** Localized short date format; stays local to this file (no shared utils). */
function formatDate(d?: string | Date): string {
    if (!d) return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
    }).format(dt);
}

/** Safe number */
const n = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);

/* -------------------------------- Component ------------------------------ */

export const FarmerWorkHistoryPane = memo(function FarmerWorkHistoryPane({
    farmer,
    isLoading = false,
}: FarmerWorkHistoryPaneProps) {
    // Derived stats & optional extra milestones we can infer without extra APIs:
    const {
        joinedAt,
        landsCount,
        sectionsCount,
        firstLandDate,
        firstSectionDate,
    } = useMemo(() => {
        const joinedAt = farmer?.createdAt;
        const lands = farmer?.lands ?? [];

        // Try to infer earliest land/section creation date if present in payload
        let firstLandDate: string | Date | undefined;
        let firstSectionDate: string | Date | undefined;
        let sectionsCount = 0;

        for (const land of lands) {
            const ld = (land as any)?.createdAt as string | Date | undefined;
            if (ld) {
                if (!firstLandDate || new Date(ld) < new Date(firstLandDate)) {
                    firstLandDate = ld;
                }
            }
            const detail = land as FarmerLandDetail;
            if (Array.isArray(detail?.sections)) {
                sectionsCount += detail.sections.length;
                for (const s of detail.sections as FarmerSection[]) {
                    const sd = s?.createdAt;
                    if (sd) {
                        if (!firstSectionDate || new Date(sd) < new Date(firstSectionDate)) {
                            firstSectionDate = sd;
                        }
                    }
                }
            }
        }

        return {
            joinedAt,
            landsCount: lands.length,
            sectionsCount,
            firstLandDate,
            firstSectionDate,
        };
    }, [farmer]);

    // Timeline items (Applied is placeholder until you wire Applications API)
    const timeline = useMemo(
        () =>
            [
                {
                    key: "applied",
                    label: "Applied",
                    date: undefined as string | Date | undefined, // TODO: wire JobApplication.createdAt
                    icon: FiInfo,
                    tone: "muted" as const,
                    note: "Application date will appear here when available.",
                },
                {
                    key: "joined",
                    label: "Joined",
                    date: joinedAt,
                    icon: FiCheckCircle,
                    tone: "success" as const,
                },
                // Optional inferred milestones if dates exist in payload
                firstLandDate
                    ? {
                        key: "firstLand",
                        label: "First land recorded",
                        date: firstLandDate,
                        icon: FiClock,
                        tone: "info" as const,
                    }
                    : null,
                firstSectionDate
                    ? {
                        key: "firstSection",
                        label: "First section recorded",
                        date: firstSectionDate,
                        icon: FiClock,
                        tone: "info" as const,
                    }
                    : null,
            ].filter(Boolean) as Array<{
                key: string;
                label: string;
                date?: string | Date;
                icon: any;
                tone: "success" | "info" | "muted";
                note?: string;
            }>,
        [joinedAt, firstLandDate, firstSectionDate]
    );

    /* ------------------------------- Rendering ------------------------------ */

    if (isLoading) {
        return (
            <VStack align="stretch" gap={4}>
                <Skeleton height="24px" />
                <Skeleton height="18px" />
                <Skeleton height="72px" />
                <Skeleton height="18px" />
                <Skeleton height="24px" />
            </VStack>
        );
    }

    if (!farmer) {
        return (
            <Alert.Root status="info" variant="subtle" borderRadius="lg">
                <Alert.Indicator />
                <Alert.Title>No data</Alert.Title>
                <Alert.Description>Farmer details are not loaded yet.</Alert.Description>
            </Alert.Root>
        );
    }

    return (
        <VStack align="stretch" gap={4}>
            {/* Header summary */}
            <Box>
                <HStack gap={3} wrap="wrap">
                    <Badge variant="surface" colorPalette="green">
                        Lands: {landsCount}
                    </Badge>
                    <Badge variant="surface" colorPalette="blue">
                        Sections: {sectionsCount}
                    </Badge>
                    <Badge variant="surface" colorPalette="gray">
                        Joined: {joinedAt ? formatDate(joinedAt) : "—"}
                    </Badge>
                </HStack>
            </Box>

            <Separator />

            {/* Vertical timeline */}
            <VStack align="stretch" gap={3}>
                {timeline.map((item, idx) => {
                    const isLast = idx === timeline.length - 1;
                    const color =
                        item.tone === "success" ? "green.500" : item.tone === "info" ? "blue.500" : "fg.subtle";

                    return (
                        <HStack key={item.key} align="flex-start" gap={3}>
                            {/* Marker + vertical line */}
                            <VStack gap={0} align="center" minW="20px">
                                <Icon aria-hidden as={item.icon} boxSize={4} color={color} />
                                {!isLast && <Box flex="1" w="1px" bg="border" minH="16px" />}
                            </VStack>

                            {/* Content */}
                            <VStack align="start" gap={1} flex="1">
                                <HStack gap={2}>
                                    <Text fontWeight="medium">{item.label}</Text>
                                    <Badge size="sm" variant="outline" colorPalette="gray">
                                        {item.date ? formatDate(item.date) : "—"}
                                    </Badge>
                                </HStack>
                                {item.note && (
                                    <Text fontSize="sm" color="fg.subtle">
                                        {item.note}
                                    </Text>
                                )}
                            </VStack>
                        </HStack>
                    );
                })}
            </VStack>

            {/* Friendly hint when we only have Joined */}
            {timeline.filter((t) => !!t.date).length <= 1 && (
                <Alert.Root status="info" variant="surface" borderRadius="lg">
                    <Alert.Indicator />
                    <Text>
                        More history (like <b>Applied</b> and detailed milestones) will appear once those APIs are
                        connected.
                    </Text>
                </Alert.Root>
            )}

            {/* Footer stats (compact) */}
            <HStack gap={3} wrap="wrap" color="fg.subtle" fontSize="sm">
                <HStack gap={1}>
                    <Icon as={FiClock} />
                    <Text>Records shown: {timeline.length}</Text>
                </HStack>
                <Text>•</Text>
                <Text>Total areas tracked via sections: {n(sectionsCount)}</Text>
            </HStack>
        </VStack>
    );
});

export default FarmerWorkHistoryPane;
