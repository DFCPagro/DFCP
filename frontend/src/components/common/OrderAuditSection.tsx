import { useState, useMemo } from "react"
import {
  Box,
  Stack,
  Text,
  HStack,
  Button,
  Table,
} from "@chakra-ui/react"

// --- Types ---
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
  at : string | Date
  timestamp?: string | Date
  meta?: Record<string, any>
}

// --- Helpers for rendering ---
function renderBy(by: AuditEvent["by"]) {
  if (!by) return "system"

  if (typeof by === "string") {
    return by || "system"
  }

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

// --- Row renderer so we don't duplicate code ---
function AuditRow({ ev }: { ev: AuditEvent }) {
  return (
    <Table.Row>
      <Table.Cell fontWeight="medium" maxW="220px">
        {ev.action || "—"}
      </Table.Cell>

      <Table.Cell
        fontSize="sm"
        color="fg.muted"
        whiteSpace="pre-wrap"
        maxW="320px"
      >
        {ev.note || ""}
      </Table.Cell>

      <Table.Cell fontSize="sm" maxW="180px">
        {renderBy(ev.by)}
      </Table.Cell>

      <Table.Cell
        fontSize="xs"
        color="fg.muted"
        whiteSpace="nowrap"
        textAlign="right"
      >
        {renderWhen(ev.timestamp || ev.at)}
      </Table.Cell>
    </Table.Row>
  )
}

export default function OrderAuditSection({ audit }: { audit: AuditEvent[] }) {
  // newest first
  const sorted = useMemo(() => {
    if (!Array.isArray(audit)) return []
    return [...audit].sort((a, b) => {
      const ta = a?.at ? new Date(a.at).getTime() : 0
      const tb = b?.at ? new Date(b.at).getTime() : 0
      return tb - ta
    })
  }, [audit])

  const [expanded, setExpanded] = useState(false)

  // slice so we can show "latest row" always + optionally the rest
  const latestEvent = sorted[0]
  const restEvents = sorted.slice(1)

  return (
    <Box borderWidth="1px" borderRadius="md" p="4">
      <Stack gap="3">
        {/* Header row: title + toggle */}
        <HStack justifyContent="space-between" alignItems="flex-start">
          <Text fontWeight="semibold">Audit</Text>

          {restEvents.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Hide full history" : "Show full history"}
            </Button>
          )}
        </HStack>

        {/* Table */}
        <Box
          borderWidth="1px"
          borderRadius="md"
          maxH={expanded ? "260px" : "140px"}
          overflowY="auto"
        >
          <Table.Root size="sm" width="full">
            <Table.Header
              position="sticky"
              top={0}
              bg="bg.panel"
              zIndex={1}
            >
              <Table.Row>
                <Table.ColumnHeader
                  fontSize="xs"
                  textTransform="none"
                  fontWeight="semibold"
                >
                  Action
                </Table.ColumnHeader>

                <Table.ColumnHeader
                  fontSize="xs"
                  textTransform="none"
                  fontWeight="semibold"
                >
                  Note
                </Table.ColumnHeader>

                <Table.ColumnHeader
                  fontSize="xs"
                  textTransform="none"
                  fontWeight="semibold"
                >
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
                  {/* always show most recent */}
                  <AuditRow ev={latestEvent} />

                  {/* older rows:
                     - if not expanded, hide them
                     - if expanded, render all
                   */}
                  {expanded &&
                    restEvents.map((ev, i) => <AuditRow key={i} ev={ev} />)}
                </>
              ) : (
                <Table.Row>
                  <Table.Cell
                    colSpan={4}
                    fontSize="sm"
                    color="fg.muted"
                    textAlign="center"
                    py="6"
                  >
                    No audit entries.
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
