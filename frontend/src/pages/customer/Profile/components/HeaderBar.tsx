import { Card, HStack, Heading, Text } from "@chakra-ui/react";

export default function HeaderBar() {
  return (
    <Card.Root
      variant="outline"
      borderColor="teal.300"
      shadow="sm"
      bgGradient="linear(to-r, teal.50, green.50)"
      mb={8}
    >
      <Card.Body py={4} px={5}>
        <HStack justify="space-between" align="center">
          <Heading size="md" color="teal.900" letterSpacing="tight">
            Profile
          </Heading>
          <Text fontSize="sm" color="teal.800">
            Contact, photo, addresses, and community
          </Text>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
