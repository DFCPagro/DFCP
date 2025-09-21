// src/pages/FarmerCropManagement/components/CropsTable.tsx
import {
  Badge,
  Box,
  Button,
  HStack,
  Image,
  Spinner,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { fmtGrams, fmtPercent } from "@/utils/format";
import { derivePercent } from "@/utils/date";
import { resolveCropImage } from "@/utils/images";
import EmptyState from "./EmptyState";
import type { SectionDTO } from "@/types/agri";

export type CropsTableProps = {
  landName: string | null | undefined;
  /** Selected section to display crops for */
  section: SectionDTO | null | undefined;
  /** Loading flag for sections/crops query */
  isLoading?: boolean;
  /** Trigger to open the Add Crop drawer */
  onAddCropClick?: () => void;
};

const STATUS_COLOR: Record<string, string> = {
  planting: "gray",
  growing: "green",
  readyForHarvest: "teal",
  clearing: "orange",
  problem: "red",
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleDateString();
}

export default function CropsTable({
  landName,
  section,
  isLoading = false,
  onAddCropClick,
}: CropsTableProps) {
  const crops = section?.crops ?? [];

  // Top area: title + add button
  return (
    <Stack gap="3" w="full">
      <HStack justify="space-between">
        <Stack gap="0">
          <Text fontSize="lg" fontWeight="semibold">
            Crops in {section?.name ?? "Section"}
          </Text>
          <Text color="fg.muted" fontSize="sm">
            Land: {landName ?? "—"} • Last updated: {formatDate(section?.updatedAt)}
          </Text>
        </Stack>

        <Button onClick={onAddCropClick} size="sm">
          Add Crop
        </Button>
      </HStack>

      {isLoading ? (
        <Box borderWidth="1px" rounded="lg" p="6" textAlign="center">
          <HStack justify="center" gap="3">
            <Spinner />
            <Text>Loading crops…</Text>
          </HStack>
        </Box>
      ) : !section ? (
        <EmptyState
          title="No section selected"
          subtitle="Choose a section to view its crops."
          showOutline
        />
      ) : crops.length === 0 ? (
        <EmptyState
          title="No crops yet"
          subtitle="Add your first crop to this section."
          action={
            <Button size="sm" onClick={onAddCropClick}>
              Add Crop
            </Button>
          }
        />
      ) : (
        <Box overflowX="auto">
          <Table.Root size="sm" variant="outline">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Land Name</Table.ColumnHeader>
                <Table.ColumnHeader>Crop Name</Table.ColumnHeader>
                <Table.ColumnHeader>Planted Amount</Table.ColumnHeader>
                <Table.ColumnHeader>Planted On</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader>Last Updated On</Table.ColumnHeader>
                <Table.ColumnHeader>Percentage</Table.ColumnHeader>
                <Table.ColumnHeader>Image</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {crops.map((c, idx) => {
                const pct =
                  typeof c.statusPercentage === "number" && isFinite(c.statusPercentage)
                    ? c.statusPercentage
                    : derivePercent(c.plantedOnDate, c.expectedHarvestDate) ?? null;

                const { src, fallbackSrc } = resolveCropImage(c, 48);

                return (
                  <Table.Row key={`${c.itemId}-${idx}`}>
                    <Table.Cell>{landName ?? "—"}</Table.Cell>
                    <Table.Cell>{c.cropName ?? "—"}</Table.Cell>
                    <Table.Cell>{fmtGrams(c.plantedAmountGrams)}</Table.Cell>
                    <Table.Cell>{formatDate(c.plantedOnDate)}</Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={STATUS_COLOR[c.status] ?? "gray"}>
                        {c.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{formatDate(section.updatedAt)}</Table.Cell>
                    <Table.Cell>{fmtPercent(pct)}</Table.Cell>
                    <Table.Cell>
                      <Image
                        src={src}
                        alt={c.cropName || "Crop"}
                        h="10"
                        w="10"
                        rounded="md"
                        onError={(e) => {
                          // fallback for v3 (no fallbackSrc prop)
                          (e.currentTarget as HTMLImageElement).src = fallbackSrc;
                        }}
                      />
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Stack>
  );
}
