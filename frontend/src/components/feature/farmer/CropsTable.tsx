import { Box, Button, Heading, HStack, Table, Badge } from "@chakra-ui/react";
import type { CropRow } from "@/types/farmer";
import { fmtDate } from "@/helpers/datetime";

export default function CropsTable({ rows }: { rows: CropRow[] }) {
  return (
    <Box>
      <Heading size="md" mt={8} mb={3}>My Crops Status</Heading>

      <Table.Root size="sm" variant="line">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Land</Table.ColumnHeader>
            <Table.ColumnHeader>Crop Item</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Planted (kg)</Table.ColumnHeader>
            <Table.ColumnHeader>Planted On</Table.ColumnHeader>
            <Table.ColumnHeader>Status</Table.ColumnHeader>
            <Table.ColumnHeader>Last Updated On</Table.ColumnHeader>
            <Table.ColumnHeader textAlign="end">Percentage</Table.ColumnHeader>
            <Table.ColumnHeader>Image</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {rows.map((c, i) => (
            <Table.Row key={`${c.land}-${i}`}>
              <Table.Cell>{c.land}</Table.Cell>
              <Table.Cell>{c.cropItem}</Table.Cell>
              <Table.Cell textAlign="end">{c.plantedKg.toLocaleString()}</Table.Cell>
              <Table.Cell>{fmtDate(c.plantedOnISO)}</Table.Cell>
              <Table.Cell>{c.status}</Table.Cell>
              <Table.Cell>{fmtDate(c.lastUpdatedISO)}</Table.Cell>
              <Table.Cell textAlign="end">
                <Badge colorPalette={c.percentage > 60 ? "green" : c.percentage > 40 ? "yellow" : "blue"}>
                  {c.percentage}%
                </Badge>
              </Table.Cell>
              <Table.Cell>
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.cropItem}
                    style={{ width: 42, height: 32, objectFit: "cover", borderRadius: 6 }}
                  />
                ) : "—"}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      <HStack justify="flex-end" mt={3}>
        <Button size="sm">Manage Crops</Button>
      </HStack>
    </Box>
  );
}
