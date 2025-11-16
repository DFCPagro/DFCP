import { memo, useMemo } from "react";
import {
    Box,
    HStack,
    VStack,
    Portal,
    Stack,
    Grid,
    GridItem,
    Text,
    Badge,
    Image,
    Separator,
    Code,
    Kbd,
    Dialog,
    Button,
    IconButton,
    Table,
    Avatar,
} from "@chakra-ui/react";
import { FiX, FiExternalLink, FiCheckCircle, FiInfo, FiAlertTriangle } from "react-icons/fi";
import {
    type ShiftFarmerOrderItem,
    FARMER_ORDER_STAGES,
    FARMER_ORDER_STAGE_LABELS,
    type FarmerOrderStage,
    type FarmerOrderStageKey,
} from "@/types/farmerOrders";
import AuditSection from "@/components/common/AuditSection";
import { formatDMY } from "@/utils/date";
/* --------------------------------- Props --------------------------------- */

export type ShiftFarmerOrderDetailsProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    row: ShiftFarmerOrderItem;
};

/* ------------------------------ Formatters -------------------------------- */

function fmtDate(d?: string | Date | null) {
    if (!d) return "—";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return "—";
    // Keep it plain & locale-friendly; you can centralize later
    return dt.toLocaleString();
}

function fmtKg(n?: number | null) {
    if (typeof n !== "number") return "—";
    return `${Number(n.toFixed(1))} kg`;
}

