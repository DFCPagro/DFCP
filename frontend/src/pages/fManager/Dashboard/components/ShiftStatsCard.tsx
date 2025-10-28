// src/pages/Dashboard/components/ShiftStatsCard.tsx
import { memo, useCallback } from "react";
import { useMemo } from "react";

import {
  Box,
  Stack,
  Heading,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type { ShiftRollup } from "@/types/farmerOrders";
import { ShiftRow } from "./ShiftRow";

export type ShiftStatsCardProps = {
  /** The "current" shift rollup (may exist with count === 0) */
  current: ShiftRollup | null;
  /** Upcoming shift rollups */
  next: ShiftRollup[];
  /** Loading state from useManagerSummary */
  loading?: boolean;
  /** Optional override for row action */
  onViewShift?: (row: ShiftRollup) => void;
};

function ShiftStatsCardBase({
  current,
  next,
  loading,
  onViewShift,
}: ShiftStatsCardProps) {
  const navigate = useNavigate();

  const handleView = useCallback(
    (row: ShiftRollup) => {
      if (onViewShift) return onViewShift(row);

      // Placeholder navigation (route may not exist yet)
      const url = `/farmer-orders?date=${encodeURIComponent(
        row.date
      )}&shift=${encodeURIComponent(row.shiftName)}`;
      navigate(url);
    },
    [navigate, onViewShift]
  );

  const missingShifts = useMemo<ShiftRollup[]>(
    () => next.filter((r) => r.count !== 0),
    [next]
  );

  const rows: ShiftRollup[] = [
    ...(current ? [current] : []),
    ...missingShifts,
  ];

  return (
    <Box borderWidth="1px" borderColor="border" rounded="lg" p="4" bg="bg" w="full">
      <Stack gap="4">
        <Heading size="md">Shift Stats</Heading>

        {loading ? (
          <Stack gap="2">
            <Skeleton h="10" />
            <Skeleton h="10" />
            <Skeleton h="10" />
          </Stack>
        ) : rows.length === 0 ? (
          <Text color="fg.muted">No current or upcoming shifts.</Text>
        ) : (
          <Stack gap="2">
            {rows.map((row) => (
              <ShiftRow
                key={`${row.date}__${row.shiftName}`}
                variant="stats"
                dateISO={row.date}
                shift={row.shiftName}
                counts={{
                  pending: row.pendingFO,
                  ok: row.okFO,
                  problem: row.problemFO,
                }}
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
