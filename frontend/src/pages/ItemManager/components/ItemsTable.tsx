import { Badge, Box, HStack, Spinner, Table } from "@chakra-ui/react"
import { Pencil, Trash2 } from "lucide-react"
import type { ItemsTableProps } from "../types"
import { StyledIconButton } from "@/components/ui/IconButton"

export default function ItemsTable({ items, isBusy, onEdit, onDelete }: ItemsTableProps) {
  return (
    <Box borderWidth="1px" borderRadius="md" overflow="hidden">
      <Box px={4} py={2} borderBottomWidth="1px" display="flex" alignItems="center" gap={3}>
        <Box fontWeight="semibold">Items</Box>
        {isBusy && <Spinner size="sm" />}
        <Box flex="1" />
      </Box>

      <Table.ScrollArea>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Category</Table.ColumnHeader>
              <Table.ColumnHeader>Type</Table.ColumnHeader>
              <Table.ColumnHeader>Variety</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Calories/100g</Table.ColumnHeader>
              <Table.ColumnHeader>Price (A/B/C)</Table.ColumnHeader>
              <Table.ColumnHeader>Updated</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {items.map((it) => (
              <Table.Row key={it._id}>
                <Table.Cell><Badge>{it.category}</Badge></Table.Cell>
                <Table.Cell>{it.type}</Table.Cell>
                <Table.Cell>{it.variety ?? "-"}</Table.Cell>
                <Table.Cell textAlign="end">{it.caloriesPer100g ?? "-"}</Table.Cell>
                <Table.Cell>
                  {it.price
                    ? [it.price.a, it.price.b, it.price.c].map((v) => v ?? "-").join(" / ")
                    : "-"}
                </Table.Cell>
                <Table.Cell>
                  {it.updatedAt ? new Date(it.updatedAt).toLocaleString() : "-"}
                </Table.Cell>
                <Table.Cell textAlign="end">
                  <HStack justify="flex-end" gap="1">
                    <StyledIconButton
                      size="xs"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() => onEdit(it)}
                    >
                      <Pencil size={16} />
                    </StyledIconButton>
                    <StyledIconButton
                      size="xs"
                      variant="ghost"
                      colorPalette="red"
                      aria-label="Delete"
                      onClick={() => onDelete(it)}
                    >
                      <Trash2 size={16} />
                    </StyledIconButton>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            ))}

            {items.length === 0 && !isBusy && (
              <Table.Row>
                <Table.Cell colSpan={7}>
                  <Box py={6} textAlign="center" color="fg.muted">
                    No items found
                  </Box>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
    </Box>
  )
}
