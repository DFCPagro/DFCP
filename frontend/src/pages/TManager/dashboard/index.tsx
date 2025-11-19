// src/pages/tmanager/Dashboard/index.tsx

import * as React from "react"
import { Box, Heading, Separator, Stack, Text } from "@chakra-ui/react"

// Existing
import FarmerDeliveriesShiftOverview from "./components/FarmerDeliveriesShiftOverview"

// NEW
import CustomerDeliveriesShiftOverview from "./components/CustomerDeliveriesShiftOverview"

export default function TManagerDashboardPage() {
  return (
    <Box w="full">
      <Stack gap="10">
        {/* ============================ */}
        {/* Farmer Deliveries Section    */}
        {/* ============================ */}
        <Stack gap="6">
          {/* Header */}
          <Stack gap="2">
            <Heading size="lg">Inbound Farmer Deliveries</Heading>
            <Text color="fg.muted" fontSize="sm">
              Plan and monitor industrial driver routes from farms to the logistic
              center for the current and upcoming shifts.
            </Text>
          </Stack>

          <Separator />

          {/* Shifts + table + navigation */}
          <FarmerDeliveriesShiftOverview />
        </Stack>

        {/* ============================ */}
        {/* Customer Deliveries Section  */}
        {/* ============================ */}
        <Stack gap="6">
          {/* Header */}
          <Stack gap="2">
            <Heading size="lg">Outbound Customer Deliveries</Heading>
            <Text color="fg.muted" fontSize="sm">
              Track and coordinate deliveries going out to customers for each shift.
            </Text>
          </Stack>

          <Separator />

          {/* Shifts + table + navigation */}
          <CustomerDeliveriesShiftOverview />
        </Stack>
      </Stack>
    </Box>
  )
}
