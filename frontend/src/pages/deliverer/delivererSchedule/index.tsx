// src/pages/deliverer/schedule/index.tsx

import * as React from "react";
import {
    Box,
    Container,
    Stack,
    HStack,
    Skeleton,
    Alert,
    Separator,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import ScheduleHeader from "./components/ScheduleHeader";
import ScheduleLegend from "./components/ScheduleLegend";
import ScheduleGrid from "./components/ScheduleGrid";
import ScheduleSummary from "./components/ScheduleSummary";

// Source of truth: live API data (current month only)
import { useDelivererSchedule } from "./hooks/useDelivererSchedule";

export default function DelivererSchedulePage() {
    // 1) Load current month schedule (no month flipping)
    const {
        year,
        month,          // expected 1–12 (matches ScheduleHeader/Summary/Grid)
        activeBitmap,
        standByBitmap,
        isLoading,
        isFetching,
        isError,
        error,
    } = useDelivererSchedule();

    // 2) Plan Next Month → simple navigation (view-only scope)
    const navigate = useNavigate();
    const handlePlanNextMonth = React.useCallback(() => {
        // Placeholder route you’ll implement later
        navigate("/deliverer/schedule/plan-next-month");
    }, [navigate]);

    // 3) Top-level load error (no save/plan errors in view-only)
    const topError = isError ? error : null;

    return (
        <Container maxW="6xl" py="6">
            {/* Header */}
            <ScheduleHeader
                year={year}
                month={month}
                onPlanNextMonth={handlePlanNextMonth}
            />

            {/* Error banner */}
            {topError ? (
                <Alert.Root status="error" mt="4" borderRadius="md">
                    <Alert.Indicator />
                    <Box>
                        <Alert.Title>Something went wrong</Alert.Title>
                        <Alert.Description>
                            {(topError as any)?.message ?? "Please try again."}
                        </Alert.Description>
                    </Box>
                </Alert.Root>
            ) : null}

            <Stack mt="5" gap="5">
                {/* Summary section (Today + Upcoming – view-only) */}
                {isLoading || isFetching ? (
                    <HStack gap="4">
                        <Skeleton h="140px" flex="1" borderRadius="md" />
                        <Skeleton
                            h="140px"
                            flex="1"
                            borderRadius="md"
                            display={{ base: "none", md: "block" }}
                        />
                    </HStack>
                ) : (
                    <ScheduleSummary
                        year={year}
                        month={month}
                        activeBitmap={activeBitmap}
                        standByBitmap={standByBitmap}
                    />
                )}

                <Separator />

                {/* Legend + Grid (view-only) */}
                {isLoading || isFetching ? (
                    <Stack gap="4">
                        <Skeleton h="80px" borderRadius="md" />
                        <Skeleton h="420px" borderRadius="md" />
                    </Stack>
                ) : (
                    <Stack gap="4">
                        <ScheduleLegend compact />
                        <ScheduleGrid
                            year={year}
                            month={month}
                            activeBitmap={activeBitmap}
                            standByBitmap={standByBitmap}
                        // View-only: omit onDayClick for now
                        />
                    </Stack>
                )}
            </Stack>
        </Container>
    );
}
