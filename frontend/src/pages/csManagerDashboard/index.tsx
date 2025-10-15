// src/pages/csManagerDashboard/index.tsx
import { Box, Stack, Heading, Separator, SimpleGrid } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { StatCardsRow } from "./components/StatCardsRow";
import { ShiftSummaryCard } from "./components/ShiftSummaryCard";
import { ReportsCard } from "./components/ReportsCard";
import { useCSShiftSummaries } from "./hooks/useCSShiftSummaries";
import { useCSStats } from "./hooks/useCSStats";

export default function CSManagerDashboardPage() {
  const nav = useNavigate();
  const { rows, isLoading: shiftsLoading } = useCSShiftSummaries({ horizonShifts: 6 });
  const { stats, isLoading: statsLoading } = useCSStats();

  return (
    <Box w="full">
      <Stack gap="6">
        {/* Heading only (menu is handled by the app shell/layout) */}
        <Heading size="lg">Customer Service Manager Dashboard</Heading>

        {/* Top metrics */}
        <StatCardsRow stats={stats} loading={statsLoading} />

        <Separator />

        {/* Main content */}
        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="6" alignItems="start">
          <ShiftSummaryCard
            title="Current & Next 5 Shifts"
            rows={rows}
            loading={shiftsLoading}
            onViewShift={(row) => nav(`/csManager/orders?date=${row.dateISO}&shift=${row.shift}`)}
          />
          <ReportsCard title="Order Reports (Customer Messages)" />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