function compactId(id?: string) {
    if (!id) return "—";
    if (id.length <= 8) return id;
    return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

/* ------------------------------- Derivers --------------------------------- */

type StageVM = {
    key: FarmerOrderStageKey | string;
    label: string;
    status?: "pending" | "current" | "done" | "problem";
    at?: string | Date;
    by?: unknown;
    expectedAt?: string | Date;
    startedAt?: string | Date;
    completedAt?: string | Date;
    timestamp?: string | Date;
    note?: string;
};

function deriveStagesVM(row: ShiftFarmerOrderItem): StageVM[] {
    // Prefer provided stages; fall back to stageKey only
    const provided = (row.stages as FarmerOrderStage[] | undefined) ?? [];

    if (provided.length > 0) {
        // Merge with labels & order as defined in FARMER_ORDER_STAGES
        const labelByKey = FARMER_ORDER_STAGE_LABELS as Record<string, string>;
        // Keep declared order in FARMER_ORDER_STAGES first, then any unknowns at the end
        const known: StageVM[] = FARMER_ORDER_STAGES.map((s) => {
            const match = provided.find((p) => p.key === s.key);
            return {
                key: s.key,
                label: s.label,
                status: match?.status,
                expectedAt: match?.expectedAt,
                startedAt: match?.startedAt,
                completedAt: match?.completedAt,
                timestamp: match?.timestamp,
                note: match?.note,
            };
        });
        const unknowns = provided
            .filter((p) => !FARMER_ORDER_STAGES.find((s) => s.key === p.key))
            .map((p) => ({
                key: p.key,
                label: labelByKey[p.key as keyof typeof labelByKey] ?? p.key,
                status: p?.status,
                expectedAt: p?.expectedAt,
                startedAt: p?.startedAt,
                completedAt: p?.completedAt,
                timestamp: p?.timestamp,
                note: p.note,
            }));
        return [...known, ...unknowns];
    }

    // Fallback: synthesize from stageKey
    const cur = row.stageKey ?? null;
    return FARMER_ORDER_STAGES.map((s) => ({
        key: s.key,
        label: s.label,
        state: cur === s.key ? "current" : "pending",
    }));
}

function productLabel(row: ShiftFarmerOrderItem) {
    const t = row.type?.trim() ?? "";
    const v = row.variety?.trim() ?? "";
    return [t, v].filter(Boolean).join(" ") || "—";
}

function derivePictureUrl(row: ShiftFarmerOrderItem): string | undefined {
    const url = row.pictureUrl;
    if (!url) return undefined;
    console.log("[derivePictureUrl] :", url);
    try {
        // rudimentary check
        const u = new URL(url);
        return u.href;
    } catch {
        return undefined;
    }
}


function deriveInspectionBadges(row: ShiftFarmerOrderItem) {
    const ins = row.inspectionStatus as "pending" | "passed" | "failed" | undefined;
    const vi = row.visualInspection?.status as "ok" | "problem" | "pending" | undefined;
    return { inspectionStatus: ins, visualInspection: vi };
}

type QSCompareRow = {
    key: string; // metric key
    farmer?: unknown;
    inspection?: unknown;
    farmerGrade?: string;
    inspectionGrade?: string;
    differs: boolean;
};

type QSCompareVM = {
    rows: QSCompareRow[];
    overall: { farmer?: string; inspection?: string };
    meta: {
        farmerBy?: unknown;
        farmerAt?: string | Date;
        inspectionBy?: unknown;
        inspectionAt?: string | Date;
    };
};

function isSignificantDiff(a: unknown, b: unknown, tolerancePercent = 2): boolean {
    // If both are null/undefined → no diff
    if (a == null && b == null) return false;

    // If both are numbers, use relative percent difference
    if (typeof a === "number" && typeof b === "number") {
        if (!isFinite(a) || !isFinite(b)) return false;

        const maxAbs = Math.max(Math.abs(a), Math.abs(b));
        if (maxAbs === 0) return false; // both 0

        const diffPercent = (Math.abs(a - b) / maxAbs) * 100;
        return diffPercent > tolerancePercent;
    }

    // If only one is defined (number or not) → definitely different
    if (a == null || b == null) return true;

    // Fallback for non-numeric values
    return JSON.stringify(a) !== JSON.stringify(b);
}


function deriveQSComparison(row: ShiftFarmerOrderItem): QSCompareVM | null {
    const left = row.farmersQSreport;
    const right = row.inspectionQSreport;
    if (!left && !right) return null;

    const valueKeys = new Set<string>();
    const gradeKeys = new Set<string>();

    const leftValues = (left?.values ?? {}) as Record<string, unknown>;
    const rightValues = (right?.values ?? {}) as Record<string, unknown>;
    Object.keys(leftValues).forEach((k) => valueKeys.add(k));
    Object.keys(rightValues).forEach((k) => valueKeys.add(k));

    const leftGrades = (left?.perMetricGrades ?? {}) as Record<string, string>;
    const rightGrades = (right?.perMetricGrades ?? {}) as Record<string, string>;
    Object.keys(leftGrades).forEach((k) => gradeKeys.add(k));
    Object.keys(rightGrades).forEach((k) => gradeKeys.add(k));


    const allKeys = new Set<string>([...Array.from(valueKeys), ...Array.from(gradeKeys)]);

    const rows: QSCompareRow[] = Array.from(allKeys).map((k) => {

        const farmer = leftValues[k];
        const inspection = rightValues[k];
        const farmerGrade = leftGrades[k];
        const inspectionGrade = rightGrades[k];
        const valueDiffers =
            (farmer !== undefined || inspection !== undefined) &&
            isSignificantDiff(farmer, inspection, 2); // 2% threshold

        const gradeDiffers =
            (!!farmerGrade || !!inspectionGrade) &&
            farmerGrade !== inspectionGrade;

        const differs = valueDiffers || gradeDiffers;


        return { key: k, farmer, inspection, farmerGrade, inspectionGrade, differs };
    });

    return {
        rows,
        overall: {
            farmer: left?.overallGrade ? String(left.overallGrade) : undefined,
            inspection: right?.overallGrade ? String(right.overallGrade) : undefined,
        },
        meta: {
            farmerBy: left?.byUserId,
            farmerAt: left?.timestamp,
            inspectionBy: right?.byUserId,
            inspectionAt: right?.timestamp,
        },
    };
}

/* -------------------------------- Badges ---------------------------------- */

function StatusBadge({ status }: { status?: string }) {
    if (!status) return <Badge variant="subtle">—</Badge>;
    switch (status) {
        case "ok":
        case "passed":
            return (
                <Badge colorPalette="green" variant="subtle" display="inline-flex" alignItems="center" gap={1}>
                    <FiCheckCircle />
                    {status}
                </Badge>
            );
        case "problem":
        case "failed":
            return (
                <Badge colorPalette="red" variant="subtle" display="inline-flex" alignItems="center" gap={1}>
                    <FiAlertTriangle />
                    {status}
                </Badge>
            );
        case "pending":
            return (
                <Badge colorPalette="gray" variant="subtle" display="inline-flex" alignItems="center" gap={1}>
                    <FiInfo />
                    {status}
                </Badge>
            );
        default:
            return <Badge variant="subtle">{status}</Badge>;
    }
}

/* ------------------------------- Subviews --------------------------------- */

function SummaryCard({ row }: { row: ShiftFarmerOrderItem }) {
    const imgUrl = derivePictureUrl(row);
    const FLogo = row.farmLogo ?? undefined;
    const label = productLabel(row);
    const { inspectionStatus, visualInspection } = deriveInspectionBadges(row);

    const forecast = row.forecastedQuantityKg ?? row.forcastedQuantityKg;

    return (
        <Grid
            templateColumns={{ base: "1fr", md: "1fr 1fr" }}
            gap={4}
            w="full"
            borderWidth="1px"
            borderRadius="xl"
            p={4}
            bg="bg.panel"
        >
            <GridItem>
                <HStack align="flex-start" gap={4}>
                    <Box w="72px" h="72px" borderRadius="lg" overflow="hidden" bg="bg.muted" flex="0 0 auto">
                        {imgUrl ? (
                            <Image alt={label} src={imgUrl} w="full" h="full" objectFit="cover" />
                        ) : null}
                    </Box>
                    <VStack align="flex-start" gap={1} minW={0}>
                        <Text fontSize="lg" fontWeight="semibold" lineClamp={1}>
                            {label}
                        </Text>
                        <HStack wrap="wrap" gap={2}>
                            {row.shift && <Badge variant="surface">Shift: {row.shift}</Badge>}
                            {row.pickUpDate && <Badge variant="surface">Pick-up: {row.pickUpDate}</Badge>}
                            <HStack gap={2}>
                                <Text fontSize="sm" color="fg.muted">
                                    Inspection:
                                </Text>
                                <StatusBadge status={inspectionStatus} />
                            </HStack>
                            {visualInspection && (
                                <HStack gap={2}>
                                    <Text fontSize="sm" color="fg.muted">
                                        Visual:
                                    </Text>
                                    <StatusBadge status={visualInspection} />
                                </HStack>
                            )}
                        </HStack>
                        <HStack gap={4} wrap="wrap" mt={1}>
                            <Text fontSize="sm" color="fg.subtle">
                                Forecast: <Kbd>{fmtKg(forecast)}</Kbd>
                            </Text>
                            <Text fontSize="sm" color="fg.subtle">
                                Final: <Kbd>{fmtKg(row.finalQuantityKg)}</Kbd>
                            </Text>
                        </HStack>
                    </VStack>
                </HStack>
            </GridItem>

            <GridItem>
                <VStack align="flex-start" gap={1}>
                    <HStack wrap="wrap" gap={3}>
                        <Text fontSize="md" fontWeight="medium">
                            Farmer
                        </Text>
                        {FLogo &&
                            <Avatar.Root size="sm">
                                <Avatar.Image src={FLogo} alt={row.farmerName ?? "farmer"} />
                            </Avatar.Root>
                        }
                    </HStack>

                    <HStack wrap="wrap" gap={3}>
                        <Badge variant="subtle">{row.farmerName || "—"}</Badge>
                        <Text color="fg.subtle">Farm:</Text>
                        <Badge variant="surface">{row.farmName || "—"}</Badge>
                    </HStack>
                    <HStack wrap="wrap" gap={3} mt={2}>
                        {row.logisticCenterId && (
                            <>
                                <Text color="fg.subtle">LC:</Text>
                                <Code>{compactId(row.logisticCenterId)}</Code>
                            </>
                        )}
                    </HStack>
                    <HStack wrap="wrap" gap={3} mt={2}>
                        {row.createdAt && (
                            <Text color="fg.muted" fontSize="sm">
                                Created: {formatDMY(row.createdAt)}
                            </Text>
                        )}
                        {row.updatedAt && (
                            <Text color="fg.muted" fontSize="sm">
                                Updated: {formatDMY(row.updatedAt)}
                            </Text>
                        )}
                    </HStack>
                </VStack>
            </GridItem>
        </Grid>
    );
}




// optional helper if you want consistent fallback
function formatMaybeDate(value?: string | Date | null) {
    if (!value) return "-";

    const d = typeof value === "string" ? new Date(value) : value;
    if (isNaN(d.getTime())) return "-";

    // Local time, HH:MM (e.g. 12:30)
    return d.toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
    });
}


