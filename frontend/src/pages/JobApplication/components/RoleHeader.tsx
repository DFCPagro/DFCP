import { Box, Heading, Text } from "@chakra-ui/react";

export function RoleHeader({ roleName, description }: { roleName: string; description: string }) {
  return (
    <Box mb={6}>
      <Heading size="lg">Employment Application — {roleName}</Heading>
      <Text mt={2} color="gray.500">
        Ensure your personal details are up to date. We will contact you using the details below.
      </Text>
      {description && <Text mt={1}>{description}</Text>}
    </Box>
  );
}
