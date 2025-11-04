// src/pages/ShiftFarmerOrder/components/ShiftFarmerOrderDetails.tsx
import { memo } from "react";
import {
    Box,
    Button,
    Dialog,
    HStack,
    Portal,
    Text,
    VStack,
} from "@chakra-ui/react";
import OrderAuditSection from "@/components/common/OrderAuditSection";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";

/* --------------------------------- Types --------------------------------- */

export type ShiftFarmerOrderDetailsProps = {
    /** Full row as received by the Orders table/list */
    row: ShiftFarmerOrderItem;
    /** Controlled open flag (keep control in OrderRow) */
    open: boolean;
    /** Controlled state updater (keep control in OrderRow) */
    onOpenChange: (open: boolean) => void;
    /** Optional: override dialog max width */
    maxW?: string | number;
    /** Optional: zIndex override for the portal positioner */
    zIndex?: number;
};

/* -------------------------- Local helper functions ------------------------ */

function shortIdLocal(id?: string, n: number = 8) {
    if (!id || typeof id !== "string") return "—";
    if (id.length <= n) return id;
    return id.slice(0, n);
}

/** Derive a human-friendly product label from the row (fallbacks baked in). */
function getProductLabel(r: any): string {
    const productLabel = [r?.type, r?.variety].filter(Boolean).join(" ");
    return productLabel ?? "-";
}

/** Extract an audit trail array from various possible row shapes. */
function getAuditFromRow(r: any) {
    const src = r?.audit ?? r?.auditTrail ?? r?.historyAuditTrail ?? [];
    return Array.isArray(src) ? src : [];
}

/** Farmer display name (farmerName or farmer.name) */
function getFarmerName(r: any): string {
    return r?.farmerName ?? "—";
}

/** Farm name, if available */
function getFarmName(r: any): string {
    return r?.farmName ?? "—";
}

/** Extract the canonical order id string */
function getOrderId(r: any): string | undefined {
    return r?._id ?? undefined;
}

/* --------------------------------- Component ------------------------------ */

export const ShiftFarmerOrderDetails = memo(function ShiftFarmerOrderDetails({
    row,
    open,
    onOpenChange,
    maxW = "720px",
    zIndex = 1400,
}: ShiftFarmerOrderDetailsProps) {
    const orderId = getOrderId(row);
    const productLabel = getProductLabel(row);
    const farmerName = getFarmerName(row);
    const farmName = getFarmName(row);
    const audit = getAuditFromRow(row);

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(e) => {
                // Chakra v3 fires { open: boolean }
                if (!e.open) onOpenChange(false);
            }}
        >
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner zIndex={zIndex}>
                    <Dialog.Content maxW={maxW}>
                        <Dialog.Header >
                            <HStack justify="space-between" w="full" >
                                <Dialog.Title>
                                    Farmer Order · {shortIdLocal(orderId, 8)}
                                </Dialog.Title>
                                <Button
                                    variant="solid"
                                    colorPalette="teal"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Close
                                </Button>
                            </HStack>

                            <Dialog.CloseTrigger />
                        </Dialog.Header>

                        <Dialog.Body>
                            <VStack align="stretch" gap="4">
                                {/* Tiny header snapshot from row */}
                                <Box>
                                    <Text fontWeight="medium">{farmerName}</Text>
                                    <Text color="fg.muted" fontSize="sm">
                                        {productLabel} · {farmName}
                                    </Text>
                                </Box>

                                {/* Audit section (reused) */}
                                <OrderAuditSection audit={audit} />
                            </VStack>
                        </Dialog.Body>

                        <Dialog.Footer>

                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
});

export default ShiftFarmerOrderDetails;
