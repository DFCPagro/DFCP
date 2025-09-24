import { memo, useMemo } from "react";
import {
  Box,
  Stack,
  Heading,
  Text,
  Table,
  Skeleton,
  useToken,
} from "@chakra-ui/react";
import { Sparkline } from "./Sparkline";
import type { FarmerRow } from "../hooks/useFarmerBreakdown";

export type FarmersBreakdownProps = {
  title?: string;
  datesAsc: string[];
  rows: FarmerRow[];
  loading?: boolean;
};

function FarmersBreakdownBase({
  title = "Farmers Breakdown (last days)",
  datesAsc,
  rows,
  loading,
}: FarmersBreakdownProps) {
  const [teal500, blue500] = useToken("colors", ["teal.500", "blue.500"]);

  // aggregate totals across farmers (for the big sparkline)
  const totalsAsc = useMemo(() => {
    if (!datesAsc.length) return [];
    return datesAsc.map((_, idx) =>
      rows.reduce((sum, r) => sum + (r.seriesAsc[idx] ?? 0), 0)
    );
  }, [datesAsc, rows]);

  return (
    <Stack gap="4" width="full">
      <Box>
        <Heading size="sm">{title}</Heading>
        <Text fontSize="sm" color="fg.muted">
          Per-farmer daily harvest amounts (kg) and trends over the last {datesAsc.length} days.
        </Text>
      </Box>

      {/* Aggregate totals sparkline */}
      {totalsAsc.length ? (
        <Box>
          <Text fontSize="sm" mb="1" color="fg.muted">
            Aggregate total (all farmers)
          </Text>
          <Sparkline
            data={totalsAsc}
            width={560}
            height={80}
            stroke={teal500}
            fill={teal500}
            fillOpacity={0.12}
            strokeWidth={2}
            title="Aggregate harvest trend"
          />
          <Text mt="1" fontSize="xs" color="fg.muted">
            {datesAsc[0] ?? "—"} → {datesAsc[datesAsc.length - 1] ?? "—"}
          </Text>
        </Box>
      ) : null}

      {/* Table */}
      {loading ? (
        <Box>
          <Skeleton height="28px" mb="2" />
          <Skeleton height="28px" mb="2" />
          <Skeleton height="28px" />
        </Box>
      ) : (
        <Box overflowX="auto">
          <Table.Root size="sm" width="full">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Farmer</Table.ColumnHeader>
                <Table.ColumnHeader>Trend</Table.ColumnHeader>
                {datesAsc.map((d) => (
                  <Table.ColumnHeader key={d} textAlign="end">
                    {d}
                  </Table.ColumnHeader>
                ))}
                <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.length ? (
                rows.map((r) => (
                  <Table.Row key={r.farmerId}>
                    <Table.Cell>{r.farmerName}</Table.Cell>
                    <Table.Cell>
                      <Sparkline
                        data={r.seriesAsc}
                        width={160}
                        height={36}
                        fill={blue500}
                        fillOpacity={0.12}
                        stroke={blue500}
                        strokeWidth={2}
                        title={`Trend for ${r.farmerName}`}
                      />
                    </Table.Cell>
                    {datesAsc.map((d) => (
                      <Table.Cell key={d} textAlign="end">
                        {r.byDate[d]?.toFixed(1) ?? "0.0"} kg
                      </Table.Cell>
                    ))}
                    <Table.Cell textAlign="end">{r.totalKg.toFixed(1)} kg</Table.Cell>
                  </Table.Row>
                ))
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={2 + datesAsc.length + 1}>
                    <Text fontSize="sm" color="fg.muted">
                      No data for the current filters.
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      )}
    </Stack>
  );
}

export const FarmersBreakdown = memo(FarmersBreakdownBase);
export default FarmersBreakdown;
