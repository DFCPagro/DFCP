// src/pages/ShiftFarmerOrder/components/OrderList.tsx
// Grouped view for Shift Farmer Orders, mirroring the Inventory list pattern.
//
// - Groups rows by itemId.
// - Groups with at least one status === "problem" are sorted to the top.
// - Within each group, rows with status === "problem" are listed first,
//   then the rest by updatedAt desc (fallback to createdAt).
// - Uses OrderRow in variant="grouped" so the product cell is hidden and a [view] button is shown.
// - Manages an expanded row id so clicking a row reveals an inline timeline under that row.
//
// TODO(UX): If you later standardize columns across flat/grouped modes,
//           add a compact <Thead> here to match OrderRow's <Td>s for accessibility.

import { memo, useMemo, useState } from "react";
import {
    Box,
    Stack,
    HStack,
    Text,
    Badge,
    Separator,
    Table,
} from "@chakra-ui/react";
import { OrderRow } from "./OrderRow";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";

export type OrderListProps = {
    /** Flat orders array to group by itemId */
    items: ShiftFarmerOrderItem[];

    /** Optional override for group labels, given the group's rows */
    renderGroupTitle?: (groupRows: ShiftFarmerOrderItem[]) => React.ReactNode;
};

// src/pages/ShiftFarmerOrder/components/OrderList.tsx
// (Use the fixed version I sent earlier, but remove expandedRowId state and the handleRowClick)


export const OrderList = memo(function OrderList({
    items,
    renderGroupTitle,
}: OrderListProps) {
    const groups = useMemo(() => groupByItemId(items), [items]);

    const sortedGroups = useMemo(() => {
        return [...groups].sort((a, b) => {
            const aHasProblem = groupHasProblem(a[1]);
            const bHasProblem = groupHasProblem(b[1]);
            if (aHasProblem && !bHasProblem) return -1;
            if (!aHasProblem && bHasProblem) return 1;
            const aLabel = computeGroupLabel(a[1]).toLowerCase();
            const bLabel = computeGroupLabel(b[1]).toLowerCase();
            return aLabel.localeCompare(bLabel);
        });
    }, [groups]);

    if (!items?.length) return null;

    return (
        <Stack gap={4}>
            {sortedGroups.map(([itemId, rows]) => {
                const hasProblem = groupHasProblem(rows);
                const title = renderGroupTitle ? renderGroupTitle(rows) : computeGroupLabel(rows);
                const sortedRows = sortRowsProblemFirstThenUpdatedDesc(rows);

                return (
                    <Box key={itemId} borderWidth="1px" borderRadius="lg" p={3} bg="bg" borderColor="border">
                        <HStack justify="space-between" align="center">
                            <HStack gap={2}>
                                <Text fontWeight="semibold" fontSize="lg">{title}</Text>
                                <Badge variant="solid" colorPalette="blue">{sortedRows.length} orders</Badge>
                                {hasProblem && <Badge variant="solid" colorPalette="red">problem</Badge>}
                            </HStack>
                        </HStack>

                        <Separator my={3} />

                        <Table.Root size="sm" variant="outline">
                            <Table.Body>
                                {sortedRows.map((row) => (
                                    <OrderRow
                                        key={(row as any)._id ?? `${(row as any).itemId ?? "item"}-${(row as any).farmerId ?? "farmer"}`}
                                        row={row}
                                        variant="grouped"
                                    />
                                ))}
                            </Table.Body>
                        </Table.Root>
                    </Box>
                );
            })}
        </Stack>
    );
});


/* --------------------------------- helpers -------------------------------- */

function groupByItemId(
    items: ShiftFarmerOrderItem[]
): Map<string, ShiftFarmerOrderItem[]> {
    const m = new Map<string, ShiftFarmerOrderItem[]>();
    for (const it of items ?? []) {
        const key = (it as any)?.itemId ?? "unknown";
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(it);
    }
    return m;
}

function groupHasProblem(rows: ShiftFarmerOrderItem[]): boolean {
    return rows.some((r) => ((r as any)?.farmerStatus ?? (r as any)?.status) === "problem");
}

function toTime(s?: string | Date): number {
    if (!s) return 0;
    const t = typeof s === "string" ? Date.parse(s) : (s as Date).getTime?.();
    return Number.isFinite(t as number) ? (t as number) : 0;
}

function sortRowsProblemFirstThenUpdatedDesc(
    rows: ShiftFarmerOrderItem[]
): ShiftFarmerOrderItem[] {
    return [...rows].sort((a, b) => {
        const aProblem = ((a as any)?.farmerStatus ?? (a as any)?.status) === "problem";
        const bProblem = ((b as any)?.farmerStatus ?? (b as any)?.status) === "problem";
        if (aProblem && !bProblem) return -1;
        if (!aProblem && bProblem) return 1;

        const aTime = toTime((a as any)?.updatedAt) || toTime((a as any)?.createdAt);
        const bTime = toTime((b as any)?.updatedAt) || toTime((b as any)?.createdAt);
        return bTime - aTime; // desc (newest first)
    });
}

/**
 * Tries to compute a human label for a group from its rows.
 * Prefers itemDisplayName if present; otherwise falls back to a composited label.
 */
function computeGroupLabel(rows: ShiftFarmerOrderItem[]): string {
    const first = rows[0];
    const byDisplay =
        (first as any)?.itemDisplayName ||
        (first as any)?.productName ||
        undefined;

    if (byDisplay) return String(byDisplay);

    // Attempt compositing from optional fields commonly found in catalog-like data
    const type = (first as any)?.type;
    const variety = (first as any)?.variety;
    const category = (first as any)?.category;

    const parts = [category, type, variety].filter(Boolean);
    if (parts.length) return parts.join(" · ");

    // Final fallback
    return "Item " + ((first as any)?.itemId ?? "—");
}
