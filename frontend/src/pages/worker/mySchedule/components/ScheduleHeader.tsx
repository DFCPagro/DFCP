import * as React from "react";
import {
    Box,
    HStack,
    Heading,
    Text,
    Tooltip,
    Button,
    Badge,
    Spacer,
} from "@chakra-ui/react";
import { FiCalendar, FiPlay } from "react-icons/fi";

export type PlanStatus = "loading" | "can" | "submitted" | "error";

export type ScheduleHeaderProps = {
    /** Numeric year of the currently visible month, e.g. 2025 */
    year: number;
    /** Numeric month of the currently visible month, 1–12 */
    month: number;

    /** Click handler to navigate to the plan-next-month page (only called when allowed) */
    onPlanNextMonth: () => void;

    /** Current status of the next-month availability check */
    planStatus: PlanStatus;

    /** Tooltip content reflecting the planStatus */
    planTooltip: string;

    /** Whether the "Plan Next Month" button should be disabled */
    planDisabled: boolean;

    /** Optional: small label under the title (e.g., LC name / timezone) */
    subLabel?: string;

    /** Optional slots if the page wants to inject extra actions or tags */
    leftExtra?: React.ReactNode;
    rightExtra?: React.ReactNode;
};

function formatMonthYear(year: number, month: number): string {
    // month is 1–12 in our app, JS Date expects 0–11
    const d = new Date(year, month - 1, 1);
    return new Intl.DateTimeFormat("en", {
        month: "long",
        year: "numeric",
    }).format(d);
}

export default function ScheduleHeader({
    year,
    month,
    onPlanNextMonth,
    planStatus,
    planTooltip,
    planDisabled,
    subLabel,
    leftExtra,
    rightExtra,
}: ScheduleHeaderProps) {
    const label = formatMonthYear(year, month);

    return (
        <Box>
            <HStack align="center" gap="4">
                {/* Title + Month */}
                <HStack gap="3">
                    <Box as={FiCalendar} aria-hidden />
                    <Heading size="lg">My Schedule</Heading>
                </HStack>

                <Badge borderRadius="md" px="2" py="0.5" variant="subtle">
                    {label}
                </Badge>

                {subLabel ? (
                    <Text color="fg.subtle" fontSize="sm">
                        {subLabel}
                    </Text>
                ) : null}

                {leftExtra ?? null}

                <Spacer />

                {rightExtra ?? null}

                {/* Gate-aware "Plan Next Month" */}
                <Tooltip.Root openDelay={200}>
                    <Tooltip.Trigger asChild>
                        <Button
                            size="sm"
                            gap="2"
                            onClick={onPlanNextMonth}
                            loading={planStatus === "loading"}
                            loadingText="Checking"
                            disabled={planDisabled}
                        >
                            <Box as={FiPlay} aria-hidden />
                            Plan Next Month
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Positioner>
                        <Tooltip.Content>
                            <Tooltip.Arrow />
                            {planTooltip}
                        </Tooltip.Content>
                    </Tooltip.Positioner>
                </Tooltip.Root>
            </HStack>
        </Box>
    );
}
