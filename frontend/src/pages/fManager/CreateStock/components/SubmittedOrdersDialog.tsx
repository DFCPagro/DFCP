import { Fragment, memo, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    Badge,
    Box,
    Button,
    Code,
    Dialog,
    HStack,
    Image,
    Separator,
    Stack,
    Table,
    Text,
    VStack,
} from "@chakra-ui/react";
import { FiArrowRight, FiCheck, FiX, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { useSubmittedOrders } from "../hooks/useSubmittedOrders";
import type { SubmittedContext, SubmittedLine } from "../shared/submittedOrders.shared";

// Adjust these imports to your actual file locations if needed
import { getDemandStatistics } from "@/api/farmerInventory";
import type { DemandStatisticsResponse, DemandStatisticsItem } from "@/types/farmerInventory";

/* --------------------------------- Props --------------------------------- */

export type SubmittedOrdersDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    context: SubmittedContext;
    confirmNavigateTo?: string;
    title?: ReactNode;
    description?: ReactNode;
};

/* ------------------------------ Small helpers ----------------------------- */

function slotKeyFromContext(ctx: SubmittedContext): string {
    // Prefer an explicit slotKey if present
    // @ t s-expect-error tolerate optional slotKey on context
    if ((ctx as any)?.slotKey) return (ctx as any).slotKey as string;

    // Compose "monday-afternoon" from date+shift
    const date = (ctx as any)?.date ? new Date((ctx as any).date) : new Date();
    const day = date.toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase();
    const shift = ((ctx as any)?.shiftName || (ctx as any)?.shift || "morning").toLowerCase();
    return `${day}-${shift}`;
}

function formatQtyKg(n?: number) {
    if (!Number.isFinite(n ?? NaN)) return "0 kg";
    const v = n as number;
    if (v >= 1000) return `${(v / 1000).toFixed(1)} t`;
    if (v >= 100) return `${Math.round(v)} kg`;
    return `${Number(v.toFixed(1))} kg`;
}

/* ------------------------------- Main component --------------------------- */

type CoverageRow = {
    itemId: string;
    name: string;
    imageUrl?: string;
    demandKg: number;
    submittedKg: number;
    remainingKg: number;
};

