import { Box, Stack, Heading, Skeleton, Text } from "@chakra-ui/react";
import type { ShiftSummaryRow } from "../hooks/useCSShiftSummaries.ts";
import { ShiftSummaryRowItem } from "./ShiftSummaryRowItem";

export function ShiftSummaryCard({
  title,
  rows,
  loading,
  onViewShift,
}: {
  title?: string;
  rows: ShiftSummaryRow[];
  loading?: boolean;
  onViewShift?: (row: ShiftSummaryRow) => void;
}) {
  return (
    <Box borderWidth="1px" borderColor="border" rounded="lg" p="4" bg="bg" w="full">
      <Stack gap="4">
        <Heading size="md">{title ?? "Current & Next 5 Shifts"}</Heading>

        {loading ? (
          <Stack gap="2">
            <Skeleton h="10" /><Skeleton h="10" /><Skeleton h="10" />
          </Stack>
        ) : rows.length === 0 ? (
          <Text color="fg.muted">No shifts found.</Text>
        ) : (
          <Stack gap="2">
            {rows.map((row) => (
              <ShiftSummaryRowItem
                key={`${row.dateISO}__${row.shift}`}
                row={row}
                onView={() => onViewShift?.(row)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
