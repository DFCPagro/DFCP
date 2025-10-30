// src/pages/CreateStock/components/CreateStockCard.tsx
// Create Stock picker card used ONLY on the CreateStock page.
// - Mirrors the Dashboard "Create Stock" card UX.
// - Inlines the row UI (no separate ShiftRow component).
// - When user clicks [Add], it appends ?date=YYYY-MM-DD&shift=<shift> to the current URL.
//
// TODO(data): Rows likely come from useManagerSummary (missing shifts). Wire that in the page.
// TODO(nav): If you later add a dedicated PATHS.createStock, you can navigate to that path explicitly.

import { memo, useCallback } from "react";
import {
    Box,
    Stack,
    Heading,
    Skeleton,
    Text,
    HStack,
    Button,
} from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
import { toaster } from "@/components/ui/toaster";
import type { ShiftRollup } from "@/types/farmerOrders";
import type { ShiftEnum as Shift } from "@/types/shifts";

export type CreateStockCardProps = {
    title?: string;
    /** Typically from useManagerSummary: missing shifts for which stock hasn't been initialized */
    rows: ShiftRollup[];
    loading?: boolean;
    /** Optional override to control what happens on [Add] */
    onAddShift?: (row: ShiftRollup) => void;
};

function titleCase(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Inline row UI (no external dependency on Dashboard's ShiftRow.tsx) */
function InlineShiftRow(props: {
    dateISO: string;
    shift: Shift; // "morning" | "afternoon" | "evening" | "night"
    canAdd: boolean;
    onAdd?: () => void;
}) {
    const { dateISO, shift, canAdd, onAdd } = props;
    return (
        <HStack
            justify="space-between"
            px="3"
            py="2"
            borderWidth="1px"
            borderRadius="md"
            w="full"
        >
            <Text fontSize="sm" fontWeight="medium">
                {dateISO} · {titleCase(shift)}
            </Text>
            <Button
                size="sm"
                colorPalette="green"
                onClick={onAdd}
                disabled={!canAdd}
            >
                Add
            </Button>
        </HStack>
    );
}

function CreateStockCardBase({
    title = "Create Stock",
    rows,
    loading,
    onAddShift,
}: CreateStockCardProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const handleAdd = useCallback(
        (row: ShiftRollup) => {
            if (onAddShift) {
                onAddShift(row);
                return;
            }

            // Build URL using the current pathname, adding the encoded query params.
            // This mirrors the Dashboard "navigate with params" behavior.
            // TODO(nav): If you later want a different route, replace `location.pathname` accordingly.
            const search = new URLSearchParams();
            search.set("date", row.date);
            search.set("shift", row.shiftName);

            navigate({
                pathname: location.pathname,
                search: `?${search.toString()}`,
            });

            toaster.create({
                type: "info",
                title: "Opening Create Stock",
                description: `Opening ${row.date} · ${row.shiftName}`,
                duration: 1500,
            });
        },
        [location.pathname, navigate, onAddShift]
    );

    return (
        <Box borderWidth="1px" borderColor="border" rounded="lg" p="4" bg="bg" w="full">
            <Stack gap="4">
                <Heading size="md">{title}</Heading>

                {loading ? (
                    <Stack gap="2">
                        <Skeleton h="10" />
                        <Skeleton h="10" />
                        <Skeleton h="10" />
                    </Stack>
                ) : rows.length === 0 ? (
                    <Text color="fg.muted">
                        All current & upcoming shifts already have stock initialized.
                    </Text>
                ) : (
                    <Stack gap="2">
                        {rows.map((row) => (
                            <InlineShiftRow
                                key={`${row.date}__${row.shiftName}`}
                                dateISO={row.date}
                                shift={row.shiftName}
                                canAdd={true}             // These are the "missing" shifts, so add is enabled
                                onAdd={() => handleAdd(row)}
                            />
                        ))}
                    </Stack>
                )}
            </Stack>
        </Box>
    );
}

export const CreateStockCard = memo(CreateStockCardBase);
