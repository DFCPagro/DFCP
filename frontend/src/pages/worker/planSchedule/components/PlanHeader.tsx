import * as React from "react";
import {
    Box,
    HStack,
    Heading,
    Text,
    Badge,
    Button,
    Spacer,
    Icon,
} from "@chakra-ui/react";
import { ChevronLeft } from "lucide-react";

export type PlanHeaderProps = {
    /** Target month key in 'YYYY-MM' format (e.g., '2025-12') */
    monthKey: string;
    /** Called when the user clicks Back to main schedule */
    onBack: () => void;
    /** Optional subtitle under the title (e.g., role name, LC name, timezone) */
    subLabel?: string;
    /** Optional slot for right-side actions (e.g., Save/Validate, Clear, etc.) */
    rightExtra?: React.ReactNode;
};

function formatMonthLabel(monthKey: string): string {
    // Safe parse 'YYYY-MM' → Date
    const [y, m] = monthKey.split("-").map((v) => parseInt(v, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
    const d = new Date(y, (m - 1) as number, 1);
    return new Intl.DateTimeFormat("en", {
        month: "long",
        year: "numeric",
    }).format(d);
}

export default function PlanHeader({
    monthKey,
    onBack,
    subLabel,
    rightExtra,
}: PlanHeaderProps) {
    const label = formatMonthLabel(monthKey);

    return (
        <HStack w="full" align="center" gap="4">
            <Button size="sm" variant="ghost" onClick={onBack}>
                <Icon as={ChevronLeft} />
                Back
            </Button>

            <HStack gap="3">
                <Heading size="lg">Plan Next Month</Heading>
                <Badge borderRadius="md" px="2" py="0.5" variant="subtle">
                    {label}
                </Badge>
            </HStack>

            {subLabel ? (
                <Text color="fg.subtle" fontSize="sm">
                    {subLabel}
                </Text>
            ) : null}

            <Spacer />

            {rightExtra ?? null}
        </HStack>
    );
}
