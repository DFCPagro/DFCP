import { Box, Heading, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { Link as CLink } from "@chakra-ui/react";
export default function Home() {
  return (
    <Box p={6}>
      <Heading size="lg">Home</Heading>
      <Text mt={2}>
        This is public. Try the{" "}
        {/* <CLink as={Link}>
          <Link to="/dashboard">Dashboard</Link>
        </CLink> */}
        .
      </Text>
    </Box>
  );
}
