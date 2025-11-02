// src/pages/ShiftFarmerOrder/components/OrderRow.tsx
import { memo, useMemo, useState, Fragment } from "react";
import {
    Badge,
    Button,
    HStack,
    Portal,
    Table,
    Text,
    Tooltip,
    VStack,
    Box,
} from "@chakra-ui/react";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";
import { FarmerOrderTimeline } from "./FarmerOrderTimeline";
import type { FarmerOrderStageKey } from "@/types/farmerOrders";

import { useAdvanceFarmerOrderStage } from "../hooks/useAdvanceFarmerOrderStage";

export type OrderRowProps = {
    row?: ShiftFarmerOrderItem;   // canonical
    item?: ShiftFarmerOrderItem;  // legacy alias
    variant?: "flat" | "grouped";
    defaultOpen?: boolean;
};

function getStatus(rec: ShiftFarmerOrderItem): string {
    return (rec as any)?.farmerStatus ?? (rec as any)?.status ?? "pending";
}
function statusToPalette(status: string): "green" | "yellow" | "red" {
    const s = String(status).toLowerCase();
    if (s === "ok") return "green";
    if (s === "problem") return "red";
    return "yellow";
}
function getColSpan(variant: "flat" | "grouped"): number {
    // Farmer | Forecasted | Orders | Product/Actions | Status  => 5 columns total
    return 5;
}

export const OrderRow = memo(function OrderRow({
    row,
    item,
    variant = "flat",
    defaultOpen = false,
}: OrderRowProps) {
    const record = row ?? item;
    const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

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

    const stageKey = (record as any)?.stageKey as string | null | undefined;
    const orderId = (record as any)?._id as string;
    const colSpan = getColSpan(variant);
    const ordersKG = (record as any)?.sumOrderedQuantityKg;

    // wire the advance-stage hook
    const { mutate: advanceStage, isPending: isAdvancing } = useAdvanceFarmerOrderStage();


    const handleView = (r: ShiftFarmerOrderItem) => {
        // eslint-disable-next-line no-console
        console.log("[OrderRow] view clicked:", (r as any)._id);
    };

    return (
        <Fragment>
            <Table.Row
                role="button"
                onClick={() => setIsOpen((v) => !v)}
                cursor="pointer"
                _hover={{ bg: "bg.muted" }}
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
                            {(record as any)?.orders?.length ?? 0} orders ({ordersKG} kg)
                        </Text>
                    </VStack>
                </Table.Cell>

                {/* Product (hidden in grouped) */}
                {variant === "flat" && (
                    <Table.Cell>
                        <Text>{productLabel}</Text>
                    </Table.Cell>
                )}

                {/* Status */}
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

                {/* Actions (grouped only) */}
                {variant === "grouped" && (
                    <Table.Cell>
                        <HStack gap="2">
                            <Button
                                size="xs"
                                variant="surface"
                                onClick={(e) => {
                                    e.stopPropagation();     // keep row from toggling
                                    handleView(record);      // <-- call internal handler
                                }}
                                aria-label="View order"
                            >
                                view
                            </Button>
                        </HStack>
                    </Table.Cell>
                )}
            </Table.Row>

            {/* Inline timeline */}
            {isOpen && (
                <Table.Row _hover={{ bg: "transparent" }}>
                    <Table.Cell colSpan={colSpan} p="0">
                        <Box px="4" py="3" bg="bg.subtle" borderTopWidth="1px" borderColor="border">
                            <FarmerOrderTimeline
                                stages={(row as any)?.stages}
                                stageKey={(row as any)?.stageKey}
                                compact
                                isAdvancing={isAdvancing}
                                onNextStage={(nextKey: FarmerOrderStageKey) => {
                                    // prevent row toggle handled inside component via stopPropagation
                                    advanceStage({
                                        orderId,
                                        key: nextKey,
                                        action: "setCurrent",
                                    });
                                }}
                            />
                        </Box>
                    </Table.Cell>
                </Table.Row>
            )}

        </Fragment>
    );
});
