import * as React from "react";
import { Card, HStack, Heading, Spinner, Alert, Text, Badge, Box, Table } from "@chakra-ui/react";
import type { PickerTask } from "@/api/pickerTask";

function fmtNum(n: any) {
  if (!Number.isFinite(n)) return "-";
  return Math.round(n * 100) / 100;
}
function badgeColorForStatus(s?: string) {
  switch (s) {
    case "ready":
      return "green";
    case "claimed":
      return "purple";
    case "in_progress":
      return "orange";
    case "open":
      return "gray";
    case "problem":
      return "red";
    case "cancelled":
      return "gray";
    case "done":
      return "blue";
    default:
      return "gray";
  }
}


export default function TasksCard({
  tasks,
  total,
  countsByStatus,
  isLoading,
  errorMsg,
}: {
  tasks: PickerTask[];
  total: number;
  countsByStatus?: Record<string, number>;
  isLoading?: boolean;
  errorMsg?: string | null;
}) {
  return (
    <Card.Root>
      <Card.Header>
        <HStack justify="space-between" align="center">
          <Heading size="md">Picker Tasks</Heading>
          <HStack>
            {countsByStatus &&
              Object.entries(countsByStatus).map(([k, v]) => (
                <Badge key={k} variant="outline">
                  {k}: {v}
                </Badge>
              ))}
          </HStack>
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
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(tasks || []).map((t) => (
                    <Table.Row key={`${t.orderId}_${t.boxNo}`}>
                      <Table.Cell>
                        <Badge colorPalette={badgeColorForStatus(t.status)}>{t.status || "open"}</Badge>
                      </Table.Cell>
                      <Table.Cell>{t.orderId}</Table.Cell>
                      <Table.Cell textAlign="end">{t.boxNo}</Table.Cell>
                      <Table.Cell>{t.boxType}</Table.Cell>
                      <Table.Cell textAlign="end">{fmtNum(t.totalEstKg)}</Table.Cell>
                      <Table.Cell textAlign="end">{fmtNum(t.totalEstUnits)}</Table.Cell>
                      <Table.Cell textAlign="end">{fmtNum(t.totalLiters)}</Table.Cell>
                      <Table.Cell>
                        <HStack wrap="wrap" gap={2}>
                          {(t.contents || []).slice(0, 4).map((c, idx) => (
                            <Badge key={idx} variant="subtle">
                              {c.name} {typeof c.estWeightKgPiece === "number" ? `• ${c.estWeightKgPiece}kg` : ""}
                              {typeof c.estUnitsPiece === "number" ? `• ${c.estUnitsPiece}u` : ""}
                            </Badge>
                          ))}
                          {(t.contents || []).length > 4 && <Badge>+{(t.contents || []).length - 4} more</Badge>}
                        </HStack>
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
