import { HStack, Text, Button, Badge, Tooltip } from "@chakra-ui/react";
import type { ShiftSummaryRow } from "../hooks/useCSShiftSummaries";

export function ShiftSummaryRowItem({
  row,
  onView,
}: { row: ShiftSummaryRow; onView?: () => void }) {
  return (
    <HStack justify="space-between" px="3" py="2" borderWidth="1px" borderRadius="md" w="full">
      <Text fontSize="sm" fontWeight="medium">
        {row.dateISO} · {row.shift}
      </Text>

      <HStack gap="3">
        {/* Total */}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <Badge cursor="default" colorPalette="blue">
              Total {row.counts.total}
            </Badge>
          </Tooltip.Trigger>
          <Tooltip.Positioner>
            <Tooltip.Content>Total orders for this shift</Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>

        {/* Problem */}
        <Tooltip.Root>
          <Tooltip.Trigger>
            <Badge cursor="default" colorPalette="red">
              Problem {row.counts.problem}
            </Badge>
          </Tooltip.Trigger>
          <Tooltip.Positioner>
            <Tooltip.Content>Orders with status = problem</Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>

        <Button size="sm" onClick={onView}>
          View
        </Button>
      </HStack>
    </HStack>
  );
}
