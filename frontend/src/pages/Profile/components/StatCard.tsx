import { Box, Card, HStack, Separator, Text } from "@chakra-ui/react";

// lightweight placeholder that animates within parent page
export default function StatCard() {
  // you can keep your counters here if you want; for brevity this is static
  const title = "Your impact";
  const items = [
    { color: "teal", title: "Farmers supported", value: 7, target: 10 },
    { color: "blue", title: "Total orders", value: 28, target: 40 },
    { color: "purple", title: "MD Coins", value: 420, target: 900 },
  ];

  return (
    <Card.Root variant="outline" borderColor="green.200">
      <Card.Header py={3} px={4} bg="green.50">
        <HStack justify="space-between" align="baseline">
          <Card.Title fontSize="sm" color="green.900" textTransform="uppercase" letterSpacing="widest">
            {title}
          </Card.Title>
          <Text fontSize="xs" color="gray.600">Live counters</Text>
        </HStack>
      </Card.Header>
      <Separator />
      <Card.Body p={4}>
        <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
          {items.map((it) => (
            <Stat key={it.title} {...it} />
          ))}
        </Box>
      </Card.Body>
    </Card.Root>
  );
}

function Stat({ title, value, target, color }: { title: string; value: number; target: number; color: string }) {
  const progress = target > 0 ? Math.min(1, value / target) : 1;
  const scale = 0.9 + 0.2 * progress;
  return (
    <Box
      p={5}
      borderWidth="1px"
      borderColor={`${color}.200`}
      bgGradient={`linear(to-b, ${color}.50, white)`}
      rounded="lg"
      textAlign="center"
      shadow="xs"
    >
      <Text fontSize="xs" color={`${color}.800`} mb={2} letterSpacing="widest" textTransform="uppercase">
        {title}
      </Text>
      <Box transform={`scale(${scale})`} transformOrigin="center">
        <Text fontSize="3xl" fontWeight="extrabold" color={`${color}.900`} lineHeight="shorter">
          {value.toLocaleString()}
        </Text>
      </Box>
      <Box mt={3} h="2" rounded="full" bg={`${color}.100`} overflow="hidden">
        <Box h="full" w={`${progress * 100}%`} bg={`${color}.400`} transition="width 120ms" />
      </Box>
    </Box>
  );
}
