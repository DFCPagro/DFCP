import * as React from "react";
import {
    Box,
    Table,
    HStack,
    Text,
    Badge,
    Button,
    Tooltip,
    Card,
} from "@chakra-ui/react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { MonthIndex } from "@/utils/bitMapTranslator";
import type { SlotMatrix } from "../utils/validatePlan";

export type PlanGridProps = {
    /** Target year, e.g., 2025 */
    year: number;
    /** JS month index 0..11 */
    month: MonthIndex;

    /** Matrices sized [days][slotCount] */
    active: SlotMatrix;
    standby: SlotMatrix;

    /** Number of daily slots (>=3). If omitted, inferred from matrices. */
    slotCount?: number;

    /** Optional labels for slots (length must equal slotCount). Defaults: ["M","A","E"] or extends to 4 slots ["M","A","E","N"]. */
    slotLabels?: string[];

    /** Toggle handler from usePlannerState */
    onToggle: (type: "active" | "standby", dayIdx: number, slotIdx: number) => void;

    /** Per-day validator from usePlannerState */
    validateDay: (dayIdx: number) => { valid: boolean; codes: string[]; messages: string[] };
};

/** Local weekday formatter (Mon, Tue, …) */
function weekdayShort(year: number, month0: number, day1: number) {
    const d = new Date(year, month0, day1);
    return new Intl.DateTimeFormat("en", { weekday: "short" }).format(d);
}

function getSlotLabels(slotCount: number, custom?: string[]) {
    if (custom && custom.length === slotCount) return custom;
    if (slotCount === 3) return ["M", "A", "E"];
    if (slotCount === 4) return ["M", "A", "E", "N"];
    // Fallback: numeric labels
    return Array.from({ length: slotCount }, (_, i) => `S${i + 1}`);
}

function SectionHeader({ title }: { title: string }) {
    return (
        <HStack gap="2">
            <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
                {title}
            </Text>
        </HStack>
    );
}

/** A small pill-like toggle button with distinct palettes for active vs standby. */
function SlotToggle({
    isOn,
    label,
    onClick,
    palette,
    "aria-label": ariaLabel,
}: {
    isOn: boolean;
    label: string;
    onClick: () => void;
    palette: "active" | "standby";
    "aria-label": string;
}) {
    const scheme = palette === "active" ? "blue" : "orange";
    return (
        <Button
            size="xs"
            variant={isOn ? "solid" : "outline"}
            colorPalette={scheme}
            onClick={onClick}
            aria-label={ariaLabel}
            rounded="md"
        >
            {label}
        </Button>
    );
}

