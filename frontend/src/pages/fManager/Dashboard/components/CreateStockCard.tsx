import { memo, useCallback } from "react";
import {
  Box,
  Stack,
  Heading,
  Skeleton,
  Text,
} from "@chakra-ui/react";
import type { CreateOptionRow } from "../hooks/useManagerCreateOptions";
import { ShiftRow } from "./ShiftRow";
import { toaster } from "@/components/ui/toaster";

export type CreateOrdersCardProps = {
  title?: string;
  rows: CreateOptionRow[];           // usually from useManagerCreateOptions()
  loading?: boolean;                 // typically false (pure local calc), but supported
  onAddShift?: (row: CreateOptionRow) => void; // optional override for the Add action
};

function CreateOrdersCardBase({
  rows,
  loading,
  onAddShift,
}: CreateOrdersCardProps) {
  const handleAdd = useCallback(
    (row: CreateOptionRow) => {
      if (onAddShift) return onAddShift(row);
      toaster.create({
        type: "info",
        title: "WIP",
        description: `Add order for ${row.dateISO} · ${row.shift}`,
        duration: 2000,
      });
    },
    [onAddShift]
  );

  return (
    <Box borderWidth="1px" borderColor="border" rounded="lg" p="4" bg="bg" w="full">
      <Stack gap="4">
        <Heading size="md">Create Stock</Heading>

        {loading ? (
          <Stack gap="2">
            <Skeleton h="10" />
            <Skeleton h="10" />
            <Skeleton h="10" />
          </Stack>
        ) : rows.length === 0 ? (
          <Text color="fg.muted">No shifts available to create.</Text>
        ) : (
          <Stack gap="2">
            {rows.map((row) => (
              <ShiftRow
                key={`${row.dateISO}__${row.shift}`}
                variant="create"
                dateISO={row.dateISO}
                shift={row.shift}
                canAdd={row.canAdd}
                onAdd={() => handleAdd(row)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export const CreateOrdersCard = memo(CreateOrdersCardBase);
