import { memo, useMemo } from "react"
import {
    Box,
    HStack,
    IconButton,
    Text,
    Tooltip,
} from "@chakra-ui/react"
import { FiList } from "react-icons/fi"
import { useSubmittedOrders } from "../hooks/useSubmittedOrders"
import type { SubmittedContext } from "../shared/submittedOrders.shared.ts"

export type SubmittedOrdersFabProps = {
    /** Current page context, used by the hook to guard against cross-shift contamination. */
    context: SubmittedContext
    /** Called when the user clicks the FAB. Parent should open the dialog. */
    onOpen: () => void
    /** Optional: disable the FAB (e.g., while loading other UI). */
    disabled?: boolean
    /** Optional: hide the FAB entirely when count is 0. Default: false */
    hideWhenEmpty?: boolean
    /** Optional: tweak offsets (px, rem, etc.). Default: 16px from edges. */
    bottomOffset?: string | number
    leftOffset?: string | number
}

function formatKg(n: number) {
    if (!Number.isFinite(n)) return "0 kg"
    if (n >= 1000) return `${(n / 1000).toFixed(1)} t`
    if (n >= 100) return `${Math.round(n)} kg`
    return `${Number(n.toFixed(1))} kg`
}


const SubmittedOrdersFab = memo(function SubmittedOrdersFab({
    context,
    onOpen,
    disabled,
    hideWhenEmpty = false,
    bottomOffset = 16,
    leftOffset = 16,
}: SubmittedOrdersFabProps) {
    const { totals } = useSubmittedOrders(context)
    let { linesCount, totalKg } = totals

    let tooltipLabel = (
        <HStack gap={2}>
            <Text fontWeight="semibold">Submitted:</Text>
            <Text>
                {linesCount} {linesCount === 1 ? "line" : "lines"}
            </Text>
            <Text>•</Text>
            <Text>{formatKg(totalKg)}</Text>
        </HStack>
    )

    if (hideWhenEmpty && linesCount === 0) return null

    return (
        <Box position="fixed" zIndex="popover" bottom={bottomOffset} left={leftOffset}>
            <Tooltip.Root openDelay={200}>
                <Tooltip.Trigger asChild>
                    <Box position="relative">
                        <IconButton
                            aria-label="Open submitted orders summary"
                            size="lg"
                            rounded="full"
                            variant="solid"
                            onClick={onOpen}
                            disabled={disabled} // v3 prop rename
                        >
                            <FiList />
                        </IconButton>
                    </Box>
                </Tooltip.Trigger>

                <Tooltip.Positioner>
                    <Tooltip.Content>{tooltipLabel}</Tooltip.Content>
                </Tooltip.Positioner>
            </Tooltip.Root>
        </Box>
    )
})

// export const InventoryList = memo(InventoryListBase);

export default SubmittedOrdersFab
