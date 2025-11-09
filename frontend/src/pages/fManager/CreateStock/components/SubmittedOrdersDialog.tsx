import { Fragment, memo, useMemo } from "react"
import type { ReactNode } from "react"
import {
    Badge,
    Box,
    Button,
    Code,
    Dialog,
    HStack,
    Image,
    ScrollArea,
    Separator,
    Stack,
    Table,
    Text,
    VStack,
} from "@chakra-ui/react"
import { FiArrowRight, FiCheck, FiX } from "react-icons/fi"
import { useNavigate } from "react-router-dom"

import { useSubmittedOrders } from "../hooks/useSubmittedOrders"
import type { SubmittedContext, SubmittedGroup, SubmittedLine } from "../shared/submittedOrders.shared"

export type DemandStats = {
    /** Example fields; supply whatever you use on the page via getDemandStats */
    demandKg?: number
    committedKg?: number
    remainingKg?: number
    // extend as needed
}

export type SubmittedOrdersDialogProps = {
    /** Control from parent */
    open: boolean
    onOpenChange: (open: boolean) => void

    /** Current page context (date/shift/LC). */
    context: SubmittedContext

    /**
     * Route to navigate to on Confirm. Defaults to '/dashboard'.
     * If you prefer another route, pass it here.
     */
    confirmNavigateTo?: string

    /** Optional: custom title/description nodes */
    title?: ReactNode
    description?: ReactNode
}

function formatKg(n?: number) {
    if (!Number.isFinite(n ?? NaN)) return "0 kg"
    const v = n as number
    if (v >= 1000) return `${(v / 1000).toFixed(1)} t`
    if (v >= 100) return `${Math.round(v)} kg`
    return `${Number(v.toFixed(1))} kg`
}

function groupTitle(g: SubmittedGroup) {
    const t = g.type ? `  ${g.type}` : ""
    const v = g.variety ? ` • ${g.variety}` : ""
    return `${t}${v}`
}

function firstImage(lines: SubmittedLine[]): string | undefined {
    for (const l of lines) {
        if (l.imageUrl) return l.imageUrl
    }
    return undefined
}

const SubmittedOrdersDialog = memo(function SubmittedOrdersDialog({
    open,
    onOpenChange,
    context,
    confirmNavigateTo = "/dashboard",
    title,
    description,
}: SubmittedOrdersDialogProps) {
    const navigate = useNavigate()
    const { groups, totals, clear } = useSubmittedOrders(context)

    const hasAny = groups.length > 0

    const headerTitle = title ?? (
        <HStack gap={3}>
            <Text fontSize="lg" fontWeight="bold">
                Submitted Orders Summary
            </Text>
            <Badge variant="subtle">
                {totals.linesCount} {totals.linesCount === 1 ? "line" : "lines"}
            </Badge>
            <Badge variant="solid">{formatKg(totals.totalKg)}</Badge>
        </HStack>
    )

    const headerDesc = description ?? (
        <Text color="fg.muted" fontSize="sm">
            Live demand figures are shown for each item. Confirm will clear the summary and take you back.
        </Text>
    )

    const onContinue = () => onOpenChange(false)

    const onConfirm = () => {
        // Clear store (per your decision), close, then navigate to dashboard.
        clear()
        onOpenChange(false)
        navigate(confirmNavigateTo)
    }


    const content = (
        <Stack gap={4}>
            {groups.map((g) => {
                const img = firstImage(g.lines)
                return (
                    <Fragment key={g.groupKey}>
                        <HStack align="start" justify="space-between" gap={4}>
                            {/* Left: Item identity */}
                            <HStack gap={3} minW={0}>
                                {img ? (
                                    <Image src={img} alt={g.itemId} boxSize="44px" borderRadius="md" objectFit="cover" />
                                ) : (
                                    <Box boxSize="44px" borderRadius="md" bg="bg.muted" />
                                )}
                                <VStack align="start" gap={1} minW={0}>
                                    <Text fontWeight="semibold" lineClamp={1}>
                                        {groupTitle(g)}
                                    </Text>
                                    <HStack gap={2} wrap="wrap">
                                        <Badge variant="outline">Submitted: {formatKg(g.totalSubmittedKg)}</Badge>
                                        {typeof g?.remainingKg === "number" && (
                                            <Badge
                                                variant="subtle"
                                                colorPalette={(g?.remainingKg ?? 0) < 0 ? "red" : "green"}
                                            >
                                                Remaining: {formatKg(g?.remainingKg)}
                                            </Badge>
                                        )}
                                    </HStack>
                                </VStack>
                            </HStack>

                            {/* Right: Demand stats table */}
                            <Box minW="280px" flexShrink={0}>
                                <Table.Root size="sm" variant="outline">
                                    <Table.Body>
                                        <Table.Row>
                                            <Table.Cell>
                                                <Text color="fg.subtle">Demand</Text>
                                            </Table.Cell>
                                            <Table.Cell textAlign="end">{formatKg(g?.demandKg)}</Table.Cell>

                                            <Table.Cell>
                                                <Text color="fg.subtle">Remaining</Text>
                                            </Table.Cell>
                                            <Table.Cell textAlign="end">{formatKg(g?.demandKg - g?.totalSubmittedKg)}</Table.Cell>

                                            <Table.Cell>
                                                <Text color="fg.subtle">Submitted</Text>
                                            </Table.Cell>
                                            <Table.Cell textAlign="end">
                                                <HStack justify="end" gap={1}>
                                                    <Text>{formatKg(g.totalSubmittedKg)}</Text>
                                                    <Badge>{g.lines.length}</Badge>
                                                </HStack>
                                            </Table.Cell>
                                        </Table.Row>
                                    </Table.Body>
                                </Table.Root>
                            </Box>
                        </HStack>

                        {/* Per-line details (collapsed style) */}
                        <ScrollArea.Root>
                            <ScrollArea.Viewport style={{ maxHeight: 160 }}>
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
                                        {g.lines.map((l, idx) => (
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
                                                <Table.Cell textAlign="end">{formatKg(l.qtyKg)}</Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table.Root>
                            </ScrollArea.Viewport>
                        </ScrollArea.Root>

                        <Separator />
                    </Fragment>
                )
            })}
        </Stack>

    )

    return (
        <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
            {/* Ensure overlay and center positioning */}
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
                        {hasAny ? (
                            <Box>{content}</Box>
                        ) : (
                            <VStack py={10} gap={2}>
                                <Text fontWeight="medium">No submitted orders yet</Text>
                                <Text color="fg.muted" fontSize="sm">
                                    Submit items first, then return here to review.
                                </Text>
                            </VStack>
                        )}
                    </Dialog.Body>

                    <Dialog.Footer>
                        <HStack w="full" justify="space-between">
                            <HStack gap={3}>
                                <Badge variant="outline">Lines: {totals.linesCount}</Badge>
                                <Badge variant="solid">Total: {formatKg(totals.totalKg)}</Badge>
                            </HStack>
                            <HStack gap={2}>
                                <Button variant="ghost" onClick={onContinue}>
                                    <FiArrowRight />
                                    <Text ml={2}>Continue</Text>
                                </Button>
                                <Button variant="solid" colorPalette="green" onClick={onConfirm} disabled={!hasAny}>
                                    <FiCheck />
                                    <Text ml={2}>Confirm</Text>
                                </Button>
                            </HStack>
                        </HStack>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    )
})

export default SubmittedOrdersDialog
