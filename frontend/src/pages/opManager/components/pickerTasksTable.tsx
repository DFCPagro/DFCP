import * as React from "react"
import { Box, Heading, HStack, Text, Badge, Code, Button, Table } from "@chakra-ui/react"
import type { PickerTask, PickerTaskListResponse } from "@/api/pickerTask"

const fmtKg = (n?: number) => (typeof n === "number" ? n.toFixed(2) : "0.00")
const fmtL = (n?: number) => (typeof n === "number" ? n.toFixed(1) : "0.0")
const shortId = (id?: string) => (id && id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id || "-")
const titleCase = (s?: string) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "")

export default function PickerTasksTable({
  data,
  onView,
}: {
  data: PickerTaskListResponse
  onView: (task: PickerTask) => void
}) {
  const counts = data.countsByStatus || {}
  const subtitle = [
    `${data.pagination?.total ?? data.items.length} total`,
    ...Object.entries(counts).filter(([, v]) => !!v).map(([k, v]) => `${k}: ${v}`),
  ].join(" • ")

  return (
    <Box borderWidth="1px" borderRadius="md" overflow="hidden">
      <Box px={4} py={3} borderBottomWidth="1px">
        <HStack justifyContent="space-between">
          <Heading size="sm">Tasks for current shift</Heading>
          <Text color="gray.600">{subtitle}</Text>
        </HStack>
      </Box>

      <Box p={4} overflowX="auto">
        <Table.Root size="sm" width="full" variant="outline">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Order</Table.ColumnHeader>
              <Table.ColumnHeader>Claimed By</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Boxes</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Total Kg</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Total L</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(data.items ?? []).map((t) => {
              const totalBoxes =
                t.plan?.summary?.totalBoxes ??
                t.plan?.boxes?.length ??
                0

              // prefer top-level → summary → derive from boxes
              const totalKg =
                typeof t.totalEstKg === "number"
                  ? t.totalEstKg
                  : (t.plan?.summary as any)?.totalKg ??
                    (t.plan?.boxes?.reduce((s, b) => s + (b.estWeightKg || 0), 0) ?? 0)

              const totalL =
                typeof t.totalLiters === "number"
                  ? t.totalLiters
                  : (t.plan?.summary as any)?.totalLiters ??
                    (t.plan?.boxes?.reduce((s, b) => s + (b.estFillLiters || 0), 0) ?? 0)

              const claimedBy = t.assignedPickerUserId ? shortId(t.assignedPickerUserId) : "—"

              return (
                <Table.Row key={(t as any)._id ?? (t as any).id}>
                  <Table.Cell><Badge>{titleCase(t.status)}</Badge></Table.Cell>
                  <Table.Cell><Code>{shortId(t.orderId)}</Code></Table.Cell>
                  <Table.Cell>{t.status !== "ready" ? claimedBy : "—"}</Table.Cell>
                  <Table.Cell textAlign="end">{totalBoxes}</Table.Cell>
                  <Table.Cell textAlign="end">{fmtKg(totalKg)}</Table.Cell>
                  <Table.Cell textAlign="end">{fmtL(totalL)}</Table.Cell>
                  <Table.Cell textAlign="end">
                    <Button size="sm" onClick={() => onView(t)}>View details</Button>
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table.Root>
      </Box>
    </Box>
  )
}
