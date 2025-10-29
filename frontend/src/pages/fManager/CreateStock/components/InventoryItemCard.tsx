// src/pages/CreateStock/components/InventoryItemCard.tsx
// Group card for a single itemId:
// - Header shows item display name and demand statistic (averageDemandQuantityKg)
// - Table rows list all farmer inventory records sharing this itemId
// - Each row has an input (kg) + Submit button that logs a WIP payload
//
// Notes:
// - No calls to useCreateFarmerOrder here (WIP only).
// - No UI limits for quantity as requested (we allow empty/any number).
// - IDs are shortened for display via the provided formatter (fallback to first 8 chars).
//
// TODO(i18n): use Intl for number/date formatting as needed.
// TODO(UX): consider virtualization if groups become very large.

import { memo, useMemo, useState } from "react";
import {
    Box,
    Stack,
    HStack,
    Text,
    Badge,
    Separator,
    Table,
    Input,
    Button,
} from "@chakra-ui/react";
import type { FarmerInventoryItem } from "@/types/farmerInventory";

export type InventoryItemCardProps = {
    /** The grouped item id */
    itemId: string;
    /** Optional display name for the item (preferred label) */
    itemDisplayName?: string;
    /** Demand statistic for this item (average kg) */
    averageDemandQuantityKg?: number;
    /** All farmer inventory rows that share this itemId */
    rows: FarmerInventoryItem[];
    /** Optional subtitle (e.g., latest update meta) */
    subtitle?: string;
    /** Optional formatter for farmer ids (e.g., shorten) */
    formatFarmerId?: (id: string) => string;
};

function formatDateTime(iso?: string): string {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return d.toLocaleString(); // browser locale
    } catch {
        return iso;
    }
}

function fmtKg(n?: number | null): string {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    // 0 or a number; we’ll show up to 1 decimal for readability
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " kg";
}

function shortIdDefault(id: string, len = 8): string {
    if (!id) return "";
    return id.slice(0, len);
}

function getRowKey(row: FarmerInventoryItem): string {
    // Prefer _id if present; otherwise compose a stable-ish key
    return (row as any)._id ?? `${row.itemId}:${row.farmerUserId}:${row.logisticCenterId}`;
}

