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
    Image,
    Avatar,
} from "@chakra-ui/react"
import type { FarmerInventoryItem, DemandStatisticsItem } from "@/types/farmerInventory"
import type { IsoDateString, ShiftEnum as Shift } from "@/types/shifts"
import { useCreateFarmerOrder } from "../hooks/useCreateFarmerOrder"
import { FiCheck } from "react-icons/fi"

export type InventoryItemCardProps = {
    itemId: string
    demand?: DemandStatisticsItem; // << single, optional
    rows: FarmerInventoryItem[]
    subtitle?: string
    formatFarmerId?: (id: string) => string
    shift?: Shift // "morning" | "afternoon" | "evening" | "night"
    pickUpDate?: IsoDateString // "YYYY-MM-DD"
}

// Put at module scope (recommended so we don't reallocate each call)
const FIRST_NAMES = [
    "Olive",
    "Sunny",
    "Green",
    "Golden",
    "Fresh",
    "Orchard",
    "River",
    "Meadow",
] as const;

const LAST_NAMES = [
    "Fields",
    "Acres",
    "Valley",
    "Grove",
    "Springs",
    "Ridge",
    "Farms",
] as const;

type FirstName = typeof FIRST_NAMES[number];
type LastName = typeof LAST_NAMES[number];

/** lightweight palette picker for Avatar color */
function pickPalette(seed?: string): string {
    const palettes = ["gray", "red", "orange", "yellow", "green", "teal", "blue", "cyan", "purple", "pink"]
    if (!seed) return palettes[0]
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    return palettes[h % palettes.length]!
}

function getFarmName(row: FarmerInventoryItem): string {
    // Use what's on the row if available
    const existing = (row as any)?.farmName;
    if (typeof existing === "string" && existing.trim()) return existing.trim();

    // Deterministic "random" name based on a stable row key
    const seedKey =
        (row as any)._id ??
        `${(row as any).itemId}:${(row as any).farmerUserId}:${(row as any).logisticCenterId}`;

    const hash = (s: string): number => {
        // Simple fast hash; returns unsigned 32-bit
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = (h * 31 + s.charCodeAt(i)) >>> 0;
        }
        return h;
    };

    const h = hash(String(seedKey));
    const first: FirstName = FIRST_NAMES[h % FIRST_NAMES.length]!;
    const last: LastName = LAST_NAMES[Math.floor(h / 97) % LAST_NAMES.length]!;
    return `${first} ${last}`;
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
    demand,
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

    const onSubmitRow = async (row: FarmerInventoryItem,) => {
        const rowKey = getRowKey(row)
        const raw = qtyByRow[rowKey]
        const parsed = typeof raw === "string" ? parseFloat(raw) : NaN
        const FarmerNameFake = getFarmName(row);

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
            type: demand.type,
            variety: demand.variety,
            pictureUrl: demand.imageUrl,
            farmName: (row as any).farmName,
            farmerName: (row as any).farmerName ?? FarmerNameFake,
            farmerId: (row as any).farmerUserId, // you confirmed this maps to backend farmerId
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
            totalAvail += Number((r as any).currentAvailableAmountKg ?? 0)
            const t = new Date((r as any).updatedAt ?? (r as any).createdAt).getTime()
            if (t > latest) latest = t
        }
        return {
            totalAvailableKg: totalAvail,
            latestUpdatedISO: latest ? new Date(latest).toLocaleString() : undefined,
        }
    }, [rows])

    const displayLabel = demand?.itemDisplayName || itemId
    const itemImageUrl = demand?.imageUrl
    const averageDemandQuantityKg = demand?.averageDemandQuantityKg

    return (
        <Box borderWidth="1px" borderRadius="lg" p="4" bg="bg" borderColor="border">
            <Stack gap="3">
                {/* Header */}
                <HStack justify="space-between" align="start" flexWrap="wrap" gap="2">
                    <HStack justify="space-between" align="start" flexWrap="wrap" gap="3">
                        <Stack gap="1">

                            {/* Item image to the right of the item name */}
                            {itemImageUrl ? (
                                <HStack>
                                    <Image
                                        src={itemImageUrl}
                                        alt={displayLabel}
                                        boxSize="64px"
                                        objectFit="cover"
                                        borderRadius="md"
                                    />
                                </HStack>
                            ) : (
                                // Graceful fallback: Avatar with initials from item name
                                <Avatar.Root colorPalette={pickPalette(displayLabel)}>
                                    <Avatar.Fallback name={displayLabel} />
                                </Avatar.Root>
                            )}
                        </Stack>

                        <Stack gap="1">
                            <HStack gap="2" flexWrap="wrap" align="center">
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
                    </HStack>


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
                <Table.Root size="sm" variant="line" width="full" height="fit-content">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeader>farm</Table.ColumnHeader>
                            <Table.ColumnHeader>last updated</Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">agreement</Table.ColumnHeader>
                            <Table.ColumnHeader textAlign="end">available</Table.ColumnHeader>
                            <Table.ColumnHeader width="260px">request (kg)</Table.ColumnHeader>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {rows.map((row) => {
                            const rowKey = getRowKey(row)

                            // New optional fields from backend (kept type-safe via any to avoid breaking existing types)
                            const farmLogo = row.farmLogo;
                            const farmName = getFarmName(row);
                            let displayFarmer = false;
                            if (farmLogo && farmLogo !== "none") displayFarmer = true;

                            const value = qtyByRow[rowKey] ?? ""
                            const parsed = value === "" ? NaN : parseFloat(value)
                            const invalidQty = !(Number.isFinite(parsed) && parsed > 0)
                            const pending = canCreate
                                ? isSubmitting({
                                    itemId,
                                    farmerId: (row as any).farmerUserId,
                                    pickUpDate: pickUpDate!,
                                    shift: shift!,
                                })
                                : false
                            const justSucceeded = successByRow[rowKey] && Date.now() - successByRow[rowKey] < 2200

                            return (
                                <Table.Row key={rowKey}>
                                    <Table.Cell>
                                        <HStack gap="3"  >
                                            {/* Farmer logo OR Avatar fallback */}
                                            {displayFarmer ? (
                                                <Image
                                                    src={farmLogo}
                                                    boxSize="28px"
                                                    objectFit="cover"
                                                    borderRadius="full"
                                                />
                                            ) : (
                                                <Avatar.Root colorPalette={pickPalette(farmName)}>
                                                    <Avatar.Fallback name={farmName ?? "Farmer"} />
                                                </Avatar.Root>
                                            )}

                                            <Stack gap="0">
                                                <Text fontSize="sm" fontWeight="medium">
                                                    {farmName ?? displayFarmer}
                                                </Text>
                                            </Stack>
                                        </HStack>
                                    </Table.Cell>

                                    <Table.Cell>{formatDateTime((row as any).updatedAt ?? (row as any).createdAt)}</Table.Cell>

                                    <Table.Cell textAlign="end">{fmtKg((row as any).agreementAmountKg)}</Table.Cell>

                                    <Table.Cell textAlign="end">
                                        <Text color={((row as any).currentAvailableAmountKg ?? 0) <= 0 ? "red.500" : undefined}>
                                            {fmtKg((row as any).currentAvailableAmountKg)}
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
