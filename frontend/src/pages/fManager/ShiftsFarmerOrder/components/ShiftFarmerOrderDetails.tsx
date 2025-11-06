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
} from "@chakra-ui/react";
import { FiX, FiExternalLink, FiCheckCircle, FiInfo, FiAlertTriangle } from "react-icons/fi";
import {
    type ShiftFarmerOrderItem,
    FARMER_ORDER_STAGES,
    FARMER_ORDER_STAGE_LABELS,
    type FarmerOrderStage,
    type FarmerOrderStageKey,
} from "@/types/farmerOrders";
import OrderAuditSection from "@/components/common/AuditSection";
import { FarmerOrderTimeline } from "./FarmerOrderTimeline";

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
    state?: "pending" | "current" | "done" | "problem";
    at?: string | Date;
    by?: unknown;
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
                state: match?.state,
                at: match?.at,
                by: match?.by,
                note: match?.note,
            };
        });
        const unknowns = provided
            .filter((p) => !FARMER_ORDER_STAGES.find((s) => s.key === p.key))
            .map((p) => ({
                key: p.key,
                label: labelByKey[p.key as keyof typeof labelByKey] ?? p.key,
                state: p.state,
                at: p.at,
                by: p.by,
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
    const url = row.pictureUrl?.trim();
    if (!url) return undefined;
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
        const differs =
            (farmer !== undefined || inspection !== undefined) &&
            JSON.stringify(farmer) !== JSON.stringify(inspection) ||
            (!!farmerGrade || !!inspectionGrade) && farmerGrade !== inspectionGrade;

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
                        ) : (
                            <VStack w="full" h="full" align="center" justify="center">
                                <Text fontSize="xs" color="fg.muted">
                                    No Image
                                </Text>
                            </VStack>
                        )}
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
                            <Text fontSize="sm" color="fg.subtle">
                                Orders Sum: <Kbd>{fmtKg(row.sumOrderedQuantityKg)}</Kbd>
                            </Text>
                        </HStack>
                    </VStack>
                </HStack>
            </GridItem>

            <GridItem>
                <VStack align="flex-start" gap={1}>
                    <Text fontSize="md" fontWeight="medium">
                        Farmer
                    </Text>
                    <HStack wrap="wrap" gap={3}>
                        <Badge variant="subtle">{row.farmerName || "—"}</Badge>
                        <Text color="fg.subtle">Farm:</Text>
                        <Badge variant="surface">{row.farmName || "—"}</Badge>
                    </HStack>
                    <HStack wrap="wrap" gap={3} mt={2}>
                        <Text color="fg.subtle">FO ID:</Text>
                        <Code>{compactId(row._id)}</Code>
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
                                Created: {fmtDate(row.createdAt)}
                            </Text>
                        )}
                        {row.updatedAt && (
                            <Text color="fg.muted" fontSize="sm">
                                Updated: {fmtDate(row.updatedAt)}
                            </Text>
                        )}
                    </HStack>
                </VStack>
            </GridItem>
        </Grid>
    );
}

function StagesSection({ row }: { row: ShiftFarmerOrderItem }) {
    const stages = useMemo(() => deriveStagesVM(row), [row]);

    return (
        <Box borderWidth="1px" borderRadius="xl" p={4} bg="bg.panel">
            <HStack justify="space-between" align="center" mb={3}>
                <Text fontSize="md" fontWeight="medium">
                    Stages
                </Text>
            </HStack>

            {/* Timeline (compact) */}
            <Box mb={4}>
                <FarmerOrderTimeline stages={row.stages as any} stageKey={row.stageKey ?? undefined} compact disableAdvance />
            </Box>

            <Separator my={3} />

            {/* Stage details */}
            <VStack align="stretch" gap={2}>
                {stages.map((s, idx) => (
                    <HStack
                        key={`${s.key}-${idx}`}
                        justify="space-between"
                        align="flex-start"
                        borderWidth="1px"
                        borderRadius="lg"
                        p={3}
                    >
                        <VStack align="flex-start" gap={0}>
                            <Text fontWeight="medium">{s.label}</Text>
                            <HStack gap={2} mt={1}>
                                <Text fontSize="sm" color="fg.subtle">
                                    Status:
                                </Text>
                                <StatusBadge status={s.state} />
                            </HStack>
                            {s.note && (
                                <Text mt={2} fontSize="sm" color="fg.muted" whiteSpace="pre-wrap">
                                    {s.note}
                                </Text>
                            )}
                        </VStack>
                        <VStack align="flex-end" gap={1} minW="220px">
                            <HStack gap={2}>
                                <Text fontSize="sm" color="fg.subtle">
                                    Time:
                                </Text>
                                <Code fontSize="sm">{fmtDate(s.at as any)}</Code>
                            </HStack>
                            {s.by && (
                                <HStack gap={2}>
                                    <Text fontSize="sm" color="fg.subtle">
                                        By:
                                    </Text>
                                    <Code fontSize="sm">{typeof s.by === "string" ? compactId(s.by) : "user"}</Code>
                                </HStack>
                            )}
                        </VStack>
                    </HStack>
                ))}
            </VStack>
        </Box>
    );
}