function InventoryItemCardBase({
    itemId,
    itemDisplayName,
    averageDemandQuantityKg,
    rows,
    subtitle,
    formatFarmerId,
}: InventoryItemCardProps) {
    // Local per-row input state (map rowKey -> string)
    const [qtyByRow, setQtyByRow] = useState<Record<string, string>>({});

    const onChangeQty = (rowKey: string, v: string) => {
        setQtyByRow((s) => ({ ...s, [rowKey]: v }));
    };

    const onSubmitRow = (row: FarmerInventoryItem) => {
        const rowKey = getRowKey(row);
        const raw = qtyByRow[rowKey];
        const parsed = typeof raw === "string" ? parseFloat(raw) : NaN;

        // WIP console log only (as requested)
        // eslint-disable-next-line no-console
        console.log("WIP submit", {
            itemId,
            itemDisplayName,
            averageDemandQuantityKg,
            inventoryRowId: (row as any)._id ?? null,
            farmerUserId: row.farmerUserId,
            logisticCenterId: row.logisticCenterId,
            // we include both raw string and parsed float for flexibility
            quantityKgRaw: raw ?? "",
            quantityKg: Number.isFinite(parsed) ? parsed : null,
            // misc for debugging
            agreementAmountKg: row.agreementAmountKg ?? null,
            currentAvailableAmountKg: row.currentAvailableAmountKg ?? null,
            updatedAt: row.updatedAt ?? null,
            createdAt: row.createdAt ?? null,
            _debug: "no API call yet; this is just a WIP console log",
        });
    };

    // Aggregate optional quick stats (not required, but helps in header)
    const groupMeta = useMemo(() => {
        let totalAvail = 0;
        let latest = 0;
        for (const r of rows) {
            totalAvail += Number(r.currentAvailableAmountKg ?? 0);
            const t = new Date(r.updatedAt ?? r.createdAt).getTime();
            if (t > latest) latest = t;
        }
        return {
            totalAvailableKg: totalAvail,
            latestUpdatedISO: latest ? new Date(latest).toLocaleString() : undefined,
        };
    }, [rows]);

    const displayLabel = itemDisplayName || itemId;

    return (
        <Box borderWidth="1px" borderRadius="lg" p="4" bg="bg" borderColor="border">
            <Stack gap="3">
                {/* Header */}
                <HStack justify="space-between" align="start" flexWrap="wrap" gap="2">
                    <Stack gap="1">
                        <HStack gap="2" flexWrap="wrap">
                            <Text fontWeight="semibold" fontSize="sm">
                                item:
                            </Text>
                            <Badge>{displayLabel}</Badge>
                        </HStack>
                        <Text fontSize="sm" color="fg.muted">
                            demand statistic ={" "}
                            {averageDemandQuantityKg !== undefined && averageDemandQuantityKg !== null
                                ? `${averageDemandQuantityKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
                                : "—"}
                        </Text>
                        {subtitle ? (
                            <Text fontSize="xs" color="fg.muted">
                                {subtitle}
                            </Text>
                        ) : null}
                    </Stack>

                    <Stack gap="0" align="end" minW="200px">
                        <Text fontSize="xs" color="fg.muted">
                            total available (all farmers)
                        </Text>
                        <Text fontWeight="medium">{fmtKg(groupMeta.totalAvailableKg)}</Text>
                        {groupMeta.latestUpdatedISO ? (
                            <Text fontSize="xs" color="fg.muted">
                                latest update: {groupMeta.latestUpdatedISO}
                            </Text>
                        ) : null}
                    </Stack>
                </HStack>

                <Separator />

                {/* Farmers table (Chakra v3 slot API) */}
                <Table.Root size="sm" variant="line" width="full">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeader>farmer</Table.ColumnHeader>
                            <Table.ColumnHeader>last updated</Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">agreement</Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">available</Table.ColumnHeader>
                            <Table.ColumnHeader width="260px">request (kg)</Table.ColumnHeader>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {rows.map((row) => {
                            const rowKey = getRowKey(row);
                            const displayFarmer =
                                (formatFarmerId ? formatFarmerId(row.farmerUserId) : shortIdDefault(row.farmerUserId)) || row.farmerUserId;
                            const value = qtyByRow[rowKey] ?? "";

                            return (
                                <Table.Row key={rowKey}>
                                    <Table.Cell>
                                        <HStack gap="2">
                                            <Badge>{displayFarmer}</Badge>
                                            <Text fontSize="xs" color="fg.muted" title={row.farmerUserId}>
                                                {row.farmerUserId}
                                            </Text>
                                        </HStack>
                                    </Table.Cell>
                                    <Table.Cell>{formatDateTime(row.updatedAt ?? row.createdAt)}</Table.Cell>
                                    <Table.Cell textAlign="end">{fmtKg(row.agreementAmountKg)}</Table.Cell>
                                    <Table.Cell textAlign="end">
                                        <Text color={(row.currentAvailableAmountKg ?? 0) <= 0 ? "red.500" : undefined}>
                                            {fmtKg(row.currentAvailableAmountKg)}
                                        </Text>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <HStack gap="2">
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="kg"
                                                value={value}
                                                onChange={(e) => onChangeQty(rowKey, e.target.value)}
                                                aria-label="request quantity in kg"
                                            />
                                            <Button
                                                onClick={() => onSubmitRow(row)}
                                                // As requested: no limits; we do not disable for empty/invalid input
                                                size="sm"
                                                colorPalette="green"
                                            >
                                                Submit
                                            </Button>
                                        </HStack>
                                    </Table.Cell>
                                </Table.Row>
                            );
                        })}
                    </Table.Body>
                </Table.Root>
            </Stack>
        </Box>
    );
}

export const InventoryItemCard = memo(InventoryItemCardBase);
