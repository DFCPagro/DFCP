// src/pages/CreateStock/index.tsx
// Orchestrates the Create Stock flow:
// - If no ?date&shift → show CreateStockCard (picker)
// - If present → auto-init (useCreateStockInit) then render InitContextBanner + InventoryList
//
// TODO(dashboard-data): Replace local fallback rows with your Dashboard's data source (e.g., useManagerSummary)
// TODO(real API): Hooks already include markers where to plug real endpoints

import { useEffect, useMemo } from "react";
import {
  Box,
  Stack,
  Heading,
  Separator,
  Text,
  Button,
} from "@chakra-ui/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toaster } from "@/components/ui/toaster";
import { CreateStockCard } from "./components/CreateStockCard";
import { InitContextBanner } from "./components/InitContextBanner";
import { InventoryList } from "./components/InventoryList";
import { useCreateStockInit } from "./hooks/useCreateStockInit";
import type { Shift as ShiftEnum, IsoDateString } from "@/types/farmerOrders";

/* ---------------------------------- helpers --------------------------------- */

const SHIFTS: ShiftEnum[] = ["morning", "afternoon", "evening", "night"] as const;
function isValidShift(s?: string | null): s is ShiftEnum {
  return !!s && (SHIFTS as readonly string[]).includes(s);
}

/** Local fallback to generate a few "missing" rows like Dashboard would.
 *  Replace with your Dashboard hook (e.g., useManagerSummary) when ready.
 *  Row shape aligns with CreateStockCard props.
 */
function useFallbackMissingRows() {
  // 3 upcoming days × 2 shifts as a friendly demo set
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");

  const d1 = String(today.getDate()).padStart(2, "0");
  const d2 = String(today.getDate() + 1).padStart(2, "0");
  const d3 = String(today.getDate() + 2).padStart(2, "0");

  const dates = [`${yyyy}-${mm}-${d1}`, `${yyyy}-${mm}-${d2}`, `${yyyy}-${mm}-${d3}`];

  const rows = [
    { date: dates[0], shiftName: "morning" as ShiftEnum },
    { date: dates[0], shiftName: "evening" as ShiftEnum },
    { date: dates[1], shiftName: "afternoon" as ShiftEnum },
    { date: dates[1], shiftName: "night" as ShiftEnum },
    { date: dates[2], shiftName: "morning" as ShiftEnum },
  ];

  return { rows, loading: false };
}

/** Clears all Create Stock query params (back to picker) */
function useClearParams() {
  const [_, setSearch] = useSearchParams();
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
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();

  // Parse query params safely
  const dateParam = (search.get("date") || "") as IsoDateString;
  const shiftParam = search.get("shift");
  const shift = isValidShift(shiftParam) ? (shiftParam as ShiftEnum) : undefined;

  const hasParams = Boolean(dateParam && shift);

  // Init hook — auto-runs when date+shift exist
  const init = useCreateStockInit({ date: hasParams ? dateParam : undefined, shift });

  // Clear params handler
  const clearParams = useClearParams();

  // Local fallback rows (replace with Dashboard data when ready)
  const { rows, loading } = useFallbackMissingRows();

  // If params are present but user manually edits them to invalid, guard and bounce back to picker.
  useEffect(() => {
    if (!dateParam && !shift) return; // both missing → fine, picker will show
    if (dateParam && shift) return;   // both present and valid → fine
    // Invalid combination (e.g., missing shift or bad shift)
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
          <>
            {/* Picker card (Dashboard parity) */}
            <CreateStockCard
              title="Create Stock"
              rows={rows}
              loading={loading}
            // NOTE: CreateStockCard already pushes ?date&shift via navigate()
            // If you want to intercept, pass onAddShift and handle route there.
            />

            <Separator />

            <Text fontSize="sm" color="fg.muted">
              Select a date and shift to initialize stock. You’ll see your farmer inventory next.
            </Text>
          </>
        ) : (
          <>
            {/* Init status/context */}
            <InitContextBanner
              status={init.status}
              data={init.data}
              error={init.error}
              onRetry={() => {
                if (!shift) return;
                void init.init({ date: dateParam, shift });
              }}
              onChangeSelection={clearParams}
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

        {/* Optional back button if you have a dashboard path */}
        {/* <Button size="sm" onClick={() => navigate(PATHS.dashboard)}>Back to Dashboard</Button> */}
      </Stack>
    </Box>
  );
}
