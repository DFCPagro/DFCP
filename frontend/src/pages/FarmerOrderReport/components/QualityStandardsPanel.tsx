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
import type { QualityStandards } from "@/components/common/items/QualityStandardsSection"
import { Reveal } from "./Animated"

/**
 * We mirror the server-side QS keys the backend compares in
 * recomputeInspectionStatus(), then **exclude**:
 *  1) rejectionRate (%)
 *  2) maxDefectRatioLengthDiameter (L/D)
 *  3) quality grade (text) — not a numeric measure anyway
 *
 * Keys that remain editable in the measurements grid:
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

type Props = {
  readOnly?: boolean
  /** Full A/B/C quality standards object (what you PATCH to BE) */
  value?: QualityStandards | undefined
  onChange?: (next: QualityStandards | undefined) => void
  /** Top-level product tolerance (e.g. "0.02") */
  tolerance?: string | null
  onChangeTolerance?: (next: string | null) => void
}

export default function QualityStandardsPanel({
  readOnly,
  value,
  onChange,
  tolerance,
  onChangeTolerance,
}: Props) {
  // Local bridge state so the panel can work both controlled & uncontrolled
  const [localQS, setLocalQS] = React.useState<QualityStandards | undefined>(
    value,
  )
  const [localTolerance, setLocalTolerance] = React.useState<string | null>(
    tolerance ?? null,
  )

  React.useEffect(() => {
    setLocalQS(value)
  }, [value])

  React.useEffect(() => {
    setLocalTolerance(tolerance ?? null)
  }, [tolerance])

  const handleQSChange = React.useCallback(
    (next: QualityStandards | undefined) => {
      setLocalQS(next)
      onChange?.(next)
    },
    [onChange],
  )

  const handleToleranceChange = React.useCallback(
    (next: string | null) => {
      setLocalTolerance(next)
      onChangeTolerance?.(next)
    },
    [onChangeTolerance],
  )

  // local measurements state for the editable grid (values we capture now)
  const [measured, setMeasured] = React.useState<Measurements | undefined>()

  const metricKeys = React.useMemo(
    () => Object.keys(metricLabels) as MetricKey[],
    [],
  )

  const onChangeNumber = React.useCallback(
    (key: MetricKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.currentTarget.value
      setMeasured((prev) => ({ ...(prev ?? {}), [key]: val }))
    },
    [],
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
    [],
  )

  return (
    <Stack gap="5">
      {/* 1) A/B/C Quality Standards table (your example / config UI) */}
      <Reveal>
        <Card.Root className="anim-pressable" variant="outline" overflow="hidden">
          <Card.Body>
            <QualityStandardsSection
              value={localQS}
              onChange={handleQSChange}
              readOnly={readOnly}
              tolerance={localTolerance}
              onChangeTolerance={handleToleranceChange}
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
