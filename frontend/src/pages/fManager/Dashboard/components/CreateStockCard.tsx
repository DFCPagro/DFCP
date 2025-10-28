// src/pages/Dashboard/components/CreateStockCard.tsx
import { memo, useCallback } from "react";
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
import { toaster } from "@/components/ui/toaster";

export type CreateOrdersCardProps = {
  title?: string;
  /** Missing shifts from useManagerSummary (count === 0) */
  rows: ShiftRollup[];
  loading?: boolean;
  onAddShift?: (row: ShiftRollup) => void; // optional override
};

function CreateOrdersCardBase({
  title = "Create Stock",
  rows,
  loading,
  onAddShift,
}: CreateOrdersCardProps) {
  const navigate = useNavigate();

  const handleAdd = useCallback(
    (row: ShiftRollup) => {
      if (onAddShift) return onAddShift(row);

      // Navigate to the Create Stock page with encoded params
      const url = `/fManager/create-stock/new?date=${encodeURIComponent(row.date)}&shift=${encodeURIComponent(row.shiftName)}`;
      navigate(url);

      toaster.create({
        type: "info",
        title: "Navigate",
        description: `Opening ${row.date} · ${row.shiftName}`,
        duration: 1500,
      });
    }
    ,
    [navigate, onAddShift]
  );

  return (
    <Box borderWidth="1px" borderColor="border" rounded="lg" p="4" bg="bg" w="full">
      <Stack gap="4">
        <Heading size="md">{title}</Heading>

        {loading ? (
          <Stack gap="2">
            <Skeleton h="10" />
            <Skeleton h="10" />
            <Skeleton h="10" />
          </Stack>
        ) : rows.length === 0 ? (
          <Text color="fg.muted">All current & upcoming shifts already have orders.</Text>
        ) : (
          <Stack gap="2">
            {rows.map((row) => (
              <ShiftRow
                key={`${row.date}__${row.shiftName}`}
                variant="create"
                dateISO={row.date}
                shift={row.shiftName}
                canAdd={true}                 // missing shifts are always addable
                onAdd={() => handleAdd(row)}  // placeholder navigate + toast
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export const CreateOrdersCard = memo(CreateOrdersCardBase);
