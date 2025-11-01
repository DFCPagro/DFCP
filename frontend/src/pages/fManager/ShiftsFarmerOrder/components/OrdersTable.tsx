// src/pages/ShiftFarmerOrder/components/OrdersTable.tsx
import { memo, useState } from "react";
import { Box, Table, Text } from "@chakra-ui/react";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";
import { OrderRow } from "./OrderRow";

export type OrdersTableProps = {
    items: ShiftFarmerOrderItem[];
    /** Optional: click handler for row navigation */
    onRowClick?: (row: ShiftFarmerOrderItem) => void;
    /** Optional: handler for [view] action */
    onView?: (row: ShiftFarmerOrderItem) => void;
    /** Optional: table caption (visually hidden but useful for a11y) */
    caption?: string;
};

export const OrdersTable = memo(function OrdersTable({
    items,
    onRowClick,
    onView,
    caption = "Shift farmer orders",
}: OrdersTableProps) {
    if (!items?.length) {
        return (
            <Box borderWidth="1px" borderRadius="lg" p={3} bg="bg" borderColor="border">
                <Text color="fg.muted">No orders to display.</Text>
            </Box>
        );
    }

    // NEW: which row is expanded to show the inline FarmerOrderTimeline
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

    // Toggle expansion; also call external onRowClick if provided
    const handleRowClick = (r: ShiftFarmerOrderItem) => {
        const id =
            (r as any)._id ??
            `${(r as any).itemId ?? "item"}-${(r as any).farmerId ?? "farmer"}`;

        setExpandedRowId((prev) => (prev === id ? null : id));

        if (onRowClick) onRowClick(r);
    };

    return (
        <Table.Root
            size="sm"
            variant="outline"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="border"
            overflowX="auto"
        >
            <Table.Caption srOnly>{caption}</Table.Caption>

            <Table.Header>
                <Table.Row>
                    <Table.ColumnHeader>Farmer</Table.ColumnHeader>
                    <Table.ColumnHeader>Forecasted (kg)</Table.ColumnHeader>
                    <Table.ColumnHeader>Orders</Table.ColumnHeader>
                    <Table.ColumnHeader>Product</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                </Table.Row>
            </Table.Header>

            <Table.Body>
                {items.map((row) => {
                    const key =
                        (row as any)._id ??
                        `${(row as any).itemId ?? "item"}-${(row as any).farmerId ?? "farmer"}`;
                    return (
                        <OrderRow
                            key={key}
                            row={row}
                            variant="flat"
                            onRowClick={handleRowClick}
                            onView={onView}
                            isExpanded={expandedRowId === key}   // NEW
                        />
                    );
                })}
            </Table.Body>
        </Table.Root>
    );
});
