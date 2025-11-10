"use client"
import * as React from "react"
import { Box, Card, HStack, Text, Separator, Skeleton } from "@chakra-ui/react"
import { getMdCoinsBalance } from "@/api/user"

type StatItem = { color: string; title: string; value: number | null; target: number }

export default function StatCard() {
  const title = "Your impact"
  const [mdCoins, setMdCoins] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const v = await getMdCoinsBalance() // -> Promise<number>
        if (alive) setMdCoins(typeof v === "number" ? v : 0)
      } catch {
        if (alive) setMdCoins(0)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const items: StatItem[] = [
    { color: "teal", title: "Farmers supported", value: 7, target: 10 },
    { color: "blue", title: "Total orders", value: 28, target: 40 },
    { color: "purple", title: "MD Coins", value: mdCoins, target: 900 },
  ]

  return (
    <Card.Root variant="outline" borderColor="green.200">
      <Card.Header py={3} px={4} bg="green.50">
        <HStack justify="space-between" align="baseline">
          <Text as="span" fontSize="sm" color="green.900" textTransform="uppercase" letterSpacing="widest">
            {title}
          </Text>
          <Text fontSize="xs" color="gray.600">
            Live counters
          </Text>
        </HStack>
      </Card.Header>

      <Separator />

      <Card.Body p={4}>
        <Box display="grid" gridTemplateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
          {items.map((it) => (
            <Stat key={it.title} {...it} loading={loading && it.title === "MD Coins"} />
          ))}
        </Box>
      </Card.Body>
    </Card.Root>
  )
}

function Stat({
  title,
  value,
  target,
  color,
  loading = false,
}: {
  title: string
  value: number | null
  target: number
  color: string
  loading?: boolean
}) {
  const safeValue = typeof value === "number" ? value : 0
  const progress = target > 0 ? Math.min(1, safeValue / target) : 1
  const scale = 0.9 + 0.2 * progress

  return (
    <Box
      p={5}
      borderWidth="1px"
      borderColor={`${color}.200`}
      bgGradient={`linear(to-b, ${color}.50, white)`}
      borderRadius="lg"
      textAlign="center"
      shadow="xs"
    >
      <Text fontSize="xs" color={`${color}.800`} mb={2} letterSpacing="widest" textTransform="uppercase">
        {title}
      </Text>

      <Box transform={`scale(${scale})`} transformOrigin="center" minH="2.5rem">
        {loading ? (
          <Skeleton height="2.2rem" mx="auto" w="60%" borderRadius="md" />
        ) : (
          <Text fontSize="3xl" fontWeight="extrabold" color={`${color}.900`} lineHeight="shorter">
            {safeValue.toLocaleString()}
          </Text>
        )}
      </Box>

      <Box mt={3} h="2" borderRadius="full" bg={`${color}.100`} overflow="hidden" aria-label={`${title} progress`}>
        <Box h="full" w={`${progress * 100}%`} bg={`${color}.400`} transition="width 180ms ease-out" />
      </Box>
    </Box>
  )
}
