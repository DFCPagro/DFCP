// src/pages/ShiftFarmerOrder/components/PrevShiftOrdersCard.tsx
import { memo, useMemo, useCallback } from "react";
import {
    Box,
    HStack,
    VStack,
    Text,
    Badge,
    Separator,
    Skeleton,
    Button,
} from "@chakra-ui/react";
import { usePrevShiftOrders } from "../hooks/usePrevShiftOrders";
import { ShiftRow } from "./ShiftRow";
import type { ShiftEnum as Shift } from "@/types/shifts";
import type { ShiftRollup } from "@/types/farmerOrders";
import { useNavigate } from "react-router-dom";
import { PATHS } from "@/routes/paths";

export type PrevShiftOrdersCardProps = {
    daysBack?: number;
    fake?: boolean;
    fakeNum?: number;
    compact?: boolean;
    onViewShift?: (row: ShiftRollup) => void;
};

export const PrevShiftOrdersCard = memo(function PrevShiftOrdersCard({
    daysBack = 2,
    fake = true,
    fakeNum = 12,
    compact = false,
    onViewShift,
}: PrevShiftOrdersCardProps) {
    const navigate = useNavigate();

    const { data, isLoading, isFetching, error, refetch } = usePrevShiftOrders({
        daysBack,
        fake,
        fakeNum,
    });

    // FLATTEN: from [{ date, shifts:[{shiftName, rollup}, ...] }, ...]
    // to [{ date, shiftName, rollup }, ...] ordered by date desc, then shift order as returned by the hook.
    const flatRows = useMemo(
        () =>
            data.flatMap((d) =>
                d.shifts.map((s) => ({
                    date: d.date,
                    shiftName: s.shiftName,
                    rollup: s.rollup,
                }))
            ),
        [data]
    );

    // Stable click handler; use provided callback if present, else navigate.
    const handleView = useCallback(
        (row: ShiftRollup) => {
            if (onViewShift) return onViewShift(row);
            const url = `${PATHS.fManagerShiftsFarmerOrder}?date=${encodeURIComponent(
                row.date
            )}&shift=${encodeURIComponent(row.shiftName)}`;
            navigate(url);
        },
        [navigate, onViewShift]
    );

    return (
        <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            bg="bg.panel"
            px={4}
            py={compact ? 3 : 4}
            w="full"
        >
            {/* Header */}
            <HStack justify="space-between" align="center" mb={compact ? 2 : 3}>
                <HStack gap={2} align="center">
                    <Text fontSize="lg" fontWeight="semibold">
                        Previous Orders
                    </Text>
                    {fake && (
                        <Badge variant="surface" colorPalette="yellow" borderRadius="md">
                            FAKE
                        </Badge>
                    )}
                    {isFetching && (
                        <Badge variant="surface" colorPalette="gray" borderRadius="md">
                            updating…
                        </Badge>
                    )}
                </HStack>
                <Button size="xs" variant="outline" onClick={() => refetch()}>
                    Refresh
                </Button>
            </HStack>

            {/* Loading */}
            {isLoading ? (
                <VStack align="stretch" gap={2}>
                    {[0, 1].map((i) => (
                        <Box key={i}>
                            <VStack align="stretch" gap={1}>
                                {[0, 1, 2, 3].map((s) => (
                                    <HStack key={s} justify="space-between" py={2}>
                                        <Skeleton height="14px" width="260px" />
                                        <HStack gap={3}>
                                            <Skeleton height="24px" width="76px" />
                                            <Skeleton height="24px" width="60px" />
                                            <Skeleton height="24px" width="76px" />
                                            <Skeleton height="28px" width="54px" />
                                        </HStack>
                                    </HStack>
                                ))}
                            </VStack>
                            {i === 0 && <Separator my={3} />}
                        </Box>
                    ))}
                </VStack>
            ) : error ? (
                <HStack gap={2} align="center">
                    <Text fontSize="sm" color="fg.muted">
                        Could not load previous orders
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        {error instanceof Error ? error.message : String(error)}
                    </Text>
                </HStack>
            ) : (
                <VStack align="stretch" gap={1}>
                    {flatRows.map(({ date, shiftName, rollup }) => (
                        <ShiftRow
                            key={`${date}-${shiftName}`}
                            variant="stats"
                            dateISO={date}
                            shift={shiftName as Shift}
                            counts={{
                                pending: rollup.pendingFO ?? 0,
                                ok: rollup.okFO ?? 0,
                                problem: rollup.problemFO ?? 0,
                            }}
                            onView={() => handleView(rollup)}
                        />
                    ))}
                </VStack>
            )}
        </Box>
    );
});
