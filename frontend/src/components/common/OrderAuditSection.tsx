import { useState, useMemo } from "react";
import {
  Box,
  Stack,
  Text,
  HStack,
  Button,
  Separator,
} from "@chakra-ui/react";

// --- Types ---
export interface AuditEvent {
  action: string;
  note?: string;
  by:
    | string
    | {
        id: string;
        name?: string;
        role?: string;
      };
  at: string | Date;
  meta?: Record<string, any>;
}

// --- Helpers for rendering ---
function renderBy(by: AuditEvent["by"]) {
  if (!by) return "system";

  if (typeof by === "string") {
    // backend can send "system"
    return by || "system";
  }

  // object path: { id, name?, role? }
  if (by.name && by.role) return `${by.name} (${by.role})`;
  if (by.name) return by.name;
  if (by.role) return by.role;
  return by.id || "user";
}

function renderWhen(at: AuditEvent["at"]) {
  if (!at) return "";
  const dt = new Date(at);
  return dt.toLocaleString();
}

export default function OrderAuditSection({ audit }: { audit: AuditEvent[] }) {
  // sort newest-first
  const sorted = useMemo(() => {
    if (!Array.isArray(audit)) return [];
    return [...audit].sort((a, b) => {
      const ta = a?.at ? new Date(a.at).getTime() : 0;
      const tb = b?.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });
  }, [audit]);

  const [expanded, setExpanded] = useState(false);

  const latestEvent = sorted[0];
  const restEvents = sorted.slice(1);

  return (
    <Box borderWidth="1px" borderRadius="md" p="4">
      <Stack gap="3">
        {/* Header row: title + toggle */}
        <HStack justify="space-between" align="flex-start">
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

        {/* Latest event */}
        {latestEvent ? (
          <Box>
            <HStack justify="space-between" align="flex-start">
              {/* left: action + note */}
              <Stack gap="0">
                <Text fontWeight="medium">{latestEvent.action || "—"}</Text>

                {latestEvent.note ? (
                  <Text
                    fontSize="sm"
                    color="fg.muted"
                    whiteSpace="pre-wrap"
                  >
                    {latestEvent.note}
                  </Text>
                ) : null}
              </Stack>

              {/* right: who + when */}
              <Stack gap="0" align="end" minW="180px">
                <Text fontSize="sm">{renderBy(latestEvent.by)}</Text>
                <Text fontSize="xs" color="fg.muted">
                  {renderWhen(latestEvent.at)}
                </Text>
              </Stack>
            </HStack>
          </Box>
        ) : (
          <Text color="fg.muted" fontSize="sm">
            No audit entries.
          </Text>
        )}

        {/* Full history (older events only) */}
        {expanded && restEvents.length > 0 && (
          <Stack gap="3" maxH="220px" overflowY="auto" pr="2">
            {restEvents.map((ev, i) => (
              <Box key={i}>
                <Separator mb="3" />

                <HStack justify="space-between" align="flex-start">
                  {/* left: action + note */}
                  <Stack gap="0">
                    <Text fontWeight="medium">{ev.action || "—"}</Text>

                    {ev.note ? (
                      <Text
                        fontSize="sm"
                        color="fg.muted"
                        whiteSpace="pre-wrap"
                      >
                        {ev.note}
                      </Text>
                    ) : null}
                  </Stack>

                  {/* right: who + when */}
                  <Stack gap="0" align="end" minW="180px">
                    <Text fontSize="sm">{renderBy(ev.by)}</Text>
                    <Text fontSize="xs" color="fg.muted">
                      {renderWhen(ev.at)}
                    </Text>
                  </Stack>
                </HStack>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
