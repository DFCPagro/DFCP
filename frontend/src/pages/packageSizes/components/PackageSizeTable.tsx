import { useMemo } from "react";
import { Table, Badge, Box, HStack, Text, Icon } from "@chakra-ui/react";
import { StyledButton } from "@/components/ui/Button";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import type { PackageSize } from "@/types/package-sizes";
import { Tooltip } from "@/components/ui/tooltip";

type Props = {
  items: PackageSize[];
  onDelete(item: PackageSize): void;
  onView(item: PackageSize): void; // opens modal (edit form)
  sort?: string;
  onSort?(sort: string): void;
};

const headers = [
  { key: "key", label: "Key", sortable: true },
  { key: "name", label: "Name", sortable: true },
  { key: "usableLiters", label: "Usable Liters", sortable: true },
  { key: "actions", label: "", sortable: false },
] as const;

export default function PackageSizeTable({ items, onDelete, onView, sort, onSort }: Props) {
  const sortKey = useMemo(() => (sort?.startsWith("-") ? sort.slice(1) : sort ?? "key"), [sort]);
  const sortDir = useMemo<"asc" | "desc">(() => (sort?.startsWith("-") ? "desc" : "asc"), [sort]);

  const toggleSort = (key: string) => {
    if (!onSort) return;
    if (sortKey !== key) onSort(key);
    else onSort(sortDir === "asc" ? `-${key}` : key);
  };

  return (
    <Box overflow="auto" rounded="xl" borderWidth="1px">
      <Table.Root size="md" striped interactive>
        <Table.Header>
          <Table.Row>
            {headers.map((h) => (
              <Table.ColumnHeader
                key={h.key}
                onClick={h.sortable ? () => toggleSort(h.key) : undefined}
                cursor={h.sortable ? "pointer" : "default"}
                userSelect={h.sortable ? "none" : "auto"}
              >
                <HStack gap="2">
                  <Text>{h.label}</Text>
                  {h.sortable && sortKey === h.key && (
                    <Badge colorPalette="gray" variant="surface">
                      {sortDir === "asc" ? "↑" : "↓"}
                    </Badge>
                  )}
                </HStack>
              </Table.ColumnHeader>
            ))}
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {items.map((item) => {
            const id = item._id ?? item.key!;
            return (
              <Table.Row key={id}>
                <Table.Cell fontWeight="medium">{item.key}</Table.Cell>
                <Table.Cell>{item.name}</Table.Cell>
                <Table.Cell>{item.usableLiters ?? "-"}</Table.Cell>
                <Table.Cell>
                  <HStack justify="flex-end" gap="1.5">
                    <Tooltip content="Edit">
                      <StyledButton aria-label="Edit" onClick={() => onView(item)}>
                        <Icon as={FiEdit2} />
                      </StyledButton>
                    </Tooltip>
                    <Tooltip content="Delete">
                      <StyledButton
                        aria-label="Delete"
                        colorPalette="red"
                        onClick={() => onDelete(item)}
                      >
                        <Icon as={FiTrash2} />
                      </StyledButton>
                    </Tooltip>
                  </HStack>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>

      {items.length === 0 && (
        <Box p="8" textAlign="center" color="fg.muted">
          No package sizes found.
        </Box>
      )}
    </Box>
  );
}
