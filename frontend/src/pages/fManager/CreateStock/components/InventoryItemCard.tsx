// src/pages/CreateStock/components/InventoryItemCard.tsx
// Single inventory item card with a compact "table" and a [Submit order] button.
// Columns (per product decision): farmerId | lastUpdated | agreementAmountKg | currentAvailableAmountKg
// - "forecasted" is intentionally omitted for now.
// - Button is disabled when available <= 0 and while submitting.
//
// TODO(i18n): Consider formatting numbers and dates with date-fns/Intl options based on locale.
// TODO(style): If you prefer a real <Table>, swap the layout to Chakra Table primitives.

import { memo, useMemo } from "react";
import {
    Box,
    Stack,
    HStack,
    Text,
    Button,
    Separator,
    Badge,
} from "@chakra-ui/react";
import type { FarmerInventoryItem } from "../types";

export type InventoryItemCardProps = {
    item: FarmerInventoryItem;
    isSubmitting?: boolean;
    onSubmit: () => void;
};

function formatDateTime(iso?: string): string {
    if (!iso) return "—";
    // Browser-local formatting; replace with date-fns if you need stricter control.
    try {
        const d = new Date(iso);
        // Example: 2025-10-24 13:15
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${y}-${m}-${day} ${hh}:${mm}`;
    } catch {
        return iso;
    }
}

function NumberCell({ value, unit = "kg" }: { value: number | undefined; unit?: string }) {
    if (value === undefined || value === null) return <Text>—</Text>;
    // Round to whole kg for now; adjust to your precision needs.
    const n = Math.round(value);
    return (
        <Text>
            {n.toLocaleString()} {unit}
        </Text>
    );
}

function InventoryItemCardBase({ item, isSubmitting = false, onSubmit }: InventoryItemCardProps) {
    const disableSubmit = useMemo(
        () => (item.currentAvailableAmountKg ?? 0) <= 0 || isSubmitting,
        [item.currentAvailableAmountKg, isSubmitting]
    );

    return (
        <Box borderWidth="1px" borderRadius="lg" p="3" bg="bg" borderColor="border">
            <Stack gap="3">
                {/* Header: Item & Actions */}
                <HStack justify="space-between" align="center">
                    <HStack gap="2" wrap="wrap">
                        <Text fontWeight="semibold" fontSize="sm">
                            Item
                        </Text>
                        <Badge>{item.itemId}</Badge>
                    </HStack>

                    <Button
                        size="sm"
                        colorPalette="green"
                        onClick={onSubmit}
                        loading={isSubmitting}
                        disabled={disableSubmit}
                    >
                        Submit order
                    </Button>
                </HStack>

                <Separator />

                {/* “Table” grid */}
                <Stack gap="2">
                    <HStack justify="space-between" align="center">
                        <Text color="fg.muted" fontSize="sm">
                            Farmer
                        </Text>
                        <Text fontWeight="medium">{item.farmerId}</Text>
                    </HStack>

                    <HStack justify="space-between" align="center">
                        <Text color="fg.muted" fontSize="sm">
                            Last updated
                        </Text>
                        <Text fontWeight="medium">{formatDateTime(item.updatedAt)}</Text>
                    </HStack>

                    <HStack justify="space-between" align="center">
                        <Text color="fg.muted" fontSize="sm">
                            Agreement amount
                        </Text>
                        <Text fontWeight="medium">
                            <NumberCell value={item.agreementAmountKg} />
                        </Text>
                    </HStack>

                    <HStack justify="space-between" align="center">
                        <Text color="fg.muted" fontSize="sm">
                            Available for procurement
                        </Text>
                        <Text fontWeight="medium" color={(item.currentAvailableAmountKg ?? 0) <= 0 ? "red.500" : undefined}>
                            <NumberCell value={item.currentAvailableAmountKg} />
                        </Text>
                    </HStack>
                </Stack>
            </Stack>
        </Box>
    );
}

export const InventoryItemCard = memo(InventoryItemCardBase);
