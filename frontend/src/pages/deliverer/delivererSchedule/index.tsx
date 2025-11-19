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

import ScheduleHeader from "./components/ScheduleHeader";
import ScheduleLegend from "./components/ScheduleLegend";
import ScheduleGrid from "./components/ScheduleGrid";
import ScheduleSummary from "./components/ScheduleSummary";
import DayShiftEditor from "./components/DayShiftEditor";

import { useDelivererSchedule } from "./hooks/useDelivererSchedule";
import { useScheduleEditor } from "./hooks/useScheduleEditor";
import { useAutoPlanNextMonth } from "./hooks/useAutoPlanNextMonth";

export default function DelivererSchedulePage() {
    /** 1) Load current month schedule (no month flipping) */
    const {
        year,
        month,
        monthKey,
        activeBitmap,
        standByBitmap,
        isLoading,
        isFetching,
        isError,
        error,
        refetch,
    } = useDelivererSchedule();

    /** 2) Wire the editor over the live bitmaps */
    const {
        daysInMonth,
        activeDraft,
        standByDraft,
        getShiftMode,
        setShiftMode,
        toggleShiftMode,
        hasChanges,
        isSaving,
        error: saveError,
        reset,
        save,
    } = useScheduleEditor({
        month: monthKey,
        activeBitmap,
        standByBitmap,
        onSaved: refetch,
    });

    /** 3) Auto-plan next month (disabled if next month already exists) */
    const {
        nextMonthKey,
        canPlanNextMonth,
        isChecking,
        isPlanning,
        planError,
        planNextMonth,
    } = useAutoPlanNextMonth({ monthKey });

    /** 4) Local UI state for opening the per-day editor */
    const [selectedDay, setSelectedDay] = React.useState<number | null>(null);
    const isEditorOpen = selectedDay !== null;

    const handleOpenDay = (day: number) => setSelectedDay(day);
    const handleCloseDay = () => setSelectedDay(null);

    const topError = isError ? error : planError || saveError;

    return (
        <Container maxW="6xl" py="6">
            {/* Header */}
            <ScheduleHeader
                year={year}
                month={month}
                canPlanNextMonth={!!canPlanNextMonth}
                isCheckingPlanable={isChecking}
                isPlanning={isPlanning}
                onPlanNextMonth={planNextMonth}
            />

            {/* Top-level error banner (load / plan / save) */}
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
                {/* Summary section (Today + Upcoming) */}
                {isLoading ? (
                    <HStack gap="4">
                        <Skeleton h="140px" flex="1" borderRadius="md" />
                        <Skeleton h="140px" flex="1" borderRadius="md" display={{ base: "none", md: "block" }} />
                    </HStack>
                ) : (
                    <ScheduleSummary
                        year={year}
                        month={month}
                        activeBitmap={activeDraft}
                        standByBitmap={standByDraft}
                        onDayClick={handleOpenDay}
                    />
                )}

                <Separator />

                {/* Legend + Grid */}
                {isLoading ? (
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
                            activeBitmap={activeDraft}
                            standByBitmap={standByDraft}
                            onDayClick={handleOpenDay}
                        />
                    </Stack>
                )}
            </Stack>

            {/* Per-day editor drawer */}
            {isEditorOpen && (
                <DayShiftEditor
                    isOpen={isEditorOpen}
                    onClose={handleCloseDay}
                    day={selectedDay!}
                    month={month}
                    year={year}
                    getShiftMode={getShiftMode}
                    setShiftMode={setShiftMode}
                    toggleShiftMode={toggleShiftMode}
                    hasChanges={hasChanges}
                    isSaving={isSaving}
                    error={saveError}
                    onSave={save}
                    onReset={reset}
                />
            )}
        </Container>
    );
}
