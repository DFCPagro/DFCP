// src/pages/CreateStock/index.tsx

import { useEffect } from "react";
import {
  Box,
  Stack,
  Heading,
  Separator,
  Text,
  Button,
} from "@chakra-ui/react";
import { useSearchParams } from "react-router-dom";
import { toaster } from "@/components/ui/toaster";
import { CreateStockCard } from "./components/CreateStockCard";
import { InitContextBanner } from "./components/InitContextBanner";
import { InventoryList } from "./components/InventoryList";
import { useCreateStockInit, useManagerSummary } from "./hooks/useCreateStockInit";
import type { Shift as ShiftEnum, IsoDateString } from "@/types/farmerOrders";

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
  const [search, setSearch] = useSearchParams();

  // Parse query params safely
  const dateParam = (search.get("date") || "") as IsoDateString;
  const shiftParam = search.get("shift");
  const shift = isValidShift(shiftParam) ? (shiftParam as ShiftEnum) : undefined;

  const { missingShifts, isLoading, lc } = useManagerSummary();

  const hasParams = Boolean(dateParam && shift);

  // Init hook — auto-runs when LCid + date + shift exist
  const init = useCreateStockInit({
    LCid: lc ?? undefined,
    date: hasParams ? dateParam : undefined,
    shift,
    auto: true,
  });

  // Clear params handler
  const clearParams = useClearParams();

  // If params are present but invalid, bounce back to picker.
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

  const lcMissing = !lc;

  return (
    <Box w="full">
      <Stack gap="4">
        <Heading size="lg">Create Stock</Heading>

        {!hasParams ? (
          <>
            {/* Picker card (Dashboard parity) */}
            <CreateStockCard
              title="Create Stock"
              rows={missingShifts}
              loading={isLoading}
            />

            <Separator />

            {lcMissing ? (
              <Text fontSize="sm" color="fg.muted">
                Your logistic center isn’t available yet. Ensure your account has an assigned LC
                or refresh the page after it loads.
              </Text>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                Select a date and shift to initialize stock. You’ll see your farmer inventory next.
              </Text>
            )}
          </>
        ) : (
          <>
            {/* LC guard */}
            {lcMissing ? (
              <>
                <Text color="red.500" fontSize="sm">
                  Missing Logistic Center (LC). Please ensure your profile/role has an assigned LC.
                </Text>
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={clearParams}
                >
                  Back to picker
                </Button>
              </>
            ) : (
              <>
                {/* Init status/context */}
                <InitContextBanner
                  status={init.status}
                  data={init.data}
                  error={init.error}
                  onRetry={() => {
                    if (!shift || !lc) return;
                    void init.init({ LCid: lc, date: dateParam, shift });
                  }}
                />

                {/* Inventory (after success) */}
                {init.status === "success" && init.data?.amsId ? (
                  <>
                    <Separator />
                    <InventoryList amsId={init.data.amsId} />
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
          </>
        )}
      </Stack>
    </Box>
  );
}
