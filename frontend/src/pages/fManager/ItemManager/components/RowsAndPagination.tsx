import { Button, ButtonGroup, HStack, NativeSelect, Text } from "@chakra-ui/react"
import type { RowsAndPaginationProps } from "../types"
import { useMemo } from "react"

export default function RowsAndPagination({
  limit,
  pages,
  currentPage,
  onLimitChange,
  onPageChange,
}: RowsAndPaginationProps) {
  const pagination = useMemo(() => {
    const buttons = []
    for (let p = 1; p <= pages; p++) {
      const active = p === currentPage
      buttons.push(
        <Button
          key={p}
          size="sm"
          variant={active ? "solid" : "outline"}
          onClick={() => onPageChange(p)}
        >
          {p}
        </Button>
      )
    }
  return <ButtonGroup attached size="sm">{buttons}</ButtonGroup>
  }, [pages, currentPage, onPageChange])

  return (
    <HStack p={3} borderTopWidth="1px" justify="space-between">
      <HStack>
        <Text fontSize="sm">Rows:</Text>
        <NativeSelect.Root width="70px">
          <NativeSelect.Field
            value={String(limit)}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>
      {pagination}
    </HStack>
  )
}
