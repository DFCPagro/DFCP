import * as React from "react"
import {
  Badge,
  Box,
  Card,
  HStack,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react"
import DairyQualityStandardsSection, {
  type DairyQualityStandards as DQS,
} from "@/components/common/items/DairyQualityStandards"

/**
 * Panel goals (mirrors produce QualityStandardsPanel):
 * 1) Show READ-ONLY A/B/C examples using the shared dairy component
 *    — fields look normal (not muted), but cannot be edited.
 * 2) Show Measurements as a TABLE (single value per metric, NO A/B/C).
 */

// labels for rows in measured section
const LABELS: Record<keyof DQS, string> = {
  grade: "Quality grade (text)",
  freshnessDays: "Freshness (days)",
  fatPercentage: "Fat percentage",
}

// which metrics are free text
const IS_TEXT: Partial<Record<keyof DQS, boolean>> = {
  grade: true,
}

// units (shown as chips)
const UNIT: Partial<Record<keyof DQS, string>> = {
  freshnessDays: "days",
  fatPercentage: "%",
}

type MeasuredValues = Partial<Record<keyof DQS, string>>

export default function DairyQualityStandardsPanel() {
  // READ-ONLY A/B/C examples to show in the common component
  const [qsExample, setQsExample] = React.useState<DQS | undefined>(undefined)

  // Actual measurements (single value per metric)
  const [measured, setMeasured] = React.useState<MeasuredValues | undefined>({})

  const metricKeys = React.useMemo(
    () => Object.keys(LABELS) as Array<keyof DQS>,
    [],
  )

  const setMeasuredCell = React.useCallback(
    (key: keyof MeasuredValues, val: string) => {
      const next: MeasuredValues = { ...(measured ?? {}) }
      const clean = val.trim()
      if (!clean) {
        delete next[key]
      } else {
        next[key] = clean
      }
      setMeasured(Object.keys(next).length ? next : undefined)
    },
    [measured],
  )

  return (
    <Stack gap="5">
      {/* 1) READ-ONLY A/B/C examples */}
      <Card.Root variant="outline" overflow="hidden">
        <Card.Body>
          <DairyQualityStandardsSection
            value={qsExample}
            onChange={setQsExample}
            readOnly
          />
        </Card.Body>
      </Card.Root>

      {/* 2) Measurements — TABLE (single value per metric) */}
      <Card.Root variant="outline" overflow="hidden">
        <Card.Body gap="3">
          <Text fontSize="lg" fontWeight="semibold">
            Measurements — Enter actual values
          </Text>

          <Box overflowX="auto" pt="1">
            <Table.Root size="sm" variant="outline" minW="640px">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader w="40%">Field</Table.ColumnHeader>
                  <Table.ColumnHeader w="45%">Measured</Table.ColumnHeader>
                  <Table.ColumnHeader w="15%">Unit</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {metricKeys.map((key) => {
                  const isText = !!IS_TEXT[key]
                  const unit = isText ? undefined : UNIT[key]
                  const value = (measured as any)?.[key] ?? ""
                  return (
                    <Table.Row key={String(key)}>
                      <Table.Cell>
                        <Text fontWeight="medium">{LABELS[key]}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Input
                          size="sm"
                          value={value}
                          onChange={(e) =>
                            setMeasuredCell(key as keyof MeasuredValues, e.target.value)
                          }
                          placeholder={isText ? "Enter text…" : "Enter value…"}
                          inputMode={isText ? "text" : "decimal"}
                        />
                      </Table.Cell>
                      <Table.Cell>
                        {unit ? (
                          <HStack>
                            <Badge variant="subtle">{unit}</Badge>
                          </HStack>
                        ) : (
                          <Text color="fg.muted">—</Text>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          </Box>
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}
