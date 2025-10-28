// src/pages/Dashboard/index.tsx
import { Box, Stack, Heading, Separator, SimpleGrid } from "@chakra-ui/react";
import { CreateOrdersCard } from "./components/CreateStockCard";
import { ShiftStatsCard } from "./components/ShiftStatsCard";
import { useManagerSummary } from "./hooks/useManagerSummary";

export default function FarmerManagerDashboardPage() {
  const {
    current,
    next,
    missingShifts,
    isLoading,
    isFetching,
    // tz, lc, error, refetch
  } = useManagerSummary();

  return (
    <Box w="full">
      <Stack gap="6">
        {/* Page header */}
        <Heading size="lg">Farmer Manager Dashboard</Heading>

        <Separator />

        {/* Two main cards side by side on desktop, stacked on mobile */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6" alignItems="start">
          {/* Create Stock (shows (date,shift) with count === 0) */}
          <CreateOrdersCard rows={missingShifts} loading={isLoading || isFetching} />

          {/* Shift stats (current + upcoming) */}
          <ShiftStatsCard
            current={current}
            next={next}
            loading={isLoading || isFetching}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
