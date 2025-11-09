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

// UPDATE PATH if your shared component lives elsewhere
import QualityStandardsSection, {
  type QualityStandards as QSABC,
} from "@/components/common/items/QualityStandardsSection"

/**
 * Panel goals:
 * 1) Show READ-ONLY Quality Standards examples (A/B/C) using the shared component
 *    — fields look normal (not muted), but cannot be edited.
 * 2) Show Measurements as a TABLE (single value per metric, NO A/B/C).
 *
 * Excluded everywhere: rejectionRate, maxDefectRatioLengthDiameter
 */

// excluded keys
const EXCLUDED: Array<keyof QSABC> = [
  "maxDefectRatioLengthDiameter",
  "rejectionRate",
]

// labels for rows in measured section
const LABELS: Record<keyof QSABC, string> = {
  brix: "brix",
  acidityPercentage: "acidityPercentage",
  pressure: "pressure",
  colorDescription: "colorDescription",
  colorPercentage: "colorPercentage",
  weightPerUnit: "weightPerUnit",
  diameterMM: "diameterMM",
  qualityGrade: "qualityGrade",
  maxDefectRatioLengthDiameter: "maxDefectRatioLengthDiameter",
  rejectionRate: "rejectionRate",
}

// which metrics are free text
const IS_TEXT: Partial<Record<keyof QSABC, boolean>> = {
  colorDescription: true,
  qualityGrade: true,
}

// units (shown as chips)
const UNIT: Partial<Record<keyof QSABC, string>> = {
  brix: "%",
  acidityPercentage: "%",
  pressure: "kg/cm²",
  colorPercentage: "%",
  weightPerUnit: "g",
  diameterMM: "mm",
}

type MeasuredValues = Partial<
  Record<
    Exclude<keyof QSABC, "maxDefectRatioLengthDiameter" | "rejectionRate">,
    string
  >
>

export function QualityStandardsPanel() {
  // READ-ONLY A/B/C examples to show in the common component
  const [qsExample, setQsExample] = React.useState<QSABC | undefined>(undefined)

  // Product-level tolerance ratio (e.g., "0.02")
  const [toleranceRatio, setToleranceRatio] = React.useState<string | null>("0.02")

  // Actual measurements (single value per metric)
  const [measured, setMeasured] = React.useState<MeasuredValues | undefined>({})

  const metricKeys = React.useMemo(
    () =>
      (Object.keys(LABELS) as Array<keyof QSABC>).filter(
        (k) => !EXCLUDED.includes(k),
      ),
    [],
  )

  const setTol = React.useCallback((v: string) => {
    const t = v.trim()
    setToleranceRatio(t.length ? t : null)
  }, [])

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
          <QualityStandardsSection
            value={qsExample}
            onChange={setQsExample}
            readOnly
            tolerance={toleranceRatio ?? ""}
            onChangeTolerance={setTol}
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

export default QualityStandardsPanel
