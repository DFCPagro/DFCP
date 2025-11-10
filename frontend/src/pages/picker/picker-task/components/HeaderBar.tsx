import { Box, HStack, Heading, Badge, Text, Progress } from "@chakra-ui/react"

type Props = {
  orderId: string | number
  priority: number
  phase: "load" | "pick"
  overall: number
}

export default function HeaderBar({ orderId, priority, phase, overall }: Props) {
  return (
    <Box mb={5} p={4} rounded="2xl" borderWidth="1px" bg="bg.muted" _dark={{ bg: "gray.800" }}>
      <HStack justify="space-between" align="center" wrap="wrap" gap={4}>
        <HStack gap={4}>
          <Heading size="lg">Order {orderId}</Heading>
          <Badge size="lg" variant="solid" colorPalette={priority > 0 ? "red" : "blue"}>
            {priority > 0 ? "RUSH" : "NORMAL"}
          </Badge>
          <Badge size="lg" variant="subtle" colorPalette={phase === "load" ? "yellow" : "teal"}>
            {phase === "load" ? "Load" : "Pick"}
          </Badge>
        </HStack>

        <HStack gap={3} minW="260px" w="full" maxW="420px">
          <Text fontWeight="bold" fontSize="lg">
            Progress
          </Text>
          <Progress.Root value={overall} size="lg" w="full">
            <Progress.Track />
            <Progress.Range />
          </Progress.Root>
          <Text fontSize="md" fontWeight="semibold" minW="48px" textAlign="right">
            {overall}%
          </Text>
        </HStack>
      </HStack>
    </Box>
  )
}
