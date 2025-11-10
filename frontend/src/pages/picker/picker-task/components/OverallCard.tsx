import { Card, HStack, Heading, Text, VStack, Progress } from "@chakra-ui/react"

type Props = {
  done: number
  totalPieces: number
  overallPercent: number
  totalBoxes: number
  totalKg: number
}

export default function OverallCard({ done, totalPieces, overallPercent, totalBoxes, totalKg }: Props) {
  return (
    <Card.Root rounded="2xl" borderWidth="1px">
      <Card.Header>
        <HStack justify="space-between" w="full">
          <Heading size="md">Overall</Heading>
          <Text color="fg.muted">
            {totalBoxes} boxes • ~{totalKg} kg
          </Text>
        </HStack>
      </Card.Header>
      <Card.Body>
        <VStack align="start" gap={3}>
          <Text fontSize="lg">
            {done}/{totalPieces} pieces
          </Text>
          <Progress.Root value={overallPercent} size="lg" w="full">
            <Progress.Track />
            <Progress.Range />
          </Progress.Root>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}
