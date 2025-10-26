import { Box, Stack, Heading, Separator, SimpleGrid } from "@chakra-ui/react";
import { CreateOrdersCard } from "./components/CreateStockCard";
import { ShiftStatsCard } from "./components/ShiftStatsCard";
import { useManagerCreateOptions } from "./hooks/useManagerCreateOptions";
import { useManagerShiftStats } from "./hooks/useManagerShiftStats";

export default function FarmerManagerDashboardPage() {
  // Shifts you can still add orders for (today + tomorrow by default)
  const { rows } = useManagerCreateOptions({
    horizonDays: 1,        // today + tomorrow
    includeDisabled: false // hide shifts that already started
  });

  // Current & upcoming shifts with counts (today + tomorrow)
  const {
    stats,
    isLoading: statsLoading,
    // isFetching, error, refetch // available if you need later
  } = useManagerShiftStats({
    horizonDays: 1, // today + tomorrow
  });

  return (
    <Box w="full">
      <Stack gap="6">
        {/* Page header */}
        <Heading size="lg">Farmer Manager Dashboard</Heading>

        <Separator />

        {/* Two main cards side by side on desktop, stacked on mobile */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6" alignItems="start">
          <CreateOrdersCard rows={rows} />
          <ShiftStatsCard
            stats={stats}
            loading={statsLoading}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
