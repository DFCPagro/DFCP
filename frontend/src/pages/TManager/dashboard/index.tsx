// src/pages/tmanager/Dashboard/index.tsx

import * as React from "react"
import { Box, Heading, Separator, Stack, Text } from "@chakra-ui/react"
import FarmerDeliveriesShiftOverview from "./components/FarmerDeliveriesShiftOverview"

export default function FarmerDeliveriesDashboardPage() {
  return (
    <Box w="full">
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
    </Box>
  )
}
