// frontend/src/pages/opManager/picker-tasksManagement/components/pickerTasksTable.tsx
import * as React from "react"
import { Box, Heading, HStack, Text, Badge, Code, Button, Table } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import type { PickerTask, PickerTaskListResponse } from "@/api/pickerTask"
import { getContactInfoById } from "@/api/user" // <- NEW

type ContactInfo = {
  name?: string | null
  email?: string | null
  phone: string
  birthday?: string | null
}

const fmtKg = (n?: number) => (typeof n === "number" ? n.toFixed(2) : "0.00")
const fmtL  = (n?: number) => (typeof n === "number" ? n.toFixed(1) : "0.0")
const shortId = (id?: string) => (id && id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id || "-")
const titleCase = (s?: string) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "")

/** Badge styles by status */
const STATUS_BADGE: Record<
  NonNullable<PickerTask["status"]>,
  { bg: string; color: string; border: string }
> = {
  open:        { bg: "gray.50",   color: "gray.800",  border: "gray.200" },
  ready:       { bg: "green.50",  color: "green.800", border: "green.200" },
  claimed:     { bg: "purple.50", color: "purple.800", border: "purple.200" },
  in_progress: { bg: "blue.50",   color: "blue.800",  border: "blue.200" },
  done:        { bg: "teal.50",   color: "teal.800",  border: "teal.200" },
  cancelled:   { bg: "orange.50", color: "orange.800", border: "orange.200" },
  problem:     { bg: "red.50",    color: "red.800",   border: "red.200" },
}

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

  // Bring "problem" to the top
  const sortedItems = React.useMemo(() => {
    const score = (t: PickerTask) => (t.status === "problem" ? 1 : 0)
    return [...(data.items ?? [])].sort((a, b) => score(b) - score(a))
  }, [data.items])

  // --- NEW: batch fetch contact info for assigned pickers ---
  const assignedIds = React.useMemo(() => {
    const s = new Set<string>()
    for (const t of sortedItems) {
      if (t.assignedPickerUserId) s.add(String(t.assignedPickerUserId))
    }
    return Array.from(s)
  }, [sortedItems])

  const contactsQ = useQuery({
    queryKey: ["contactsById", assignedIds.sort().join(",")],
    enabled: assignedIds.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        assignedIds.map(async (id) => {
          try {
            const info = (await getContactInfoById(id)) as ContactInfo
            return [id, info] as const
          } catch {
            return [id, null] as const
          }
        })
      )
      return Object.fromEntries(entries) as Record<string, ContactInfo | null>
    },
  })

  const getClaimedByLabel = (t: PickerTask) => {
    if (!t.assignedPickerUserId) return "—"
    const id = String(t.assignedPickerUserId)
    const short = shortId(id)
    const contact = contactsQ.data?.[id] || null

    // If still loading contacts, at least show short id
    if (contactsQ.isLoading) return short

    const name = contact?.name?.trim()
    return name && name.length
      ? `${name} • ${short}`
      : short
  }

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
            {sortedItems.map((t) => {
              const totalBoxes =
                t.plan?.summary?.totalBoxes ??
                t.plan?.boxes?.length ??
                0

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

              const badgeStyle = STATUS_BADGE[t.status ?? "open"]

              return (
                <Table.Row key={(t as any)._id ?? (t as any).id}>
                  <Table.Cell>
                    <Badge
                      borderWidth="1px"
                      bg={badgeStyle.bg}
                      color={badgeStyle.color}
                      borderColor={badgeStyle.border}
                      px={2}
                      py={0.5}
                      rounded="md"
                    >
                      {titleCase(t.status)}
                    </Badge>
                  </Table.Cell>

                  <Table.Cell><Code>{shortId(t.orderId)}</Code></Table.Cell>

                  <Table.Cell>
                    {/* Show only if assigned; if status explicitly "ready", keep "—" (not claimed) */}
                    {t.status === "ready" ? "—" : getClaimedByLabel(t)}
                  </Table.Cell>

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
