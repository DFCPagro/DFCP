// src/pages/AdminExpectedHarvest/components/ForecastTable.tsx
import { memo } from "react";
import {
  Box,
  Stack,
  Text,
  Table,
  Skeleton,
  Alert,
} from "@chakra-ui/react";
import type { ForecastRow } from "../hooks/useExpectedForecast";
import type { ShiftFilter } from "./FilterBar";

export type ForecastTableProps = {
  rows: ForecastRow[];
  loading?: boolean;
  error?: Error | null;
  /** "all" or a single shift; affects the subtitle text only */
  shift?: ShiftFilter;
  /** window length used for the median calc (for transparency) */
  samplesUsedDays?: number;
};

function formatKg(n: number) {
  return `${n.toFixed(1)} kg`;
}

function ForecastTableBase({
  rows,
  loading = false,
  error = null,
  shift = "all",
  samplesUsedDays,
}: ForecastTableProps) {
  return (
    <Stack gap="3" width="full" >
      {/* Context line */}
      <Box >
        <Text fontSize="sm" color="fg.muted">
          Forecast horizon: next {rows?.length || 0} day(s)
          {typeof samplesUsedDays === "number" ? ` · window: ${samplesUsedDays} days` : ""}
          {shift !== "all" ? ` · shift: ${shift}` : " · all shifts"}
        </Text>
      </Box>

      {/* Error state */}
      {error ? (
        <Alert.Root status="error">
          <Alert.Indicator />
          {error.message || "Failed to load forecast"}
        </Alert.Root>
      ) : null}

      {/* Loading skeletons */}
      {loading ? (
        <Box>
          <Skeleton height="36px" mb="2" />
          <Skeleton height="28px" mb="2" />
          <Skeleton height="28px" mb="2" />
          <Skeleton height="28px" />
        </Box>
      ) : (
        <Box overflowX="auto">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Day</Table.ColumnHeader>
                <Table.ColumnHeader>Date</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Total (kg)</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows?.length ? (
                rows.map((r) => (
                  <Table.Row key={r.dayOffset}>
                    <Table.Cell>
                      After {r.dayOffset} day{r.dayOffset > 1 ? "s" : ""}
                    </Table.Cell>
                    <Table.Cell>{r.date}</Table.Cell>
                    <Table.Cell textAlign="end">{formatKg(r.totalKg)}</Table.Cell>
                  </Table.Row>
                ))
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={3}>
                    <Text fontSize="sm" color="fg.muted">
                      No forecast data
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

export const ForecastTable = memo(ForecastTableBase);
export default ForecastTable;