const SubmittedOrdersDialog = memo(function SubmittedOrdersDialog({
    open,
    onOpenChange,
    context,
    confirmNavigateTo = "/dashboard",
    title,
    description,
}: SubmittedOrdersDialogProps) {
    const navigate = useNavigate();

    // Submitted orders (lines already restricted to "submitted" statuses by your hook/type contract)
    const { groups, clear } = useSubmittedOrders(context);

    // Demand from API
    const [demand, setDemand] = useState<DemandStatisticsResponse | null>(null);
    const [isDemandLoading, setIsDemandLoading] = useState<boolean>(false);
    const [demandError, setDemandError] = useState<unknown>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            try {
                setIsDemandLoading(true);
                setDemandError(null);
                const slotKey = slotKeyFromContext(context);
                const res = await getDemandStatistics({ slotKey });
                if (!cancelled) setDemand(res);
            } catch (err) {
                if (!cancelled) setDemandError(err);
            } finally {
                if (!cancelled) setIsDemandLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, context]);

    /* ----------------------- Coverage + contributors data -------------------- */

    // Flatten submitted lines
    const allLines = useMemo<SubmittedLine[]>(() => {
        const out: SubmittedLine[] = [];
        for (const g of groups) for (const l of g.lines) out.push(l);
        return out;
    }, [groups]);

    // Lines by item for contributors list
    const linesByItem = useMemo(() => {
        const map = new Map<string, SubmittedLine[]>();
        for (const l of allLines) {
            const arr = map.get(l.itemId) ?? [];
            arr.push(l);
            map.set(l.itemId, arr);
        }
        return map;
    }, [allLines]);

    // Coverage rows (all demanded items even with submitted=0)
    const coverageRows = useMemo<CoverageRow[]>(() => {
        if (!demand?.items?.length) return [];

        const wanted = slotKeyFromContext(context);
        let slot = demand.items.find((s) => s.slotKey === wanted);

        // Fallback: BE may return a single slot or different key format
        if (!slot) {
            slot = demand.items[0];
            if (slot) {
                console.warn("[SubmittedOrdersDialog] No exact slotKey match. Falling back to first slot:", {
                    wanted,
                    fallback: slot.slotKey,
                });
            }
        }
        if (!slot) return [];

        // Sum submitted by itemId
        const submittedByItem = new Map<string, number>();
        for (const l of allLines) {
            const prev = submittedByItem.get(l.itemId) ?? 0;
            submittedByItem.set(l.itemId, prev + (l.qtyKg ?? 0));
        }

        // Produce rows for every demanded item
        const rows: CoverageRow[] = (slot.items ?? []).map((it: DemandStatisticsItem) => {
            const demandKg = it.averageDemandQuantityKg ?? 0;
            const submittedKg = submittedByItem.get(it.itemId) ?? 0;
            let remainingKg = demandKg - submittedKg;
            if (remainingKg <= 0) remainingKg = 0;
            return {
                itemId: it.itemId,
                name: it.itemDisplayName,
                imageUrl: it.imageUrl,
                demandKg,
                submittedKg,
                remainingKg,
            };
        });

        // Sort: largest missing first
        rows.sort((a, b) => a.remainingKg - b.remainingKg);
        return rows;
    }, [demand, context, allLines]);

    // Header/footer KPIs
    const kpis = useMemo(() => {
        let totalDemand = 0;
        let totalSubmitted = 0;
        let missingCount = 0;
        let metCount = 0;
        let overCount = 0;

        for (const r of coverageRows) {
            totalDemand += r.demandKg;
            totalSubmitted += r.submittedKg;
            if (r.remainingKg > 0) missingCount++;
            else if (r.remainingKg < 0) overCount++;
            else metCount++;
        }

        return {
            totalDemand,
            totalSubmitted,
            totalRemaining: totalDemand - totalSubmitted,
            missingCount,
            metCount,
            overCount,
        };
    }, [coverageRows]);

    // Expand/collapse tracking per item
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
    function toggleItemOpen(itemId: string) {
        setOpenItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
    }

    /* -------------------------------- Header UI ------------------------------ */

    const headerTitle = title ?? (
        <HStack gap={3} wrap="wrap">
            <Text fontSize="lg" fontWeight="bold">
                Demand Coverage
            </Text>
            <Badge variant="outline">Items: {coverageRows.length}</Badge>
            <Badge variant="subtle">Demand: {formatQtyKg(kpis.totalDemand)}</Badge>
            <Badge variant="solid">Submitted: {formatQtyKg(kpis.totalSubmitted)}</Badge>
            <Badge
                variant="subtle"
                colorPalette={kpis.totalRemaining > 0 ? "red" : kpis.totalRemaining < 0 ? "orange" : "green"}
            >
                Remaining: {formatQtyKg(kpis.totalRemaining)}
            </Badge>
            <HStack gap={1}>
                <Badge variant="outline">Missing: {kpis.missingCount}</Badge>
                <Badge variant="outline">Met: {kpis.metCount}</Badge>
                <Badge variant="outline">Over: {kpis.overCount}</Badge>
            </HStack>
        </HStack>
    );

    const headerDesc = description ?? (
        <Text color="fg.muted" fontSize="sm">
            All demanded items for this slot are listed with submitted and remaining quantities.
        </Text>
    );

    const onContinue = () => onOpenChange(false);
    const onConfirm = () => {
        clear();
        onOpenChange(false);
        navigate(confirmNavigateTo);
    };

    /* -------------------------------- Body UI -------------------------------- */

    const content = (
        <Stack gap={4}>
            {coverageRows.map((r) => {
                const contributors = (linesByItem.get(r.itemId) ?? [])
                    .slice()
                    .sort((a, b) => (b.qtyKg ?? 0) - (a.qtyKg ?? 0));
                const isOpen = !!openItems[r.itemId];

                return (
                    <Fragment key={r.itemId}>
                        <HStack align="start" justify="space-between" gap={4}>
                            {/* Left: item identity + badges */}
                            <HStack gap={3} minW={0}>
                                {r.imageUrl ? (
                                    <Image src={r.imageUrl} alt={r.name} boxSize="44px" borderRadius="md" objectFit="cover" />
                                ) : (
                                    <Box boxSize="44px" borderRadius="md" bg="bg.muted" />
                                )}
                                <VStack align="start" gap={1} minW={0}>
                                    <HStack gap={2}>
                                        <Text fontWeight="semibold" lineClamp={1}>
                                            {r.name}
                                        </Text>

                                        {/* Toggle only if we have contributors */}
                                        {!!contributors.length && (
                                            <Button size="xs" variant="ghost" onClick={() => toggleItemOpen(r.itemId)}>
                                                {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                                                <Text ml="1">{isOpen ? "Hide" : "View"} {contributors.length}</Text>
                                            </Button>

                                        )}
                                    </HStack>

                                    <HStack gap={2} wrap="wrap">
                                        <Badge variant="outline">Demand: {formatQtyKg(r.demandKg)}</Badge>
                                        <Badge variant="subtle">Submitted: {formatQtyKg(r.submittedKg)}</Badge>
                                        <Badge
                                            variant="solid"
                                            colorPalette={r.remainingKg > 0 ? "red" : r.remainingKg < 0 ? "orange" : "green"}
                                        >
                                            Remaining: {formatQtyKg(r.remainingKg)}
                                        </Badge>
                                    </HStack>
                                </VStack>
                            </HStack>

                            {/* Right: compact numbers table */}
                            <Box minW="300px" flexShrink={0}>
                                <Table.Root size="sm" variant="outline">
                                    <Table.Body>
                                        <Table.Row>
                                            <Table.Cell>
                                                <Text color="fg.subtle">Demand</Text>
                                            </Table.Cell>
                                            <Table.Cell textAlign="end">{formatQtyKg(r.demandKg)}</Table.Cell>

                                            <Table.Cell>
                                                <Text color="fg.subtle">Submitted</Text>
                                            </Table.Cell>
                                            <Table.Cell textAlign="end">{formatQtyKg(r.submittedKg)}</Table.Cell>

                                            <Table.Cell>
                                                <Text color="fg.subtle">Remaining</Text>
                                            </Table.Cell>
                                            <Table.Cell textAlign="end">{formatQtyKg(r.remainingKg)}</Table.Cell>
                                        </Table.Row>
                                    </Table.Body>
                                </Table.Root>
                            </Box>
                        </HStack>

                        {/* Contributors (farmers) */}
                        {isOpen && !!contributors.length && (
                            <Box pl="56px">
                                <Table.Root size="sm">
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.ColumnHeader w="40%">Farmer</Table.ColumnHeader>
                                            <Table.ColumnHeader w="40%">Farm</Table.ColumnHeader>
                                            <Table.ColumnHeader textAlign="end" w="20%">
                                                Qty (kg)
                                            </Table.ColumnHeader>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {contributors.map((l, idx) => (
                                            <Table.Row key={`${l.key}-${idx}`}>
                                                <Table.Cell>
                                                    <HStack gap={2}>
                                                        <Badge variant="solid">#{idx + 1}</Badge>
                                                        <Text lineClamp={1}>{l.farmerName || l.farmerId}</Text>
                                                    </HStack>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Text lineClamp={1}>{l.farmName || <Code color="fg.muted">unknown</Code>}</Text>
                                                </Table.Cell>
                                                <Table.Cell textAlign="end">{formatQtyKg(l.qtyKg)}</Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Root>
                            </Box>
                        )}

                        <Separator />
                    </Fragment>
                );
            })}
        </Stack>
    );

    /* --------------------------------- Render -------------------------------- */

    return (
        <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content
                    maxW="min(960px, 96vw)"
                    p={0}
                    rounded="2xl"
                    shadow="2xl"
                    bg="bg"
                    zIndex="modal"
                >
                    <Dialog.Header>
                        <VStack align="start" gap={1}>
                            {headerTitle}
                            {headerDesc}
                        </VStack>
                        <Dialog.CloseTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label="Close">
                                <FiX />
                            </Button>
                        </Dialog.CloseTrigger>
                    </Dialog.Header>

                    <Dialog.Body>
                        {isDemandLoading ? (
                            <VStack py={10} gap={2}>
                                <Text fontWeight="medium">Loading demand…</Text>
                                <Text color="fg.muted" fontSize="sm">Please wait</Text>
                            </VStack>
                        ) : demandError ? (
                            <VStack py={10} gap={2}>
                                <Text fontWeight="medium">Failed to load demand</Text>
                                <Text color="fg.muted" fontSize="sm">Check the slotKey or network and try again.</Text>
                            </VStack>
                        ) : coverageRows.length ? (
                            <Box>{content}</Box>
                        ) : (
                            <VStack py={10} gap={2}>
                                <Text fontWeight="medium">No demanded items for this slot</Text>
                                <Text color="fg.muted" fontSize="sm">Adjust the date/shift and try again.</Text>
                            </VStack>
                        )}
                    </Dialog.Body>

                    <Dialog.Footer>
                        <HStack w="full" justify="space-between" wrap="wrap" gap={3}>
                            <HStack gap={3} wrap="wrap">
                                <Badge variant="outline">Items: {coverageRows.length}</Badge>
                                <Badge variant="subtle">Demand: {formatQtyKg(kpis.totalDemand)}</Badge>
                                <Badge variant="solid">Submitted: {formatQtyKg(kpis.totalSubmitted)}</Badge>
                                <Badge
                                    variant="subtle"
                                    colorPalette={kpis.totalRemaining > 0 ? "red" : kpis.totalRemaining < 0 ? "orange" : "green"}
                                >
                                    Remaining: {formatQtyKg(kpis.totalRemaining)}
                                </Badge>
                            </HStack>

                            <HStack gap={2}>
                                <Button variant="ghost" onClick={onContinue}>
                                    <FiArrowRight />
                                    <Text ml={2}>Continue</Text>
                                </Button>
                                <Button variant="solid" colorPalette="green" onClick={onConfirm} disabled={!coverageRows.length}>
                                    <FiCheck />
                                    <Text ml={2}>Confirm</Text>
                                </Button>
                            </HStack>
                        </HStack>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    );
});

export default SubmittedOrdersDialog;
