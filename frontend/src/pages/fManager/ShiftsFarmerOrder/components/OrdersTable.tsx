// src/pages/ShiftFarmerOrder/components/OrdersTable.tsx
import { memo } from "react";
import { Box, Table, Text } from "@chakra-ui/react";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";
import { OrderRow } from "./OrderRow";

export type OrdersTableProps = {
    items: ShiftFarmerOrderItem[];
    /** Optional: click handler for row navigation (WIP default inside OrderRow) */
    onRowClick?: (row: ShiftFarmerOrderItem) => void;
    /** Optional: handler for [view] action (WIP default inside OrderRow) */
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
        // Keep empty state minimal; page-level handles loading/error per your plan
        return (
            <Box borderWidth="1px" borderRadius="lg" p={3} bg="bg" borderColor="border">
                <Text color="fg.muted">No orders to display.</Text>
            </Box>
        );
    }

    return (
        <Table.Root size="sm" variant="outline" borderRadius="lg" borderWidth="1px" borderColor="border" overflowX="auto">
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
                {items.map((row) => (
                    <OrderRow
                        key={(row as any)._id ?? `${row.itemId}-${row.farmerId ?? ""}`}
                        row={row}
                        variant="flat"
                        onRowClick={onRowClick}
                        onView={onView}
                    />
                ))}
            </Table.Body>
        </Table.Root>
    );
});
