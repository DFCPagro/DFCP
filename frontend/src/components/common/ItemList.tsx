import { Fragment } from "react"
import {
  Box,
  HStack,
  VStack,
  Text,
  Image,
  Separator,
  Spacer,
} from "@chakra-ui/react"

export type ItemRow = {
  id: string
  name: string
  farmer: string
  imageUrl?: string
  qty: number // e.g., quantity count
  unitLabel?: string // e.g., "unit"
  unitPrice: number // price per unitLabel
  currency?: string // default "$"
}

export default function ItemList({
  items,
  currency = "$", // default currency
  showDividers = true,
}: {
  items: ItemRow[]
  currency?: string
  showDividers?: boolean
}) {
  return (
    <VStack alignItems="stretch" gap="0">
      {items.map((it, idx) => (
        <Fragment key={it.id}>
          <ItemRowView row={it} currency={currency} />
          {showDividers && idx < items.length - 1 && <Separator />}
        </Fragment>
      ))}
    </VStack>
  )
}

function ItemRowView({ row, currency }: { row: ItemRow; currency: string }) {
  const total = row.qty * row.unitPrice

  return (
    <HStack py="3" gap="4" alignItems="center">
      <Box
        w="64px"
        h="64px"
        borderWidth="2px"
        borderColor="blue.500"
        borderRadius="md"
        overflow="hidden"
        flexShrink={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="gray.50"
      >
        {row.imageUrl ? (
          <Image src={row.imageUrl} alt={row.name} w="100%" h="100%" objectFit="cover" />
        ) : (
          <Text fontSize="sm" color="gray.500">
            img
          </Text>
        )}
      </Box>

      <VStack alignItems="flex-start" gap="0" flex="1" minW="0">
        <Text fontSize="lg" fontWeight="semibold" lineClamp={1}>
          {row.name}
        </Text>
        <Text fontSize="md" color="gray.600" lineClamp={1}>
          Farmer: {row.farmer}
        </Text>
      </VStack>

      <HStack minW="72px" justifyContent="center">
        <VStack gap="0" alignItems="center">
          <Text fontSize="lg" fontWeight="medium">
            {row.qty}
          </Text>
          <Text fontSize="xs" color="gray.600">
            unit
          </Text>
        </VStack>
      </HStack>

      <VStack minW="110px" gap="0" alignItems="center">
        <Text fontSize="lg" fontWeight="medium">
          {currency}
          {formatMoney(row.unitPrice)}
        </Text>
        <Text fontSize="sm" color="gray.600">
          per {row.unitLabel ?? "unit"}
        </Text>
      </VStack>

      <Spacer />

      <Box minW="90px" textAlign="right">
        <Text fontSize="xl" fontWeight="semibold">
          {currency}
          {formatMoney(total)}
        </Text>
      </Box>
    </HStack>
  )
}

function formatMoney(n: number) {
  return n.toFixed(2)
}
