// src/features/farmerOrderReport/components/DairyQualityStandardsPanel.tsx
import * as React from "react"
import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Input,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react"

import DairyQualityStandardsSection from "@/components/common/items/DairyQualityStandardsTable"
import type { DairyQualityStandards } from "@/components/common/items/DairyQualityStandardsTable"
import { Reveal } from "./Animated"
import type { DairyQualityMeasurements } from "@/types/items"

/**
 * Keys for measured dairy metrics
 */
type MetricKey =
  | "fat"
  | "protein"
  | "lactose"
  | "snf"
  | "freezingPoint"
  | "density"
  | "ph"
  | "somaticCellCount"
  | "bacterialCount"

const metricLabels: Record<MetricKey, string> = {
  fat: "Fat %",
  protein: "Protein %",
  lactose: "Lactose %",
  snf: "SNF %",
  freezingPoint: "Freezing point",
  density: "Density",
  ph: "pH",
  somaticCellCount: "Somatic cell count",
  bacterialCount: "Bacterial count",
}

type Props = {
  readOnly?: boolean
  /** A-grade dairy quality standards config (example table at top) */
  value?: DairyQualityStandards | undefined
  onChange?: (next: DairyQualityStandards | undefined) => void

  /** Measured per-order dairy values (what packing sends / BE stores) */
  initialMeasurements?: DairyQualityMeasurements | undefined

  /** Called when user clicks "Save quality standards" */
  onSave?: (payload: {
    measurements: DairyQualityMeasurements | undefined
    tolerance: string | null
  }) => void

  /** Loading state for save button */
  isSaving?: boolean
}

export default function DairyQualityStandardsPanel({
  readOnly,
  value,
  onChange,
  initialMeasurements,
  onSave,
  isSaving,
}: Props) {
  // Bridge so we can keep A-grade config in sync (read-only table)
  const [localQS, setLocalQS] = React.useState<DairyQualityStandards | undefined>(
    value,
  )

  // 🔑 This is what powers the form (pre-filled & editable)
  const [measured, setMeasured] =
    React.useState<DairyQualityMeasurements | undefined>(initialMeasurements)

  React.useEffect(() => {
    setLocalQS(value)
  }, [value])

  // 🔑 When backend changes / FO refetched, update default form values
  React.useEffect(() => {
    setMeasured(initialMeasurements)
  }, [initialMeasurements])

  const metricKeys = React.useMemo(
    () => Object.keys(metricLabels) as MetricKey[],
    [],
  )

  const handleQSChange = (next: DairyQualityStandards | undefined) => {
    setLocalQS(next)
    onChange?.(next)
  }

  const onChangeNumber = React.useCallback(
    (key: MetricKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const clean = e.currentTarget.value
      setMeasured((prev) => ({ ...(prev ?? {}), [key]: clean }))
    },
    [],
  )

  const onBlurFormat = React.useCallback(
    (key: MetricKey) => (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.currentTarget.value
      const clean = raw.trim()
      setMeasured((prev) => {
        const next: DairyQualityMeasurements = { ...(prev ?? {}) }
        if (!clean) {
          delete (next as any)[key]
        } else {
          ;(next as any)[key] = clean
        }
        return Object.keys(next).length ? next : undefined
      })
    },
    [],
  )

  const disabled = !!readOnly
  const canSave =
    !disabled && !!onSave && !!measured && Object.keys(measured).length > 0

  const handleSaveClick = () => {
    if (!onSave || !canSave) return
    onSave({
      measurements: measured,
      // if you later add per-order dairy tolerance, pass it here instead of null
      tolerance: null,
    })
  }

  return (
    <Stack gap="5">
      {/* 1) READ-ONLY / CONFIG A-grade table (kept, untouched) */}
      <Reveal>
        <Card.Root
          className="anim-pressable"
          variant="outline"
          overflow="hidden"
        >
          <Card.Body>
            <DairyQualityStandardsSection
              value={localQS}
              onChange={handleQSChange}
              readOnly={true}
            />
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* 2) Editable measurements grid + Save button (new behaviour) */}
      <Reveal>
        <Card.Root
          className="anim-pressable"
          variant="outline"
          overflow="hidden"
        >
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
                    const val = (measured?.[key] as string) ?? ""
                    return (
                      <Table.Row key={key}>
                        <Table.Cell>
                          <Text>{label}</Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            className="anim-scale-hover"
                            size="sm"
                            value={val}
                            onChange={onChangeNumber(key)}
                            onBlur={onBlurFormat(key)}
                            placeholder="Enter value"
                            readOnly={disabled}
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
            <HStack justify="space-between" w="full" gap="3" wrap="wrap">
              <Text fontSize="xs" color="fg.muted">
                Tip: fields left blank will be ignored.
              </Text>
              <Button
                size="sm"
                colorPalette="green"
                onClick={handleSaveClick}
                disabled={!canSave}
                loading={!!isSaving}
              >
                Save quality standards
              </Button>
            </HStack>
          </Card.Footer>
        </Card.Root>
      </Reveal>
    </Stack>
  )
}
