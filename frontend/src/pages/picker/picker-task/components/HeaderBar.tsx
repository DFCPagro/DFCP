import { HStack, Heading, Badge, Text, Box, Progress } from "@chakra-ui/react"

type Props = {
  orderId?: string | number
  priority?: number
  phase: "load" | "pick"
  overall: number
}

export default function HeaderBar({ orderId, priority = 0, phase, overall }: Props) {
  return (
    <Box mb={5} p={4} rounded="2xl" borderWidth="1px" bg="bg.muted" _dark={{ bg: "gray.800" }}>
      <HStack justify="space-between" align="center" gap={4} wrap="wrap">
        <HStack gap={4}>
          <Heading size="lg">Order {orderId}</Heading>
          <Badge size="lg" variant="solid" colorPalette={priority > 0 ? "red" : "blue"}>
            {priority > 0 ? "RUSH" : "NORMAL"}
          </Badge>
          <Badge size="lg" variant="subtle" colorPalette={phase === "load" ? "yellow" : "teal"}>
            {phase === "load" ? "Load" : "Pick"}
          </Badge>
        </HStack>

        <HStack gap={3} minW="260px">
          <Text fontWeight="bold" fontSize="lg">
            Progress
          </Text>
          <Progress.Root value={overall} size="lg" w="180px">
            <Progress.Track />
            <Progress.Range />
          </Progress.Root>
          <Text fontSize="md" fontWeight="semibold">
            {overall}%
          </Text>
        </HStack>
      </HStack>
    </Box>
  )
}
