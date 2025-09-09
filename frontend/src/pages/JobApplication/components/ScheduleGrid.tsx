import {
  Box,
  Button,
  Table,
} from "@chakra-ui/react";
import { useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const SHIFTS = ["Morning", "Afternoon", "Evening"] as const;
type Row = boolean[];

export function ScheduleGrid({
  value,
  onChange,
}: {
  value?: number[];
  onChange: (mask: number[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => decode(value ?? [0, 0, 0]));

  const toggle = (r: number, c: number) => {
    setRows((prev) => {
      const copy = prev.map((row) => row.slice());
      copy[r][c] = !copy[r][c];
      const mask = encode(copy);
      onChange(mask);
      return copy;
    });
  };

  const clearAll = () => {
    const empty: Row[] = SHIFTS.map(() => DAYS.map(() => false));
    setRows(empty);
    onChange([0, 0, 0]);
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

function encode(rows: Row[]): number[] {
  return rows.map((row) =>
    row.reduce((acc, on, i) => (on ? acc | (1 << i) : acc), 0)
  );
}
function decode(mask: number[]): Row[] {
  return mask.map((m) => DAYS.map((_, i) => !!(m & (1 << i))));
}
