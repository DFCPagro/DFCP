// Group card for a single itemId:
// - Header shows item display name and demand statistic (averageDemandQuantityKg)
// - Table rows list all farmer inventory records sharing this itemId
// - Each row has an input (kg) + Submit button that calls the real create farmer order API
//
// Notes:
// - Shift & pickUpDate come from the PAGE context/props (canonical selection).
// - Minimal FE validation: require finite positive kg, require shift & pickUpDate.
// - Disable only the specific row's Submit when its request is pending.
// - IDs are shortened for display via the provided formatter (fallback to first 8 chars).
//
// TODO(i18n): use Intl for number/date formatting as needed.
// TODO(UX): consider virtualization if groups become very large.

import { memo, useMemo, useState } from "react"
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
    Icon,
} from "@chakra-ui/react"
import type { FarmerInventoryItem } from "@/types/farmerInventory"
import type { IsoDateString, Shift } from "@/types/farmerOrders"
import { useCreateFarmerOrder } from "../hooks/useCreateFarmerOrder"
import { FiCheck } from "react-icons/fi"

export type InventoryItemCardProps = {
    /** The grouped item id */
    itemId: string
    /** Optional display name for the item (preferred label) */
    itemDisplayName?: string
    /** Demand statistic for this item (average kg) */
    averageDemandQuantityKg?: number
    /** All farmer inventory rows that share this itemId */
    rows: FarmerInventoryItem[]
    /** Optional subtitle (e.g., latest update meta) */
    subtitle?: string
    /** Optional formatter for farmer ids (e.g., shorten) */
    formatFarmerId?: (id: string) => string

    /** Canonical selection from page/init (required to create orders) */
    shift?: Shift // "morning" | "afternoon" | "evening" | "night"
    pickUpDate?: IsoDateString // "YYYY-MM-DD"
}

function formatDateTime(iso?: string): string {
    if (!iso) return "—"
    try {
        const d = new Date(iso)
        return d.toLocaleString() // browser locale
    } catch {
        return iso
    }
}

function fmtKg(n?: number | null): string {
    if (n === null || n === undefined || Number.isNaN(n)) return "—"
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " kg"
}

function shortIdDefault(id: string, len = 8): string {
    if (!id) return ""
    return id.slice(0, len)
}

function getRowKey(row: FarmerInventoryItem): string {
    // Prefer _id if present; otherwise compose a stable-ish key
    return (row as any)._id ?? `${row.itemId}:${row.farmerUserId}:${row.logisticCenterId}`
}

function InventoryItemCardBase({
    itemId,
    itemDisplayName,
    averageDemandQuantityKg,
    rows,
    subtitle,
    formatFarmerId,
    shift,
    pickUpDate,
}: InventoryItemCardProps) {
    // Local per-row input state (map rowKey -> string)
    const [qtyByRow, setQtyByRow] = useState<Record<string, string>>({})
    // Local per-row ephemeral success flag (to flash a tiny check)
    const [successByRow, setSuccessByRow] = useState<Record<string, number>>({}) // value = timestamp

    const { create, isSubmitting } = useCreateFarmerOrder()

    const onChangeQty = (rowKey: string, v: string) => {
        setQtyByRow((s) => ({ ...s, [rowKey]: v }))
    }

    const canCreate = Boolean(shift && pickUpDate)

    const onSubmitRow = async (row: FarmerInventoryItem) => {
        const rowKey = getRowKey(row)
        const raw = qtyByRow[rowKey]
        const parsed = typeof raw === "string" ? parseFloat(raw) : NaN

        if (!canCreate) {
            // eslint-disable-next-line no-console
            console.warn("[CreateFarmerOrder] Missing shift or pickUpDate from page context.")
            return
        }
        if (!Number.isFinite(parsed) || parsed <= 0) {
            // eslint-disable-next-line no-console
            console.warn("[CreateFarmerOrder] Invalid forcastedQuantityKg value:", raw)
            return
        }

        // Build request matching backend contract
        const req = {
            itemId,
            farmerId: row.farmerUserId, // you confirmed this maps to backend farmerId
            shift: shift!, // safe due to canCreate check
            pickUpDate: pickUpDate!, // safe due to canCreate check
            forcastedQuantityKg: parsed,
        }

        try {
            await create(req)
            // Optionally clear the input for that row
            setQtyByRow((s) => ({ ...s, [rowKey]: "" }))
            // Flash a success indicator for this row
            setSuccessByRow((s) => ({ ...s, [rowKey]: Date.now() }))
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[CreateFarmerOrder] Failed:", err)
        }
    }

    // Aggregate optional quick stats (not required, but helps in header)
    const groupMeta = useMemo(() => {
        let totalAvail = 0
        let latest = 0
        for (const r of rows) {
            totalAvail += Number(r.currentAvailableAmountKg ?? 0)
            const t = new Date(r.updatedAt ?? r.createdAt).getTime()
            if (t > latest) latest = t
        }
        return {
            totalAvailableKg: totalAvail,
            latestUpdatedISO: latest ? new Date(latest).toLocaleString() : undefined,
        }
    }, [rows])

    const displayLabel = itemDisplayName || itemId

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
                            const rowKey = getRowKey(row)
                            const displayFarmer =
                                (formatFarmerId ? formatFarmerId(row.farmerUserId) : shortIdDefault(row.farmerUserId)) ||
                                row.farmerUserId
                            const value = qtyByRow[rowKey] ?? ""
                            const parsed = value === "" ? NaN : parseFloat(value)
                            const invalidQty = !(Number.isFinite(parsed) && parsed > 0)
                            const pending = canCreate
                                ? isSubmitting({ itemId, farmerId: row.farmerUserId, pickUpDate: pickUpDate!, shift: shift! })
                                : false
                            const justSucceeded = successByRow[rowKey] && Date.now() - successByRow[rowKey] < 2200

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
                                        <HStack gap="2" align="center">
                                            <Input
                                                type="number"
                                                inputMode="decimal"
                                                placeholder="kg"
                                                value={value}
                                                onChange={(e) => onChangeQty(rowKey, e.target.value)}
                                                aria-label="request quantity in kg"
                                                aria-invalid={value !== "" && invalidQty}
                                            />
                                            <Button
                                                onClick={() => onSubmitRow(row)}
                                                size="sm"
                                                colorPalette="green"
                                                disabled={!canCreate || pending || invalidQty}
                                            >
                                                {pending ? "Submitting…" : "Submit"}
                                            </Button>
                                            {justSucceeded ? <Icon as={FiCheck} color="green.500" aria-label="Created" /> : null}
                                        </HStack>
                                    </Table.Cell>
                                </Table.Row>
                            )
                        })}
                    </Table.Body>
                </Table.Root>
            </Stack>
        </Box>
    )
}

export const InventoryItemCard = memo(InventoryItemCardBase)