function StagesSection({ row }: { row: ShiftFarmerOrderItem }) {
    const stages = useMemo(() => deriveStagesVM(row), [row])

    if (!stages || stages.length === 0) {
        return (
            <Box borderWidth="1px" borderRadius="xl" p={4} bg="bg.panel">
                <Text fontSize="md" fontWeight="medium" mb={2}>
                    Stages
                </Text>
                <Text fontSize="sm" color="fg.subtle">
                    No stages data available.
                </Text>
            </Box>
        )
    }

    return (
        <Box borderWidth="1px" borderRadius="xl" p={4} bg="bg.panel">
            <HStack justifyContent="space-between" alignItems="center" mb={3}>
                <Text fontSize="md" fontWeight="medium">
                    Stages
                </Text>
            </HStack>

            <Table.Root size="sm" variant="outline" showColumnBorder>
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeader>Stage</Table.ColumnHeader>
                        <Table.ColumnHeader>Start time</Table.ColumnHeader>
                        <Table.ColumnHeader>Completed time</Table.ColumnHeader>
                        <Table.ColumnHeader>Expected time</Table.ColumnHeader>
                        <Table.ColumnHeader>Status</Table.ColumnHeader>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {stages.map((s) => (
                        <Table.Row key={s.key}>
                            <Table.Cell>
                                <Text fontWeight="medium">{s.label}</Text>
                            </Table.Cell>
                            <Table.Cell>
                                <Code fontSize="xs">
                                    {formatMaybeDate((s as any).startedAt)}
                                </Code>
                            </Table.Cell>
                            <Table.Cell>
                                <Code fontSize="xs">
                                    {formatMaybeDate((s as any).completedAt)}
                                </Code>
                            </Table.Cell>
                            <Table.Cell>
                                <Code fontSize="xs">
                                    {formatMaybeDate((s as any).expectedAt)}
                                </Code>
                            </Table.Cell>
                            <Table.Cell>
                                <StatusBadge status={s.status} />
                            </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </Box>
    )
}


function QSCompareSection({ row }: { row: ShiftFarmerOrderItem }) {
    const vm = useMemo(() => deriveQSComparison(row), [row]);
    if (!vm) return null;

    const rowsWithoutRejectionRate = vm.rows.filter((r) => r.key !== "rejectionRate");

    const lcRejectionRate =
        vm.rows.map((r) => (r.key === "rejectionRate" ? r.inspection as number : null)).find((v) => v !== null) ?? null;
    return (
        <Box borderWidth="1px" borderRadius="xl" p={4} bg="bg.panel">
            <Text fontSize="md" fontWeight="medium" mb={3}>
                QS Reports
            </Text>

            {/* Meta strip */}
            <HStack gap={6} wrap="wrap" mb={3}>
                <HStack gap={2}>
                    <Text color="fg.subtle">Overall (Farmer):</Text>
                    <StatusBadge status={vm.overall.farmer || undefined} />
                </HStack>
                <HStack gap={2}>
                    <Text color="fg.subtle">Overall (Inspection):</Text>
                    <StatusBadge status={vm.overall.inspection || undefined} />
                </HStack>
                <Separator orientation="vertical" />
                <HStack gap={2}>
                    <Text color="fg.subtle">Farmer :</Text>
                    <Code>{fmtDate(vm.meta.farmerAt as any)}</Code>
                </HStack>
                <HStack gap={2}>
                    <Text color="fg.subtle">Inspection at :</Text>
                    <Code>{fmtDate(vm.meta.inspectionAt as any)}</Code>
                </HStack>
            </HStack>

            {/* Values comparison table */}
            <Box overflowX="auto">
                <Table.Root size="sm" variant="outline" showColumnBorder>
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeader minW="200px">Metric</Table.ColumnHeader>
                            <Table.ColumnHeader>Farmer</Table.ColumnHeader>
                            <Table.ColumnHeader>Inspection</Table.ColumnHeader>
                            <Table.ColumnHeader>Grades</Table.ColumnHeader>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {rowsWithoutRejectionRate.map((r) => (
                            <Table.Row key={r.key} >
                                <Table.Cell>
                                    <Code>{r.key}</Code>
                                </Table.Cell>
                                <Table.Cell bg={r.differs ? "yellow.50" : undefined}>
                                    {r.farmer === undefined ? (
                                        <Text color="fg.muted">—</Text>
                                    ) : (
                                        <Text>{String(r.farmer)}</Text>
                                    )}
                                </Table.Cell>
                                <Table.Cell bg={r.differs ? "yellow.50" : undefined}>
                                    {r.inspection === undefined ? (
                                        <Text color="fg.muted">—</Text>
                                    ) : (
                                        <Text>{String(r.inspection)}</Text>
                                    )}
                                </Table.Cell>
                                <Table.Cell>
                                    <HStack gap={2}>
                                        <Badge variant="subtle">F: {r.farmerGrade || "—"}</Badge>
                                        <Badge variant="subtle">I: {r.inspectionGrade || "—"}</Badge>
                                    </HStack>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table.Root>
            </Box>

            {/* LC rejection rate summary */}
            {lcRejectionRate !== null && (
                <HStack mt={3}>
                    <Text color="fg.subtle">LC rejectionRate:</Text>
                    <Badge>
                        {lcRejectionRate.toFixed(1)}%
                    </Badge>
                </HStack>
            )}
        </Box>
    );
}


function VisualInspectionCard({ row }: { row: ShiftFarmerOrderItem }) {
    const vi = row.visualInspection;
    const status = row.inspectionStatus as "pending" | "passed" | "failed" | undefined;

    if (!vi && !status) return null;

    return (
        <HStack
            align="stretch"
            gap={4}
            borderWidth="1px"
            borderRadius="xl"
            p={4}
            bg="bg.panel"
            wrap="wrap"
        >
            <VStack align="flex-start" gap={1} minW="220px">
                <Text fontWeight="medium">Inspection Status</Text>
                <StatusBadge status={status} />
            </VStack>
            {vi && (
                <>
                    <Separator orientation="vertical" />
                    <VStack align="flex-start" gap={1} minW="220px">
                        <Text fontWeight="medium">Visual Inspection</Text>
                        <HStack gap={2}>
                            <Text color="fg.subtle">Status:</Text>
                            <StatusBadge status={vi.status} />
                        </HStack>
                        {vi.note && (
                            <Text fontSize="sm" color="fg.muted" whiteSpace="pre-wrap">
                                {vi.note}
                            </Text>
                        )}
                        <Text fontSize="sm" color="fg.subtle">
                            {fmtDate(vi.timestamp as any)}
                        </Text>
                    </VStack>
                </>
            )}
        </HStack>
    );
}

function ContainersOrdersSection({ row }: { row: ShiftFarmerOrderItem }) {
    const hasContainers = Array.isArray(row.containers) && row.containers.length > 0;
    const hasOrders = Array.isArray(row.orders) && row.orders.length > 0;
    if (!hasContainers && !hasOrders) return null;

    return (
        <Grid templateColumns={{ base: "1fr", md: hasContainers && hasOrders ? "1fr 1fr" : "1fr" }} gap={4}>
            {hasContainers && (
                <Box borderWidth="1px" borderRadius="xl" p={4} bg="bg.panel">
                    <Text fontSize="md" fontWeight="medium" mb={3}>
                        Containers
                    </Text>
                    <VStack align="stretch" gap={2}>
                        {row.containers!.map((c: any, idx) => (
                            <HStack key={idx} justify="space-between" borderWidth="1px" borderRadius="lg" p={2}>
                                <HStack gap={3}>
                                    <Badge variant="surface">{c.type || "—"}</Badge>
                                    <Text color="fg.subtle">× {c.count ?? "—"}</Text>
                                </HStack>
                                <Text>{c.estWeightKg ? `${c.estWeightKg} kg` : "—"}</Text>
                            </HStack>
                        ))}
                    </VStack>
                </Box>
            )}
        </Grid>
    );
}

/* --------------------------------- Main ----------------------------------- */

export const ShiftFarmerOrderDetails = memo(function ShiftFarmerOrderDetails({
    open,
    onOpenChange,
    row,
}: ShiftFarmerOrderDetailsProps) {
    const qsExists = !!row.farmersQSreport || !!row.inspectionQSreport;

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
                <Dialog.Positioner zIndex={1400}>

                    <Dialog.Content maxW="900px">
                        <Dialog.Header>
                            <HStack justify="space-between" align="center" w="full">
                                <Dialog.Title>Farmer Order · <Code>{compactId(row._id)}</Code></Dialog.Title>
                                <Dialog.CloseTrigger asChild>
                                    <IconButton aria-label="Close" variant="ghost" size="sm">
                                        <FiX />
                                    </IconButton>
                                </Dialog.CloseTrigger>
                            </HStack>

                        </Dialog.Header>

                        <Dialog.Body>
                            <Stack gap={4}>
                                <SummaryCard row={row} />

                                <VisualInspectionCard row={row} />

                                {qsExists && <QSCompareSection row={row} />}

                                <ContainersOrdersSection row={row} />

                                <StagesSection row={row} />

                                {/* Audit section (as-is) */}
                                <Box borderWidth="1px" borderRadius="xl" p={4} bg="bg.panel">
                                    <AuditSection
                                        title="Audit Trail"
                                        items={
                                            ((row as any).audit ??
                                                (row as any).auditTrail ??
                                                (row as any).historyAuditTrail ??
                                                []) as any[]
                                        }
                                        map={(ev: any) => ({
                                            action: ev.action ?? ev.type ?? ev.event ?? "—",
                                            note: ev.note ?? ev.message ?? "",
                                            by: ev.by ?? ev.userName ?? ev.user ?? "system",
                                            at: ev.at ?? ev.createdAt ?? ev.timestamp ?? new Date(),
                                        })}
                                    />

                                </Box>
                            </Stack>
                        </Dialog.Body>

                        <Dialog.Footer>
                            <HStack w="full" justify="flex-end">
                                <Dialog.CloseTrigger asChild>
                                    <Button variant="subtle">Close</Button>
                                </Dialog.CloseTrigger>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root >
    );
});

export default ShiftFarmerOrderDetails;
