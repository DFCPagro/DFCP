import { memo, useCallback } from "react";
import {
  Box,
  Stack,
  Heading,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import type { ShiftStatsRow } from "../hooks/useManagerShiftStats";
import { ShiftRow } from "./ShiftRow";
import { toaster } from "@/components/ui/toaster";

export type ShiftStatsCardProps = {
  title?: string;
  stats: ShiftStatsRow[];
  loading?: boolean;
  onViewShift?: (row: ShiftStatsRow) => void; // optional override
};

function ShiftStatsCardBase({

  stats,
  loading,
  onViewShift,
}: ShiftStatsCardProps) {
  const handleView = useCallback(
    (row: ShiftStatsRow) => {
      if (onViewShift) return onViewShift(row);
      toaster.create({
        type: "info",
        title: "WIP",
        description: `View ${row.dateISO} · ${row.shift}`,
        duration: 2000,
      });
    },
    [onViewShift]
  );

  return (
    <Box borderWidth="1px" borderColor="border" rounded="lg" p="4" bg="bg" w="full">
      <Stack gap="4">
        <Heading size="md">Current & Upcoming Shifts</Heading>

        {loading ? (
          <Stack gap="2">
            <Skeleton h="10" />
            <Skeleton h="10" />
            <Skeleton h="10" />
          </Stack>
        ) : stats.length === 0 ? (
          <Text color="fg.muted">No current or upcoming shifts.</Text>
        ) : (
          <Stack gap="2">
            {stats.map((row) => (
              <ShiftRow
                key={`${row.dateISO}__${row.shift}`}
                variant="stats"
                dateISO={row.dateISO}
                shift={row.shift}
                counts={row.counts}
                onView={() => handleView(row)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export const ShiftStatsCard = memo(ShiftStatsCardBase);
