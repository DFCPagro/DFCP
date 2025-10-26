import { Box, HStack, Input, NativeSelect, Text } from "@chakra-ui/react"
import type { FiltersBarProps } from "../types"

export default function FiltersBar({ query, setQuery }: FiltersBarProps) {
  return (
    <HStack gap={3} align="flex-end" wrap="wrap">
      <Box minW="200px">
        <Text fontSize="sm" mb={1}>Category</Text>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={query.category ?? ""}
            onChange={(e) =>
              setQuery((s) => ({
                ...s,
                page: 1,
                category: (e.target.value || "") as any,
              }))
            }
          >
            <option value="">All</option>
            <option value="fruit">fruit</option>
            <option value="vegetable">vegetable</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>

      <Box flex={1} minW="260px">
        <Text fontSize="sm" mb={1}>Search (type / variety)</Text>
        <Input
          placeholder="search…"
          value={query.q ?? ""}
          onChange={(e) => setQuery((s) => ({ ...s, page: 1, q: e.target.value }))}
        />
      </Box>

      <Box minW="220px">
        <Text fontSize="sm" mb={1}>Sort</Text>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={query.sort}
            onChange={(e) => setQuery((s) => ({ ...s, sort: e.target.value }))}
          >
            <option value="-updatedAt,type">Recently updated</option>
            <option value="type">Type ↑</option>
            <option value="-type">Type ↓</option>
            <option value="category,type">Category, Type</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Box>
    </HStack>
  )
}
