//src/pages/AdminExpectedHarvest/index.tsx
import { useMemo, useState } from "react";
import { Box, Stack, Heading, Text } from "@chakra-ui/react";

import { FAKE_ITEMS } from "@/api/fakes/farmerSectionHarvest";
import { useExpectedForecast } from "./hooks/useExpectedForecast";
import type { ShiftFilter } from "./components/FilterBar";
import { FilterBar } from "./components/FilterBar";
import { ForecastTable } from "./components/ForecastTable";

export default function AdminExpectedHarvestPage() {
  // --- Local state (filters) ---
  const initialItemId = FAKE_ITEMS[0]?.id ?? "";
  const [itemId, setItemId] = useState<string>(initialItemId);
  const [shift, setShift] = useState<ShiftFilter>("all");

  // --- Derived labels for header ---
  const itemLabel = useMemo(
    () => FAKE_ITEMS.find((it) => it.id === itemId)?.name ?? "—",
    [itemId]
  );

  // --- Forecast (next 4 days; use 7-day window) ---
  const forecast = useExpectedForecast({
    itemId,
    shift,
    daysAhead: 4,
    windowDays: 7,
  });

  return (
    <Stack gap="6" width="full">
      {/* Header */}
      <Box>
        <Heading size="md">Expected Harvest (Beta)</Heading>
        <Text fontSize="sm" color="fg.muted">
          Short-term planning view (fake data). Choose an item and shift to see the
          next few days forecast aggregated across sections.
        </Text>
      </Box>

      {/* Filters */}
      <FilterBar
        itemId={itemId}
        onItemIdChange={setItemId}
        shift={shift}
        onShiftChange={setShift}
      />

      {/* Results */}
      <Box
        borderWidth="1px"
        borderRadius="lg"
        p="4"
        bg="bg.surface"
      >
        <Heading size="sm" mb="3">
          {itemLabel} · {shift === "all" ? "All shifts" : `Shift: ${shift}`}
        </Heading>

        <ForecastTable
          rows={forecast.rows}
          loading={forecast.loading}
          error={forecast.error}
          shift={shift}
          samplesUsedDays={forecast.samplesUsedDays}
        />
      </Box>
    </Stack>
  );
}
