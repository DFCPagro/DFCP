// src/pages/Dashboard/index.tsx
import { Box, Stack, Heading, Separator, SimpleGrid } from "@chakra-ui/react";
import { ShiftStatsCard } from "./components/ShiftStatsCard";
import { useManagerSummary } from "./hooks/useManagerSummary";
import { PrevShiftOrdersCard } from "./components/PrevShiftOrdersCard";


export default function ViewFarmerOrdersPage() {
  const {
    current,
    next,

    isLoading,
    isFetching,
    // tz, lc, error, refetch
  } = useManagerSummary();

  return (
    <Box w="full">
      <Stack gap="6">
        {/* Page header */}
        <Heading size="lg">View Farmer Orders</Heading>

        <Separator />

        {/* Two main cards side by side on desktop, stacked on mobile */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="6" alignItems="start">

          {/* Shift stats (current + upcoming) */}
          <ShiftStatsCard
            title="Future Orders"
            current={current}
            next={next}
            loading={isLoading || isFetching}
          />

          <PrevShiftOrdersCard daysBack={2} fake={true} fakeNum={11} />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
