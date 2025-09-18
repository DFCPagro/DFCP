// src/pages/.../components/ScheduleGrid.tsx
import { Box, Button, Table } from "@chakra-ui/react";
import { useState, useEffect } from "react";

import {
  DAYS,
  SHIFTS,
  type Row,
  decodeWeekly,
  encodeWeekly,
  toggleWeeklyCell,
  emptyWeeklyRows,
  clearWeeklyMask,
} from "@/utils/scheduleBitmap";

export function ScheduleGrid({
  value,
  onChange,
}: {
  /** weekly per-day mask (length 7), e.g., [1,1,1,1,1,0,0] */
  value?: number[];
  /** emits weekly per-day mask (length 7) */
  onChange: (weeklyMask: number[]) => void;
}) {
  // Decode incoming weekly mask into a grid of booleans: rows = shifts, cols = days
  const [rows, setRows] = useState<Row[]>(() =>
    decodeWeekly(value ?? clearWeeklyMask())
  );

  // Keep grid in sync if parent changes `value`
  useEffect(() => {
    if (value) setRows(decodeWeekly(value));
  }, [value]);

  const toggle = (r: number, c: number) => {
    setRows((prev) => {
      const next = toggleWeeklyCell(prev, r, c);
      onChange(encodeWeekly(next));
      return next;
    });
  };

  const clearAll = () => {
    setRows(emptyWeeklyRows());
    onChange(clearWeeklyMask()); // [0,0,0,0,0,0,0]
  };

  return (
    <Box>
      <Table.Root size="sm">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader>Shift/Day</Table.ColumnHeader>
            {DAYS.map((d) => (
              <Table.ColumnHeader key={d}>{d}</Table.ColumnHeader>
            ))}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {SHIFTS.map((s, r) => (
            <Table.Row key={s}>
              <Table.Cell fontWeight="semibold">{s}</Table.Cell>
              {DAYS.map((_, c) => (
                <Table.Cell key={c}>
                  <Button
                    size="xs"
                    variant={rows[r][c] ? "solid" : "outline"}
                    onClick={() => toggle(r, c)}
                  >
                    {rows[r][c] ? "✓" : "—"}
                  </Button>
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <Button mt={3} size="sm" onClick={clearAll}>
        Clear
      </Button>
    </Box>
  );
}
