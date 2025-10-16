// src/pages/CSManager/Dashboard/components/ShiftSummaryRowItem.tsx
import { HStack, Text, Button, Badge, Tooltip } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type { ShiftSummaryRow } from "../hooks/useCSShiftSummaries";

export function ShiftSummaryRowItem({ row, onView }: { row: ShiftSummaryRow; onView?: () => void }) {
  const navigate = useNavigate();

  const handleView = () => {
    if (onView) return onView();
    // navigate with search params
    const params = new URLSearchParams({ date: row.dateISO, shift: row.shift });
    navigate(`/cs/orders/shift?${params.toString()}`);
  };

  return (
    <HStack justify="space-between" px="3" py="2" borderWidth="1px" borderRadius="md" w="full">
      <Text fontSize="sm" fontWeight="medium">
        {row.dateISO} · {row.shift}
      </Text>

      <HStack gap="3">
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

        <Button size="sm" onClick={handleView}>
          View
        </Button>
      </HStack>
    </HStack>
  );
}
