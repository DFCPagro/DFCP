import { memo, useMemo, useState, useEffect } from "react"
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
import { formatDMY } from "@/utils/date";
import { useSubmittedOrders } from "../hooks/useSubmittedOrders";
import type { SubmittedLine } from "../shared/submittedOrders.shared";


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

    // Build submitted-orders context from page props + first row's LC
    const lcId = (rows[0] as any)?.logisticCenterId ?? (rows[0] as any)?.lcId ?? "";
    const submittedCtx = useMemo(
        () => ({
            date: pickUpDate ?? "",
            shift: (shift as any) ?? "",
            logisticCenterId: String(lcId),
        }),
        [pickUpDate, shift, lcId]
    );
    const { isSubmitted, add, lines } = useSubmittedOrders(submittedCtx);

    // --- Equal split suggestions (ceil), excluding already-submitted rows ---
    const groupDemandKg = Number(demand?.averageDemandQuantityKg ?? 0);
    // Sum of quantities already submitted from this card (by rowKey)
    const alreadySubmittedTotal = useMemo(() => {
        let sum = 0;
        for (const l of lines) {
            if (l.itemId === itemId) sum += Number(l.qtyKg ?? 0);
        }
        return sum;
    }, [lines, itemId]);


    const remainingDemandKg = Math.max(
        0,
        Math.ceil(Number.isFinite(groupDemandKg) ? groupDemandKg : 0) - Math.floor(alreadySubmittedTotal)
    );



    const equalSuggestions = useMemo(() => {
        if (!remainingDemandKg || !Number.isFinite(remainingDemandKg) || remainingDemandKg <= 0) return {};

        // Eligible = not yet submitted AND has positive availability (if provided)
        const eligible = rows.filter((r) => {
            const k = getRowKey(r);
            if (isSubmitted(k)) return false;
            const raw = (r as any).currentAvailableAmountKg;
            const avail = raw == null ? NaN : Number(raw);
            // include if availability is missing (NaN) or > 0
            return !Number.isFinite(avail) || avail > 0;
        });


        const n = eligible.length;
        if (n === 0) return {};

        const perShare = Math.ceil(remainingDemandKg / n);

        const out: Record<string, string> = {};
        for (const r of eligible) {
            const k = getRowKey(r);
            const avail = Number((r as any).currentAvailableAmountKg ?? Infinity);
            // If availability is known, cap to it (rounded down to integer kg)
            const cap = Number.isFinite(avail) ? Math.max(0, Math.floor(avail)) : Infinity;
            const suggested = Math.max(0, Math.min(perShare, cap | 0)) | 0;
            out[k] = String(suggested);

        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, isSubmitted, remainingDemandKg]);


    useEffect(() => {
        if (!remainingDemandKg) return;
        setQtyByRow((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const [rowKey, suggested] of Object.entries(equalSuggestions)) {
                const cur = next[rowKey];
                if (cur === undefined || cur === "") {
                    next[rowKey] = suggested;
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [itemId, remainingDemandKg, equalSuggestions]);




    const { create, isSubmitting } = useCreateFarmerOrder()
    const onChangeQty = (rowKey: string, v: string) => {
        setQtyByRow((s) => ({ ...s, [rowKey]: v }))
    }

    const canCreate = Boolean(shift && pickUpDate)

    const onSubmitRow = async (row: FarmerInventoryItem) => {
        const rowKey = getRowKey(row);
        const raw = qtyByRow[rowKey];
        const parsed = typeof raw === "string" ? parseFloat(raw) : NaN;
        const farmerNameResolved = (row as any).farmerName ?? getFarmName(row);
        const farmNameResolved = (row as any).farmName;

        if (!canCreate || !submittedCtx.logisticCenterId) {
            console.warn("[CreateFarmerOrder] Missing shift/pickUpDate/logisticCenterId from page context.");
            return;
        }
        if (!Number.isFinite(parsed) || parsed <= 0) {
            console.warn("[CreateFarmerOrder] Invalid forcastedQuantityKg value:", raw);
            return;
        }

        // Confirmation prompt
        const itemLabel =
            (demand?.itemDisplayName || itemId) +
            (demand?.variety ? ` / ${demand?.variety}` : "");
        const confirmMsg =
            `From: ${farmNameResolved || "Unknown farm"}\n` +
            `Item: ${itemLabel}\n` +
            `Amount: ${parsed} kg\n\n` +
            `Submit this order?`;
        const ok = window.confirm(confirmMsg);
        if (!ok) return;

        // Server request
        const req = {
            itemId,
            type: demand?.type,
            variety: demand?.variety,
            pictureUrl: demand?.imageUrl,
            farmName: farmNameResolved,
            farmerName: farmerNameResolved,
            farmerId: (row as any).farmerUserId, // maps to backend farmerId
            shift: shift!,        // safe due to canCreate
            pickUpDate: pickUpDate!, // safe due to canCreate
            forcastedQuantityKg: parsed,
        };

        try {
            await create(req);

            // Persist to submitted-orders store (allows duplicates per your spec)
            const line: SubmittedLine = {
                key: rowKey,
                itemId,
                type: demand?.type ?? undefined,
                variety: demand?.variety ?? undefined,
                imageUrl: demand?.imageUrl ?? undefined,
                farmerId: (row as any).farmerUserId,
                farmerName: farmerNameResolved,
                farmName: farmNameResolved,
                qtyKg: parsed,
                groupDemandKg: demand.averageDemandQuantityKg,
                submittedAt: new Date().toISOString(),
            };
            add(line);

            // Clear the input and show success flash
            setQtyByRow((s) => ({ ...s, [rowKey]: "" }));
            setSuccessByRow((s) => ({ ...s, [rowKey]: Date.now() }));
        } catch (err) {
            console.error("[CreateFarmerOrder] Failed:", err);
        }
    };


    // Aggregate optional quick stats (not required, but helps in header)
    const groupMeta = useMemo(() => {
        let totalAvail = 0
        let latest = ""
        for (const r of rows) {
            totalAvail += Number((r as any).currentAvailableAmountKg ?? 0)
            latest = formatDMY((r as any).updatedAt ?? "-")
        }
        return {
            totalAvailableKg: totalAvail,
            latestUpdatedISO: latest,
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
                                <Text fontWeight="semibold" fontSize="md">
                                    {displayLabel}
                                </Text>
                            </HStack>

                            <Text fontSize="md" color="fg">
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
                        <Text fontSize="s" color="fg">
                            total available
                        </Text>
                        <Text fontSize="md" >{fmtKg(groupMeta.totalAvailableKg)}</Text>

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

                                    <Table.Cell>{formatDMY((row as any).updatedAt ?? (row as any).createdAt)}</Table.Cell>

                                    <Table.Cell textAlign="end">{fmtKg((row as any).agreementAmountKg)}</Table.Cell>

                                    <Table.Cell textAlign="end">
                                        <Text color={((row as any).currentAvailableAmountKg ?? 0) <= 0 ? "red.500" : undefined}>
                                            {fmtKg((row as any).currentAvailableAmountKg)}
                                        </Text>
                                    </Table.Cell>

                                    <Table.Cell>
                                        {(() => {
                                            const alreadySubmitted = isSubmitted(rowKey);

                                            return (
                                                <HStack gap="2" align="center">
                                                    <Input
                                                        type="number"
                                                        inputMode="decimal"
                                                        placeholder="kg"
                                                        value={value}
                                                        onChange={(e) => onChangeQty(rowKey, e.target.value)}
                                                        aria-label="request quantity in kg"
                                                        aria-invalid={value !== "" && invalidQty}
                                                        disabled={alreadySubmitted}         // lock input after submission
                                                        readOnly={alreadySubmitted}
                                                    />

                                                    {alreadySubmitted ? (
                                                        <Button size="sm" disabled variant="subtle">
                                                            Submitted
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            onClick={() => onSubmitRow(row)}
                                                            size="sm"
                                                            colorPalette="green"
                                                            disabled={!canCreate || pending || invalidQty}
                                                        >
                                                            {pending ? "Submitting…" : "Submit"}
                                                        </Button>
                                                    )}

                                                    {justSucceeded ? (
                                                        <Icon as={FiCheck} color="green.500" aria-label="Created" />
                                                    ) : null}
                                                </HStack>
                                            );
                                        })()}

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
