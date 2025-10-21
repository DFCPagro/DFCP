// src/pages/FarmerDashboard/index.tsx
import { Box, Stack, Heading, Separator } from "@chakra-ui/react";
import IncomingOrdersStrip from "./components/IncomingOrdersStrip";
import AcceptedOrdersStrip from "./components/AcceptedOrdersStrip";

export default function FarmerDashboardPage() {
  return (
    <Box width="full">
      <Stack gap="6">
        {/* Page header */}
        <Heading size="lg">Farmer Dashboard</Heading>

        {/* Incoming (pending) orders */}
        <IncomingOrdersStrip title="Incoming Orders" />

        <Separator />

        {/* Accepted (ok) orders grouped by date + shift */}
        <AcceptedOrdersStrip title="Accepted Orders" />
      </Stack>
    </Box>
  );
}
