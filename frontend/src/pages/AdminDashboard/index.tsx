// src/pages/adminDashboard/index.tsx
import * as React from "react";
import { Box, Stack, Heading, Separator, SimpleGrid } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

// ---- Farmer (manager) bits
import { ShiftStatsCard } from "@/pages/fManager/Dashboard/components/ShiftStatsCard";
// import { useManagerSummary } from "@/pages/fmanager/Dashboard/hooks/useManagerSummary";
import { useManagerSummary } from "@/pages/fManager/Dashboard/hooks/useManagerSummary";

// ---- Customer service bits
import { ShiftSummaryCard } from "@/pages/csManager/Dashboard/components/ShiftSummaryCard";
import { useCSShiftSummaries } from "@/pages/csManager/Dashboard/hooks/useCSShiftSummaries";

// ---- routes
import { PATHS } from "@/routes/paths";

// ---- NEW: this-month stats row
import ThisMonthStatsRow from "./components/ThisMonthStats";

export default function AdminDashboardPage() {
  const nav = useNavigate();

  const { current, next, isLoading: fmLoading, isFetching: fmFetching } = useManagerSummary();

  const { rows: csRows, isLoading: csLoading } = useCSShiftSummaries({ horizonShifts: 6 });

  const farmerLoading = fmLoading || fmFetching;

  return (
    <Box w="full">
      <Stack gap="6">
        <Heading size="lg">Admin Dashboard</Heading>

        {/* --- This Month Stats (static for now) --- */}
        <ThisMonthStatsRow />

        <Separator />

        {/* Two main focus areas side by side (stack on mobile) */}
        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="6" alignItems="start">
          {/* ----- Farmer Orders (current & next) ----- */}
          <ShiftStatsCard current={current} next={next} loading={farmerLoading} />

          {/* ----- Customer Orders (current + next 5) ----- */}
          <ShiftSummaryCard
            title="Customer Orders"
            rows={csRows}
            loading={csLoading}
            onViewShift={(row) =>
              nav({
                pathname: PATHS.csManagerShiftOrders,
                search: `?date=${row.dateISO}&shift=${row.shift}`,
              })
            }
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
