import { Box, HStack, Badge, Text } from "@chakra-ui/react"

type Props = {
  priority: number
  timeLabel: string
}

export default function TimerPill({ priority, timeLabel }: Props) {
  return (
    <Box
      position="fixed"
      right="6"
      top="32"

      zIndex="modal"
      bg="white"
      _dark={{ bg: "gray.900" }}
      borderWidth="1px"
      rounded="full"
      px={4}
      py={2}
      shadow="md"
    >
      <HStack gap={3}>
        <Badge variant="solid" colorPalette={priority > 0 ? "red" : "teal"}>
          SLA
        </Badge>
        <Text fontSize="xl" fontWeight="semibold" minW="80px" textAlign="center">
          {timeLabel}
        </Text>
      </HStack>
    </Box>
  )
}
