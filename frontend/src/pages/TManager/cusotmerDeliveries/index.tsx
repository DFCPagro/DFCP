// src/pages/tmanager/CustomerDeliveriesDashboard/index.tsx

import * as React from "react"
import { Box, Heading, Separator, Stack, Text } from "@chakra-ui/react"
import CustomerDeliveriesShiftOverview from "../dashboard/components/CustomerDeliveriesShiftOverview.tsx"

export default function CustomerDeliveriesDashboardPage() {
  return (
    <Box w="full">
      <Stack gap="6">
        {/* Header */}
        <Stack gap="2">
          <Heading size="lg">Outbound Customer Deliveries</Heading>
          <Text color="fg.muted" fontSize="sm">
            Monitor and coordinate delivery drivers taking orders to customers
            across all shifts.
          </Text>
        </Stack>

        <Separator />

        {/* Shifts + table + actions */}
        <CustomerDeliveriesShiftOverview />
      </Stack>
    </Box>
  )
}
