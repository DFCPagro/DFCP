// src/pages/CreateStock/index.tsx

import { useEffect } from "react";
import {
  Box,
  Stack,
  Heading,
  Separator,
  Text,
} from "@chakra-ui/react";
import { useSearchParams } from "react-router-dom";
import { toaster } from "@/components/ui/toaster";
import { CreateStockCard } from "./components/CreateStockCard";
import { InitContextBanner } from "./components/InitContextBanner";
import { InventoryList } from "./components/InventoryList";
import { useCreateStockInit, useManagerSummary } from "./hooks/useCreateStockInit";
import { ShiftEnum, IsoDateString } from "@/types/shifts";

/* ---------------------------------- helpers --------------------------------- */

const SHIFTS: ShiftEnum[] = ["morning", "afternoon", "evening", "night"] as const;
function isValidShift(s?: string | null): s is ShiftEnum {
  return !!s && (SHIFTS as readonly string[]).includes(s);
}

/** Clears the Create Stock query params (back to picker) */
function useClearParams() {
  const [, setSearch] = useSearchParams();
  return () => {
    setSearch((prev) => {
      prev.delete("date");
      prev.delete("shift");
      return prev;
    });
  };
}

/* ----------------------------------- page ----------------------------------- */

export default function CreateStockPage() {
  const [search] = useSearchParams();

  // Parse query params safely
  const dateParam = (search.get("date") || "") as IsoDateString;
  const shiftParam = search.get("shift");
  const shift = isValidShift(shiftParam) ? (shiftParam as ShiftEnum) : undefined;

  const { missingShifts, isLoading } = useManagerSummary();

  const hasParams = Boolean(dateParam && shift);

  // Init hook — auto-runs when date + shift exist
  const init = useCreateStockInit({
    date: hasParams ? dateParam : undefined,
    shift,
    auto: true,
  });

  // Clear params handler
  const clearParams = useClearParams();

  // If params are partially present/invalid, bounce back to picker.
  useEffect(() => {
    if (!dateParam && !shift) return; // both missing → fine, picker will show
    if (dateParam && shift) return;   // both present and valid → fine
    toaster.create({
      type: "warning",
      title: "Invalid selection",
      description: "Please select a date and a valid shift.",
    });
    clearParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam, shift]);

  return (
    <Box w="full">
      <Stack gap="4">
        <Heading size="lg">Create Stock</Heading>

        {!hasParams ? (
          // Picker card (Dashboard parity)
          <CreateStockCard
            title="Create Stock"
            rows={missingShifts}
            loading={isLoading}
          />
        ) : (
          <>
            {/* Init status/context */}
            <InitContextBanner
              status={init.status}
              data={init.data}
              error={init.error}
              onRetry={() => {
                if (!shift) return;
                void init.init?.({ date: dateParam, shift });
              }}
            />

            {/* Inventory (after success) */}
            {init.status === "success" && init.data?.amsId ? (
              <>
                <Separator />
                <InventoryList
                  shift={shift}
                  pickUpDate={dateParam}
                />
              </>
            ) : null}

            {/* Error hint */}
            {init.status === "error" ? (
              <Text fontSize="sm" color="fg.muted">
                Fix the error above or change the selection to try again.
              </Text>
            ) : null}
          </>
        )}
      </Stack>
    </Box>
  );
}