function QSCompareSection({ row }: { row: ShiftFarmerOrderItem }) {
    const vm = useMemo(() => deriveQSComparison(row), [row]);
    if (!vm) return null;

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
                    <Text color="fg.subtle">Farmer @</Text>
                    <Code>{fmtDate(vm.meta.farmerAt as any)}</Code>
                </HStack>
                <HStack gap={2}>
                    <Text color="fg.subtle">Inspection @</Text>
                    <Code>{fmtDate(vm.meta.inspectionAt as any)}</Code>
                </HStack>
            </HStack>

            {/* Values comparison table */}
            <Box overflowX="auto">
                <Table.Root size="sm" variant="outline">
                    <Table.Header>
                        <Table.Row>
                            <Table.ColumnHeader minW="200px">Metric</Table.ColumnHeader>
                            <Table.ColumnHeader>Farmer</Table.ColumnHeader>
                            <Table.ColumnHeader>Inspection</Table.ColumnHeader>
                            <Table.ColumnHeader>Grades</Table.ColumnHeader>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {vm.rows.map((r) => (
                            <Table.Row key={r.key} bg={r.differs ? "bg.subtle" : undefined}>
                                <Table.Cell>
                                    <Code>{r.key}</Code>
                                </Table.Cell>
                                <Table.Cell>
                                    {r.farmer === undefined ? (
                                        <Text color="fg.muted">—</Text>
                                    ) : (
                                        <Text>{String(r.farmer)}</Text>
                                    )}
                                </Table.Cell>
                                <Table.Cell>
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

            {hasOrders && (
                <Box borderWidth="1px" borderRadius="xl" p={4} bg="bg.panel">
                    <Text fontSize="md" fontWeight="medium" mb={3}>
                        Linked Orders
                    </Text>
                    <Box overflowX="auto">
                        <Table.Root size="sm" variant="outline">
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeader>Order #</Table.ColumnHeader>
                                    <Table.ColumnHeader>Buyer</Table.ColumnHeader>
                                    <Table.ColumnHeader textAlign="end">Qty (kg)</Table.ColumnHeader>
                                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {(row.orders as any[]).map((o, idx) => (
                                    <Table.Row key={o._id ?? idx}>
                                        <Table.Cell>
                                            <HStack gap={2}>
                                                <Code>{compactId(o._id)}</Code>
                                                <IconButton
                                                    aria-label="Open order"
                                                    variant="ghost"
                                                    size="xs"
                                                    onClick={() => {
                                                        // eslint-disable-next-line no-console
                                                        console.log("open-order", o._id);
                                                    }}
                                                >
                                                    <FiExternalLink />
                                                </IconButton>
                                            </HStack>
                                        </Table.Cell>
                                        <Table.Cell>{o.buyerName || "—"}</Table.Cell>
                                        <Table.Cell textAlign="end">
                                            {typeof o.quantityKg === "number" ? o.quantityKg : "—"}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Badge variant="subtle">{o.status || "—"}</Badge>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Root>
                    </Box>
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

                                <StagesSection row={row} />

                                <VisualInspectionCard row={row} />

                                {qsExists && <QSCompareSection row={row} />}

                                <ContainersOrdersSection row={row} />

                                {/* Audit section (as-is) */}
                                <Box borderWidth="1px" borderRadius="xl" p={4} bg="bg.panel">
                                    <Text fontSize="md" fontWeight="medium" mb={2}>
                                        Audit
                                    </Text>
                                    <OrderAuditSection audit={((row as any).audit ?? (row as any).auditTrail ?? (row as any).historyAuditTrail ?? []) as any[]} />
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
