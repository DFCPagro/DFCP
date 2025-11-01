// src/pages/ShiftFarmerOrder/components/OrderRow.tsx
import { memo, useMemo } from "react";
import {
    Badge,
    Button,
    HStack,
    Portal,
    Table,
    Text,
    Tooltip,
    VStack,
} from "@chakra-ui/react";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";

export type OrderRowProps = {
    /** ✅ New canonical prop */
    row?: ShiftFarmerOrderItem;

    /** ⛔️ Deprecated (kept for backward compatibility) */
    item?: ShiftFarmerOrderItem;

    /** Visual/behavioral mode. Flat = keep existing columns. Grouped = hide product cell, add [view] action. */
    variant?: "flat" | "grouped";

    /** Optional: click handler for row navigation (WIP by default) */
    onRowClick?: (row: ShiftFarmerOrderItem) => void;

    /** Optional: handler for [view] action in grouped mode (WIP by default) */
    onView?: (row: ShiftFarmerOrderItem) => void;

    /** Optional: disable pointer/click styles */
    isClickable?: boolean;
};

// We accept either 'farmerStatus' or 'status' on the record
function getStatus(rec: ShiftFarmerOrderItem): string {
    return (rec as any)?.farmerStatus ?? (rec as any)?.status ?? "pending";
}

// Map status → color palette safely (fallback to yellow)
function statusToPalette(status: string): "green" | "yellow" | "red" {
    const s = String(status).toLowerCase();
    if (s === "ok") return "green";
    if (s === "problem") return "red";
    return "yellow"; // pending/unknown
}

export const OrderRow = memo(function OrderRow({
    row,
    item, // deprecated
    variant = "flat",
    onRowClick,
    onView,
    isClickable = true,
}: OrderRowProps) {
    // Normalize to a single variable
    const record = row ?? item;
    if (!record) return null;

    const status = getStatus(record);
    const palette = statusToPalette(status);

    const productLabel = useMemo(() => {
        const t = (record as any)?.type?.trim?.();
        const v = (record as any)?.variety?.trim?.();
        if (t && v) return `${t} · ${v}`;
        if (t) return t;
        if (v) return v;
        return "—";
    }, [record]);

    const farmName =
        (record as any)?.farmName?.trim?.() ||
        (record as any)?.farmer?.farmName ||
        "—";

    // Default WIP handlers if not provided
    const handleRowClick =
        onRowClick ??
        ((r: ShiftFarmerOrderItem) => {
            // eslint-disable-next-line no-console
            console.log("wip", (r as any)._id);
        });

    const handleView =
        onView ??
        ((r: ShiftFarmerOrderItem) => {
            // eslint-disable-next-line no-console
            console.log("wip : order id", (r as any)._id);
        });

    const clickable = isClickable && Boolean(handleRowClick);

    return (
        <Table.Row
            role={clickable ? "button" : undefined}
            onClick={clickable ? () => handleRowClick(record) : undefined}
            cursor={clickable ? "pointer" : "default"}
            _hover={clickable ? { bg: "bg.muted" } : undefined}
            data-order-id={(record as any)._id}
        >
            {/* Farmer / Farm */}
            <Table.Cell>
                <VStack align="start" gap="0">
                    <Text fontWeight="semibold">
                        {(record as any)?.farmerName ?? (record as any)?.farmer?.name ?? "—"}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        {farmName}
                    </Text>
                </VStack>
            </Table.Cell>

            {/* Forecasted */}
            <Table.Cell>
                <VStack align="start" gap="0">
                    <Text fontWeight="semibold">
                        {(record as any)?.forcastedQuantityKg ?? (record as any)?.forecastedKg ?? 0} kg
                    </Text>
                </VStack>
            </Table.Cell>

            {/* Orders count */}
            <Table.Cell>
                <VStack align="start" gap="0">
                    <Text fontWeight="semibold">
                        {(record as any)?.orders?.length ?? 0} orders
                    </Text>
                </VStack>
            </Table.Cell>

            {/* Product (type / variety) — hidden in grouped mode */}
            {variant === "flat" && (
                <Table.Cell>
                    <Text>{productLabel}</Text>
                </Table.Cell>
            )}

            {/* Status badge */}
            <Table.Cell>
                <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                        <Badge variant="solid" colorPalette={palette} textTransform="capitalize">
                            {status}
                        </Badge>
                    </Tooltip.Trigger>
                    <Portal>
                        <Tooltip.Positioner>
                            <Tooltip.Content>Status: {status}</Tooltip.Content>
                        </Tooltip.Positioner>
                    </Portal>
                </Tooltip.Root>
            </Table.Cell>

            {/* Actions — only in grouped mode */}
            {variant === "grouped" && (
                <Table.Cell>
                    <HStack gap="2">
                        <Button
                            size="xs"
                            variant="surface"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleView(record);
                            }}
                            aria-label="View order"
                        >
                            view
                        </Button>
                    </HStack>
                </Table.Cell>
            )}
        </Table.Row>
    );
});
