import * as React from "react";
import {
    Box,
    Container,
    Stack,
    HStack,
    VStack,
    Text,
    Button,
    Badge,
    Alert,
    Separator,
    Skeleton,
    Icon,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, RotateCcw } from "lucide-react";

import PlanHeader from "./components/PlanHeader";
import PlanGrid from "./components/PlanGrid";
import { usePlannerState } from "./hooks/usePlannerState";
import { validatePlan, type DayError } from "./utils/validatePlan";

import {
    createMonthlySchedule,
    // If you have a typed enum, import it instead of using string literals
    // type ScheduleType,
} from "@/api/schedule";

// ---------- Helpers ----------

function parseMonthKey(monthKey: string | null): { year: number; jsMonthIdx: number } | null {
    if (!monthKey) return null;
    const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
    if (!m) return null;
    const year = Number(m[1]);
    const month1to12 = Number(m[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month1to12) || month1to12 < 1 || month1to12 > 12) return null;
    return { year, jsMonthIdx: month1to12 - 1 };
}

// ---------- Page ----------

export default function PlanSchedulePage() {
    const [params] = useSearchParams();
    const monthKey = params.get("month"); // 'YYYY-MM'
    const parsed = parseMonthKey(monthKey);

    const navigate = useNavigate();

    // Guard bad URL / missing month param
    React.useEffect(() => {
        if (!parsed) {
            toaster.create({ title: "Missing or invalid month", description: "Use /schedule/plan?month=YYYY-MM", type: "error" });

            navigate("/schedule", { replace: true });
        }
    }, [parsed, navigate]);

    if (!parsed) {
        // Lightweight skeleton while we redirect
        return (
            <Container maxW="6xl" py="6">
                <Skeleton h="40px" mb="4" />
                <Skeleton h="480px" />
            </Container>
        );
    }

    const { year, jsMonthIdx } = parsed;

    // We plan with 3 daily slots (Morning/Afternoon/Evening).
    // If you ever add "Night", pass slotCount: 4.
    const slotCount = 3;

    const {
        active,
        standby,
        toggle,
        clearAll,
        validateAll,
        validateDay,
        buildPayloads,
        totalSelected,
    } = usePlannerState({
        year,
        month: jsMonthIdx as any,
        slotCount,
        // If you ever prefill from API, pass initialActive/initialStandby here.
    });

    const [submitting, setSubmitting] = React.useState(false);
    const [lastErrors, setLastErrors] = React.useState<DayError[] | null>(null);

    const handleBack = React.useCallback(() => {
        navigate("/schedule");
    }, [navigate]);

    const handleSubmit = React.useCallback(async () => {
        // 1) Validate client-side (blocking)
        const result = validateAll();
        setLastErrors(result.errors.length ? result.errors : null);

        if (!result.ok) {
            toaster.create({
                title: "Please fix your plan",
                description: `${result.summary.invalidDayCount} day(s) have invalid selections.`,
                type: "warning",
            });
            return;
        }

        // 2) Build bitmaps for API
        const { active: activeBitmap, standBy: standByBitmap } = buildPayloads();

        // 3) Submit both types, workers-only, no overwrite
        try {
            setSubmitting(true);

            // Submit ACTIVE
            await createMonthlySchedule({
                month: monthKey as string,
                scheduleType: "active" as any, // if you have ScheduleType enum, use it
                bitmap: activeBitmap,
                overwriteExisting: false,
            });

            // Submit STANDBY
            await createMonthlySchedule({
                month: monthKey as string,
                scheduleType: "standBy" as any, // if you have ScheduleType enum, use it
                bitmap: standByBitmap,
                overwriteExisting: false,
            });

            toaster.create({
                title: "Schedule submitted",
                description: "Your next-month schedule was created successfully.",
                type: "success",
            });

            // 4) Back to main schedule page
            navigate("/schedule");
        } catch (err: any) {
            // Try to read a status code / message if your API client exposes it
            const msg = err?.message ?? "Something went wrong while submitting your plan.";
            const status = err?.status ?? err?.response?.status ?? null;

            if (status === 409) {
                toaster.create({
                    title: "Already submitted",
                    description: "A schedule already exists for this month.",
                    type: "info",
                });
            } else {
                toaster.create({
                    title: "Submit failed",
                    description: msg,
                    type: "error",
                });
            }
        } finally {
            setSubmitting(false);
        }
    }, [buildPayloads, monthKey, navigate, toaster, validateAll]);

    // Right-side header actions
    const headerRight = (
        <HStack gap="2">
            <Badge variant="surface" rounded="md" px="2">
                Active: {totalSelected.active}
            </Badge>
            <Badge variant="surface" rounded="md" px="2">
                Standby: {totalSelected.standby}
            </Badge>
            <Button size="sm" variant="outline" onClick={clearAll} disabled={submitting}>
                <Icon as={RotateCcw} />
                Clear
            </Button>
            <Button size="sm" colorPalette="green" onClick={handleSubmit} loading={submitting}>
                <Icon as={Check} />
                Validate & Submit
            </Button>
        </HStack>
    );

    // Per-page, non-blocking summary of last validation run
    const summary = React.useMemo(() => validatePlan({ active, standby }, { year, month: jsMonthIdx as any, slotCount }), [
        active,
        standby,
        year,
        jsMonthIdx,
        slotCount,
    ]);

    const showInlineErrors = lastErrors && lastErrors.length > 0;

    return (
        <Container maxW="6xl" py="6">
            <PlanHeader monthKey={monthKey!} onBack={handleBack} rightExtra={headerRight} />

            {showInlineErrors ? (
                <Alert.Root status="warning" mt="4" borderRadius="md">
                    <Alert.Indicator />
                    <Box>
                        <Alert.Title>Fix required</Alert.Title>
                        <Alert.Description>
                            <VStack align="start" gap="1" mt="2">
                                {lastErrors!.map((e) => (
                                    <Text key={e.day} fontSize="sm">
                                        • Day {e.day}: {e.messages.join(" ")}
                                    </Text>
                                ))}
                            </VStack>
                        </Alert.Description>
                    </Box>
                </Alert.Root>
            ) : null}

            <Stack mt="5" gap="5">
                <HStack justify="space-between">
                    <Text color="fg.subtle" fontSize="sm">
                        Select up to <b>2 Active</b> and up to <b>2 Standby</b> per day. If you select 2 of one type,
                        you may select at most 1 of the other type, and <b>no 3 consecutive</b> shifts in a day.
                    </Text>
                    <Badge variant={summary.ok ? "solid" : "surface"} colorPalette={summary.ok ? "green" : "red"} rounded="md" px="2">
                        {summary.ok ? "All valid" : `${summary.summary.invalidDayCount} invalid day(s)`}
                    </Badge>
                </HStack>

                <Separator />

                <PlanGrid
                    year={year}
                    month={jsMonthIdx as any}
                    active={active}
                    standby={standby}
                    onToggle={toggle}
                    validateDay={validateDay}
                    slotCount={slotCount}
                // slotLabels={["M", "A", "E"]} // optional override
                />
            </Stack>
        </Container>
    );
}
