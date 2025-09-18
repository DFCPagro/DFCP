// src/pages/.../components/ScheduleGrid.tsx
import { Box, Button, Table } from "@chakra-ui/react";
import { useState, useEffect } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// Display order you requested: Morning, Afternoon, Evening, Night
const SHIFTS = ["Morning","Afternoon", "Evening",  "Night"] as const;

// Backend bit mapping (keep this stable!)
// Morning=1, Afternoon=2, Evening=4, Night=8
const SHIFT_BITS: Record<(typeof SHIFTS)[number], number> = {
  Morning: 1,
  Afternoon: 2,
  Evening: 4,
  Night: 8,
};

type Row = boolean[]; // per shift row: boolean[7] for 7 days

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
    decodeWeekly(value ?? Array(DAYS.length).fill(0))
  );

  // If parent changes `value`, keep grid in sync
  useEffect(() => {
    if (!value) return;
    setRows(decodeWeekly(value));
  }, [value]);

  const toggle = (r: number, c: number) => {
    setRows((prev) => {
      const copy = prev.map((row) => row.slice());
      copy[r][c] = !copy[r][c];
      const weekly = encodeWeekly(copy);
      onChange(weekly);
      return copy;
    });
  };

  const clearAll = () => {
    const empty: Row[] = Array.from({ length: SHIFTS.length }, () =>
      Array(DAYS.length).fill(false)
    );
    setRows(empty);
    onChange(Array(DAYS.length).fill(0)); // [0,0,0,0,0,0,0]
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

/** Encode: rows (shifts x days) -> weekly per-day mask (length 7) */
function encodeWeekly(rows: Row[]): number[] {
  const days = DAYS.length; // 7
  const weekly = Array(days).fill(0);
  for (let day = 0; day < days; day++) {
    let dayMask = 0;
    for (let s = 0; s < SHIFTS.length; s++) {
      if (rows[s]?.[day]) {
        const bit = SHIFT_BITS[SHIFTS[s]];
        dayMask |= bit;
      }
    }
    weekly[day] = dayMask; // 0..15 for 4 shifts
  }
  return weekly;
}

/** Decode: weekly per-day mask (length 7) -> rows (shifts x days) */
function decodeWeekly(weeklyMask: number[]): Row[] {
  const days = DAYS.length;
  // pad/truncate to 7 to be safe
  const padded = weeklyMask
    .slice(0, days)
    .concat(Array(Math.max(0, days - weeklyMask.length)).fill(0));

  const rows: Row[] = Array.from({ length: SHIFTS.length }, () =>
    Array(days).fill(false)
  );

  for (let s = 0; s < SHIFTS.length; s++) {
    const bit = SHIFT_BITS[SHIFTS[s]];
    for (let day = 0; day < days; day++) {
      rows[s][day] = (padded[day] & bit) !== 0;
    }
  }
  return rows;
}
