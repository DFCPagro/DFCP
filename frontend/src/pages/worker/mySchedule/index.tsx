// --- replace: index.tsx ------------------------------------------------------
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

import { useWorkerSchedule, useNextMonthAvailability } from "./hooks/useWorkerSchedule";
import { PATHS as P } from "@/routes/paths";
export default function MySchedulePage() {
    // 1) Current month (view-only on this page)
    const {
        year,
        month, // 1–12
        activeBitmap,
        standByBitmap,
        isLoading,
        isFetching,
        isError,
        error,
    } = useWorkerSchedule(); // :contentReference[oaicite:2]{index=2}

    // 2) Next-month availability (Option A: strict)
    const next = useNextMonthAvailability({ currentYear: year, currentMonth: month }); // :contentReference[oaicite:3]{index=3}

    // 3) Map to UI status
    const planStatus: "loading" | "can" | "submitted" | "error" =
        next.isLoading ? "loading" : next.isError ? "error" : next.canPlan ? "can" : "submitted";

    const planTooltip =
        planStatus === "loading"
            ? "Checking next month…"
            : planStatus === "can"
                ? `No schedule found for ${next.nextMonthKey}. You can plan it now.`
                : planStatus === "submitted"
                    ? `A schedule already exists for ${next.nextMonthKey}.`
                    : "Couldn’t check next month. Please try again.";

    const planDisabled = planStatus !== "can";

    // 4) Navigate to planner
    const navigate = useNavigate();
    const handlePlanNextMonth = React.useCallback(() => {
        if (planDisabled) return;
        navigate(`${P.delivererPlanSchedule}?month=${next.nextMonthKey}`);
    }, [navigate, planDisabled, next.nextMonthKey]);

    const topError = isError ? error : null;

    return (
        <Container maxW="6xl" py="6">
            {/* Header (accepts plan props) */}
            <ScheduleHeader
                year={year}
                month={month}
                onPlanNextMonth={handlePlanNextMonth}
                planStatus={planStatus}
                planTooltip={planTooltip}
                planDisabled={planDisabled}
            />

            {/* Error banner for the *current* month load */}
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
                {/* Summary */}
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

                {/* Legend + Grid */}
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
                        />
                    </Stack>
                )}
            </Stack>
        </Container>
    );
}
