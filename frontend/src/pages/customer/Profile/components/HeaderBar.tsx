import { Card, HStack, Heading, Text } from "@chakra-ui/react";

export default function HeaderBar() {
  return (
    <Card.Root
      variant="outline"
      borderColor="teal.300"
      shadow="sm"
      bgGradient="linear(to-r, teal.50, green.50)"
      mb={8}
      maxW="55vw"
      minW="55vw"
    >
      <Card.Body py={4} maxW="100vw">
        <HStack justify="space-between" align="center" w="full">
          <Heading size="md" color="teal.900" letterSpacing="tight"  w="full">
            Profile
          </Heading>

        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
