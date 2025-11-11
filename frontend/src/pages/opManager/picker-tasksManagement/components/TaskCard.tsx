// src/pages/opManager/picker-tasksManagement/components/TaskCard.tsx
import * as React from "react";
import { Card, HStack, Heading, Spinner, Alert, Text, Badge, Box, Table, Button } from "@chakra-ui/react";
import type { PickerTask, PlanBox, PlanPiece, PickerTaskStatus } from "@/api/pickerTask";


function fmtNum(n: any) {
  if (!Number.isFinite(n)) return "-";
  return Math.round(n * 100) / 100;
}

function badgeColorForStatus(s?: PickerTaskStatus) {
  switch (s) {
    case "ready": return "green";
    case "claimed": return "teal";
    case "in_progress": return "purple";
    case "open": return "gray";
    case "problem": return "red";
    case "cancelled": return "orange";
    case "done": return "blue";
    default: return "gray";
  }
}
  

type Row = {
  key: string;
  task: PickerTask;
  status?: PickerTaskStatus;
  orderId: string;
  boxNo: number;
  boxType: string;
  estKg: number | undefined;
  estUnits: number | undefined;
  liters: number | undefined;
  contents: PlanPiece[];
};

function sumUnits(pieces: PlanPiece[] | undefined): number | undefined {
  if (!pieces?.length) return undefined;
  let sum = 0;
  let hadUnits = false;
  for (const p of pieces) {
    if (typeof p.units === "number") {
      sum += p.units;
      hadUnits = true;
    }
  }
  return hadUnits ? sum : undefined;
}

function flattenTasksToRows(tasks: PickerTask[]): Row[] {
  const rows: Row[] = [];
  for (const t of tasks || []) {
    const boxes: PlanBox[] = t.plan?.boxes ?? [];
    for (const b of boxes) {
      rows.push({
        key: `${t.orderId}_${b.boxNo}`,
        task: t,
        status: t.status,
        orderId: t.orderId,
        boxNo: b.boxNo,
        boxType: b.boxType,
        estKg: b.estWeightKg,
        estUnits: sumUnits(b.contents),
        liters: b.estFillLiters,
        contents: b.contents ?? [],
      });
    }
  }
  return rows;
}

export default function TasksCard({
  tasks,
  total,
  countsByStatus,
  isLoading,
  errorMsg,
  onView,
}: {
  tasks: PickerTask[];
  total: number;
  countsByStatus?: Record<string, number>;
  isLoading?: boolean;
  errorMsg?: string | null;
  onView?: (task: PickerTask) => void;
}) {
  const rows = React.useMemo(() => flattenTasksToRows(tasks || []), [tasks]);

  // Build stat-cards array (Total, Problem, In progress, Open, Done)
  const stats = React.useMemo(() => ([
    { key: "total",       label: "Total",       value: total },
    { key: "problem",     label: "Problem",     value: countsByStatus?.problem ?? 0 },
    { key: "in_progress", label: "In progress", value: countsByStatus?.in_progress ?? 0 },
    { key: "open",        label: "Open",        value: countsByStatus?.open ?? 0 },
    { key: "done",        label: "Done",        value: countsByStatus?.done ?? 0 },
  ]), [total, countsByStatus]);

  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between" align="center" w="full">
          <Heading size="md">Picker Tasks</Heading>
        </HStack>
      </Card.Header>

      <Card.Body>
        {isLoading ? (
          <Spinner />
        ) : errorMsg ? (
          <Alert.Root status="error">
            <Alert.Description>{errorMsg}</Alert.Description>
          </Alert.Root>
        ) : (
          <>

            <Text mb={3}>
              Total tasks: <Badge>{total}</Badge>
            </Text>

            <Box overflowX="auto">
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader>Order</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Box #</Table.ColumnHeader>
                    <Table.ColumnHeader>Box Type</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Est Kg</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Est Units</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Liters</Table.ColumnHeader>
                    <Table.ColumnHeader>Contents</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={r.key}>
                      <Table.Cell>
                        <Badge colorPalette={badgeColorForStatus(r.status)}>
                          {r.status || "open"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>{r.orderId}</Table.Cell>
                      <Table.Cell textAlign="end">{r.boxNo}</Table.Cell>
                      <Table.Cell>{r.boxType}</Table.Cell>
                      <Table.Cell textAlign="end">{fmtNum(r.estKg)}</Table.Cell>
                      <Table.Cell textAlign="end">{fmtNum(r.estUnits)}</Table.Cell>
                      <Table.Cell textAlign="end">{fmtNum(r.liters)}</Table.Cell>
                      <Table.Cell>
                        <HStack wrap="wrap" gap={2}>
                          {(r.contents || []).slice(0, 4).map((c, idx) => (
                            <Badge key={idx} variant="subtle">
                              {c.itemName || c.itemId}
                              {typeof c.estWeightKgPiece === "number" ? ` • ${c.estWeightKgPiece}kg` : ""}
                              {typeof c.units === "number" ? ` • ${c.units}u` : ""}
                            </Badge>
                          ))}
                          {(r.contents?.length ?? 0) > 4 && (
                            <Badge>+{(r.contents?.length ?? 0) - 4} more</Badge>
                          )}
                        </HStack>
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        {onView ? (
                          <Button size="xs" onClick={() => onView(r.task)}>
                            View
                          </Button>
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </Box>
          </>
        )}
      </Card.Body>
    </Card.Root>
  );
}
