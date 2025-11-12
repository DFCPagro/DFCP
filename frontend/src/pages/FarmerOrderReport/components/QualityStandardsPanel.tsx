// src/features/farmerOrderReport/components/QualityStandardsPanel.tsx
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
 * We mirror the server-side QS keys the backend compares in
 * recomputeInspectionStatus(), then **exclude**:
 *  1) rejectionRate (%)
 *  2) maxDefectRatioLengthDiameter (L/D)
 *  3) quality grade (text) — not a numeric measure anyway
 *
 * Keys that remain editable:
 *  - brix
 *  - acidityPercentage
 *  - pressure
 *  - colorPercentage
 *  - weightPerUnitG
 *  - diameterMM
 */
type MetricKey =
  | "brix"
  | "acidityPercentage"
  | "pressure"
  | "colorPercentage"
  | "weightPerUnitG"
  | "diameterMM"

// Read-only example model for A/B/C shown at the top
type QS = {
  grade: "A" | "B" | "C"
  measures: Partial<Record<MetricKey, number>>
}

type Measurements = Partial<Record<MetricKey, number | string>>

const metricLabels: Record<MetricKey, string> = {
  brix: "Brix %",
  acidityPercentage: "Acidity %",
  pressure: "Pressure",
  colorPercentage: "Color %",
  weightPerUnitG: "Weight / unit (g)",
  diameterMM: "Diameter (mm)",
}

const metricUnits: Partial<Record<MetricKey, string>> = {
  brix: "%",
  acidityPercentage: "%",
  pressure: "", // unit depends on tool; left blank
  colorPercentage: "%",
  weightPerUnitG: "g",
  diameterMM: "mm",
}

// Demo A/B/C — strictly read-only; NOT used for the input grid
const ABC: { a: QS; b: QS; c: QS } = {
  a: {
    grade: "A",
    measures: {
      brix: 12,
      acidityPercentage: 0.6,
      pressure: 8,
      colorPercentage: 90,
      weightPerUnitG: 180,
      diameterMM: 75,
    },
  },
  b: {
    grade: "B",
    measures: {
      brix: 10,
      acidityPercentage: 0.8,
      pressure: 7,
      colorPercentage: 80,
      weightPerUnitG: 160,
      diameterMM: 70,
    },
  },
  c: {
    grade: "C",
    measures: {
      brix: 8,
      acidityPercentage: 1.0,
      pressure: 6,
      colorPercentage: 70,
      weightPerUnitG: 140,
      diameterMM: 65,
    },
  },
}

type Props = {
  readOnly?: boolean
}

export default function QualityStandardsPanel({ readOnly }: Props) {
  // selected example (for the READ-ONLY section); default to A
  const [qsExample, setQsExample] = React.useState<QS | undefined>(undefined)

  // local measurements state for the editable grid (values we capture now)
  const [measured, setMeasured] = React.useState<Measurements | undefined>()

  const metricKeys = React.useMemo(
    () => Object.keys(metricLabels) as MetricKey[],
    []
  )

  const onChangeNumber = React.useCallback(
    (key: MetricKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.currentTarget.value
      setMeasured((prev) => ({ ...(prev ?? {}), [key]: val }))
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
      {/* 1) READ-ONLY A/B/C preview (kept as-is; includes "grade" text and all metrics) */}
      <Reveal>
        <Card.Root className="anim-pressable" variant="outline" overflow="hidden">
          <Card.Body>
            <QualityStandardsSection
              // The common QS component might expect a richer shape; we only pass what we have.
              value={(qsExample ?? ABC.a) as any}
              onChange={(v: any) => setQsExample(v as QS)}
              readOnly
            />
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* 2) Editable measurements grid (EXCLUDES: Rejection rate %, Max defect ratio (L/D), Quality grade) */}
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
                    <Table.ColumnHeader w="40%">Field</Table.ColumnHeader>
                    <Table.ColumnHeader w="45%">Measured</Table.ColumnHeader>
                    <Table.ColumnHeader w="15%">Unit</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {metricKeys.map((key) => {
                    const label = metricLabels[key]
                    const unit = metricUnits[key] ?? "—"
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
                            readOnly={readOnly}
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Text color="fg.muted">{unit}</Text>
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
