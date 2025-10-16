import { Box, Heading, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Link as CLink } from "@chakra-ui/react";
export default function shiftOrders() {
  return (
    <Box p={6}>
      <Heading size="lg">Shift Orders</Heading>
      <Text mt={2}>
        This is public. Try the{" "}
        <CLink asChild>
          <Link to="/dashboard">Dashboard</Link>
        </CLink>
        .
      </Text>
    </Box>
  );
}
