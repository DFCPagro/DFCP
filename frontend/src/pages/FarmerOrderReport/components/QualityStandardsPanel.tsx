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

import QualityStandardsSection from "@/components/common/items/QualityStandardsSection"
import { Reveal } from "./Animated"

/**
 * Local quality model independent from external types to avoid
 * "Property 'measures' does not exist on type ..." errors.
 */
type MetricKey = "moisture" | "brix" | "size" | "rejectionRate"

type QS = {
  grade: "A" | "B" | "C"
  measures: Record<MetricKey, number>
}

type Measurements = Partial<Record<MetricKey, number | string>>

const metricLabels: Record<MetricKey, string> = {
  moisture: "Moisture %",
  brix: "Brix %",
  size: "Size / length diameter",
  rejectionRate: "Rejection rate",
}

// Demo data — A/B/C read-only
const ABC: { a: QS; b: QS; c: QS } = {
  a: {
    grade: "A",
    measures: { moisture: 10, brix: 12, size: 8, rejectionRate: 1 },
  },
  b: {
    grade: "B",
    measures: { moisture: 14, brix: 10, size: 7, rejectionRate: 2.5 },
  },
  c: {
    grade: "C",
    measures: { moisture: 18, brix: 8, size: 6, rejectionRate: 4 },
  },
}

type Props = {
  readOnly?: boolean
}

export default function QualityStandardsPanel(props: Props) {
  const [qsExample, setQsExample] = React.useState<QS | undefined>()
  const [measured, setMeasured] = React.useState<Measurements | undefined>()

  const metricKeys = React.useMemo(() => Object.keys(metricLabels) as MetricKey[], [])

  const onChangeNumber = React.useCallback(
    (key: MetricKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const clean = e.currentTarget.value
      setMeasured((prev) => ({ ...(prev ?? {}), [key]: clean }))
    },
    []
  )

  const onBlurFormat = React.useCallback(
    (key: MetricKey) => (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value
      const clean = raw.trim()
      setMeasured((prev) => {
        const next = { ...(prev ?? {}) }
        if (!clean) {
          delete next[key]
        } else {
          next[key] = clean
        }
        return Object.keys(next).length ? next : undefined
      })
    },
    []
  )

  return (
    <Stack gap="5">
      {/* 1) READ-ONLY A/B/C examples */}
      <Reveal>
        <Card.Root className="anim-pressable" variant="outline" overflow="hidden">
          <Card.Body>
            <QualityStandardsSection
              // Pass as any to avoid coupling with external type definitions
              value={(qsExample ?? ABC.a) as any}
              onChange={(v: any) => setQsExample(v as QS)}
              readOnly
            />
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* 2) Editable measurements grid */}
      <Reveal>
        <Card.Root className="anim-pressable" variant="outline" overflow="hidden">
          <Card.Header>
            <HStack justify="space-between">
              <Text fontWeight="semibold" color="fg.subtle">
                Measurements — Enter actual values
              </Text>
              <Badge>Live</Badge>
            </HStack>
          </Card.Header>

          <Card.Body>
            <Box overflowX="auto" pt="1">
              <Table.Root size="sm" variant="outline" minW="720px">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader w="34%">Field</Table.ColumnHeader>
                    <Table.ColumnHeader w="48%">Measured</Table.ColumnHeader>
                    <Table.ColumnHeader w="18%">Unit</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {metricKeys.map((key) => {
                    const label = metricLabels[key]
                    return (
                      <Table.Row key={key}>
                        <Table.Cell>
                          <Text>{label}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            className="anim-scale-hover"
                            size="sm"
                            value={(measured?.[key] as string) ?? ""}
                            onChange={onChangeNumber(key)}
                            onBlur={onBlurFormat(key)}
                            placeholder="Enter value"
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Text color="fg.muted">—</Text>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
          </Card.Body>

          <Card.Footer>
            <Text fontSize="xs" color="fg.muted">
              Tip: fields left blank will be ignored.
            </Text>
          </Card.Footer>
        </Card.Root>
      </Reveal>
    </Stack>
  )
}
