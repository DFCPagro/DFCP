import { useState, useMemo } from "react"
import {
  Box,
  Stack,
  Text,
  HStack,
  Button,
  Table,
} from "@chakra-ui/react"

/** Canonical shape the table renders */
export interface AuditEvent {
  action: string
  note?: string
  by:
    | string
    | {
        id: string
        name?: string
        role?: string
      }
  at: string | Date
  timestamp?: string | Date
  meta?: Record<string, any>
}

/** Props are generic so you can pass any raw item type */
type AuditSectionProps<T = any> = {
  /** Raw items (any shape). If undefined/null => empty state. */
  items?: T[] | null
  /** Map raw item -> AuditEvent (if omitted, items are assumed to already match AuditEvent) */
  map?: (item: T) => AuditEvent
  /** Title shown in the header */
  title?: string
  /** Start expanded? */
  initialExpanded?: boolean
  /** Max height when collapsed (CSS size) */
  collapsedHeight?: string
  /** Max height when expanded (CSS size) */
  expandedHeight?: string
  /** Empty message override */
  emptyText?: string
}

/* ---------- helpers for rendering ---------- */
function renderBy(by: AuditEvent["by"]) {
  if (!by) return "system"
  if (typeof by === "string") return by || "system"
  if (by.name && by.role) return `${by.name} (${by.role})`
  if (by.name) return by.name
  if (by.role) return by.role
  return by.id || "user"
}

function renderWhen(at: AuditEvent["at"]) {
  if (!at) return ""
  const dt = new Date(at)
  return dt.toLocaleString()
}

/* ---------- row ---------- */
function AuditRow({ ev }: { ev: AuditEvent }) {
  return (
    <Table.Row>
      <Table.Cell fontWeight="medium" maxW="220px">
        {ev.action || "—"}
      </Table.Cell>

      <Table.Cell fontSize="sm" color="fg.muted" whiteSpace="pre-wrap" maxW="320px">
        {ev.note || ""}
      </Table.Cell>

      <Table.Cell fontSize="sm" maxW="180px">
        {renderBy(ev.by)}
      </Table.Cell>

      <Table.Cell fontSize="xs" color="fg.muted" whiteSpace="nowrap" textAlign="right">
        {renderWhen(ev.timestamp || ev.at)}
      </Table.Cell>
    </Table.Row>
  )
}

/* ---------- generic section ---------- */
export default function AuditSection<T = any>({
  items,
  map,
  title = "Audit",
  initialExpanded = false,
  collapsedHeight = "140px",
  expandedHeight = "260px",
  emptyText = "No audit entries.",
}: AuditSectionProps<T>) {
  // normalize items -> AuditEvent[]
  const audit: AuditEvent[] = useMemo(() => {
    const src = Array.isArray(items) ? items : []
    if (map) return src.map(map)
    // assume already AuditEvent shaped
    return src as unknown as AuditEvent[]
  }, [items, map])

  // newest first
  const sorted = useMemo(() => {
    return [...audit].sort((a, b) => {
      const ta = a?.at ? new Date(a.at).getTime() : 0
      const tb = b?.at ? new Date(b.at).getTime() : 0
      return tb - ta
    })
  }, [audit])

  const [expanded, setExpanded] = useState(initialExpanded)

  // slice so we always show the latest row + toggle the rest
  const latestEvent = sorted[0]
  const restEvents = sorted.slice(1)

  return (
    <Box borderWidth="1px" borderRadius="md" p="4">
      <Stack gap="3">
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="flex-start">
          <Text fontWeight="semibold">{title}</Text>

          {restEvents.length > 0 && (
            <Button variant="ghost" size="xs" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Hide full history" : "Show full history"}
            </Button>
          )}
        </HStack>

        {/* Table */}
        <Box
          borderWidth="1px"
          borderRadius="md"
          maxH={expanded ? expandedHeight : collapsedHeight}
          overflowY="auto"
        >
          <Table.Root size="sm" width="full">
            <Table.Header position="sticky" top={0} bg="bg.panel" zIndex={1}>
              <Table.Row>
                <Table.ColumnHeader fontSize="xs" textTransform="none" fontWeight="semibold">
                  Action
                </Table.ColumnHeader>
                <Table.ColumnHeader fontSize="xs" textTransform="none" fontWeight="semibold">
                  Note
                </Table.ColumnHeader>
                <Table.ColumnHeader fontSize="xs" textTransform="none" fontWeight="semibold">
                  By
                </Table.ColumnHeader>
                <Table.ColumnHeader
                  fontSize="xs"
                  textTransform="none"
                  fontWeight="semibold"
                  textAlign="right"
                >
                  When
                </Table.ColumnHeader>
              </Table.Row>
            </Table.Header>

            <Table.Body>
              {latestEvent ? (
                <>
                  <AuditRow ev={latestEvent} />
                  {expanded && restEvents.map((ev, i) => <AuditRow key={i} ev={ev} />)}
                </>
              ) : (
                <Table.Row>
                  <Table.Cell colSpan={4} fontSize="sm" color="fg.muted" textAlign="center" py="6">
                    {emptyText}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Box>
      </Stack>
    </Box>
  )
}