export default function PlanGrid({
    year,
    month,
    active,
    standby,
    slotCount: slotCountProp,
    slotLabels: slotLabelsProp,
    onToggle,
    validateDay,
}: PlanGridProps) {
    const days = Math.min(active.length, standby.length);
    const slotCount = React.useMemo(
        () => slotCountProp ?? Math.max(active[0]?.length ?? 0, standby[0]?.length ?? 0, 3),
        [slotCountProp, active, standby]
    );
    const labels = React.useMemo(() => getSlotLabels(slotCount, slotLabelsProp), [slotCount, slotLabelsProp]);

    return (
        <Card.Root>
            <Card.Body p="0">
                <Table.Root size="sm">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeader w="6rem">Date</Table.ColumnHeader>
                            <Table.ColumnHeader colSpan={slotCount}>
                                <SectionHeader title="Active" />
                            </Table.ColumnHeader>
                            <Table.ColumnHeader colSpan={slotCount}>
                                <SectionHeader title="Standby" />
                            </Table.ColumnHeader>
                            <Table.ColumnHeader w="6rem" textAlign="center">
                                Status
                            </Table.ColumnHeader>
                        </Table.Row>
                        <Table.Row>
                            <Table.ColumnHeader />
                            {/* Active slot headers */}
                            {labels.map((l, i) => (
                                <Table.ColumnHeader key={`ah-${i}`} textAlign="center">
                                    {l}
                                </Table.ColumnHeader>
                            ))}
                            {/* Standby slot headers */}
                            {labels.map((l, i) => (
                                <Table.ColumnHeader key={`sh-${i}`} textAlign="center">
                                    {l}
                                </Table.ColumnHeader>
                            ))}
                            <Table.ColumnHeader />
                        </Table.Row>
                    </Table.Header>

                    <Table.Body>
                        {Array.from({ length: days }, (_, dayIdx) => {
                            const day1 = dayIdx + 1;
                            const aRow = active[dayIdx] ?? [];
                            const sRow = standby[dayIdx] ?? [];
                            const { valid, messages } = validateDay(dayIdx);

                            return (
                                <Table.Row key={dayIdx} _hover={{ bg: "bg.subtle" }}>
                                    {/* Date cell */}
                                    <Table.Cell>
                                        <HStack gap="2">
                                            <Badge variant="surface" rounded="md" px="2">
                                                {day1}
                                            </Badge>
                                            <Text color="fg.subtle" fontSize="sm">
                                                {weekdayShort(year, month, day1)}
                                            </Text>
                                        </HStack>
                                    </Table.Cell>

                                    {/* Active toggles */}
                                    {Array.from({ length: slotCount }, (_, slotIdx) => {
                                        const on = Boolean(aRow[slotIdx]);
                                        return (
                                            <Table.Cell key={`a-${dayIdx}-${slotIdx}`} textAlign="center">
                                                <SlotToggle
                                                    isOn={on}
                                                    label={labels[slotIdx]}
                                                    palette="active"
                                                    onClick={() => onToggle("active", dayIdx, slotIdx)}
                                                    aria-label={`Day ${day1} active ${labels[slotIdx]}`}
                                                />
                                            </Table.Cell>
                                        );
                                    })}

                                    {/* Standby toggles */}
                                    {Array.from({ length: slotCount }, (_, slotIdx) => {
                                        const on = Boolean(sRow[slotIdx]);
                                        return (
                                            <Table.Cell key={`s-${dayIdx}-${slotIdx}`} textAlign="center">
                                                <SlotToggle
                                                    isOn={on}
                                                    label={labels[slotIdx]}
                                                    palette="standby"
                                                    onClick={() => onToggle("standby", dayIdx, slotIdx)}
                                                    aria-label={`Day ${day1} standby ${labels[slotIdx]}`}
                                                />
                                            </Table.Cell>
                                        );
                                    })}

                                    {/* Status */}
                                    <Table.Cell textAlign="center">
                                        {valid ? (
                                            <HStack justify="center" gap="1">
                                                <Box as={CheckCircle2} aria-hidden />
                                                <Text fontSize="xs" color="fg.subtle">
                                                    OK
                                                </Text>
                                            </HStack>
                                        ) : (
                                            <Tooltip.Root openDelay={150}>
                                                <Tooltip.Trigger asChild>
                                                    <Badge colorPalette="red" rounded="md" px="2" cursor="help">
                                                        <HStack gap="1">
                                                            <Box as={AlertTriangle} aria-hidden />
                                                            <Text fontSize="xs">Invalid</Text>
                                                        </HStack>
                                                    </Badge>
                                                </Tooltip.Trigger>
                                                <Tooltip.Positioner>
                                                    <Tooltip.Content>
                                                        <Tooltip.Arrow />
                                                        <Box>
                                                            {messages.map((m, i) => (
                                                                <Text key={i} fontSize="sm">
                                                                    • {m}
                                                                </Text>
                                                            ))}
                                                        </Box>
                                                    </Tooltip.Content>
                                                </Tooltip.Positioner>
                                            </Tooltip.Root>
                                        )}
                                    </Table.Cell>
                                </Table.Row>
                            );
                        })}
                    </Table.Body>
                </Table.Root>
            </Card.Body>
        </Card.Root>
    );
}
