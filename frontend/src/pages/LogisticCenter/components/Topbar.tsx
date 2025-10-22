import { Container, HStack, Text, Badge } from "@chakra-ui/react"
import { useUIStore } from "@/store/useUIStore"

export default function Topbar() {
  const openScan = useUIStore((s) => s.openScan)
  return (
    <Container maxW="7xl" pt="4">
      <HStack justify="space-between" align="center">
        <Text fontSize="lg" fontWeight="bold">
          Logistics Center — Game View (Green)
        </Text>
        <HStack gap="2" wrap="wrap">
          <Badge variant="outline" colorPalette="lime" borderRadius="full" px="3" py="1">
            Hover: highlight
          </Badge>
          <Badge variant="outline" colorPalette="lime" borderRadius="full" px="3" py="1">
            Click: select
          </Badge>
          <Badge asChild variant="solid" colorPalette="lime" borderRadius="full" px="3" py="2">
            <button onClick={() => openScan("container")}>Scan</button>
          </Badge>
        </HStack>
      </HStack>
    </Container>
  )
}
