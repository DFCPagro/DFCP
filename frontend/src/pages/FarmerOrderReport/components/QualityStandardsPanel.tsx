// src/features/farmerOrderReport/components/QualityStandardsPanel.tsx
import * as React from "react"
import {
  Badge,
  Button,
  Card,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react"

import QualityStandardsSection from "@/components/common/items/QualityStandardsTable"
import type { QualityStandards } from "@/components/common/items/QualityStandardsTable"
import {
  QualityMeasurementsForm,
} from "./QualityMeasurementsForm"
import type { QualityMeasurements } from "@/types/items";
import { Reveal } from "./Animated"

/**
 * Keys that remain editable in the measurements form:
 *  - brix
 *  - acidityPercentage
 *  - pressure
 *  - colorPercentage
 *  - weightPerUnitG
 *  - diameterMM
 */

type Props = {
  readOnly?: boolean
  /** Full A/B/C quality standards object (what you PATCH to BE) */
  value?: QualityStandards | undefined
  onChange?: (next: QualityStandards | undefined) => void
  /** Top-level product tolerance (e.g. "0.02") */
  tolerance?: string | null
  onChangeTolerance?: (next: string | null) => void

  /**
   * Called when the "Save quality standards" button is clicked.
   * For now we send the *measurements* as the payload standards
   * because that's what the user actually edits.
   */
  onSave?: (payload: {
    standards: QualityMeasurements | undefined
    measurements: QualityMeasurements | undefined
    tolerance: string | null
  }) => void

  /** Optional loading state for the Save button */
  isSaving?: boolean

  /** Defaults for the measurements form, from the FarmerOrder's qualityStandards */
  initialMeasurements?: QualityMeasurements | undefined
}


export default function QualityStandardsPanel({
  readOnly,
  value,
  onChange,
  tolerance,
  onChangeTolerance,
  onSave,
  isSaving,
  initialMeasurements,
}: Props) {
  // Local bridge state so the panel can work both controlled & uncontrolled
  const [localQS, setLocalQS] = React.useState<QualityStandards | undefined>(
    value,
  )
  const [localTolerance, setLocalTolerance] = React.useState<string | null>(
    tolerance ?? null,
  )

  // Editable measurements (from the new form)
  const [measured, setMeasured] =
  React.useState<QualityMeasurements | undefined>(initialMeasurements)

  React.useEffect(() => {
  setMeasured(initialMeasurements)
}, [initialMeasurements])


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

  // Simple "can save" logic:
  const hasMeasurements =
    !!measured && Object.keys(measured).length > 0
  const canSave =
    !readOnly && hasMeasurements && !!onSave

  const handleSaveClick = () => {
    if (!onSave || !canSave) return
    onSave({
      // 🔑 Treat the measurements as "standards" for this save call
      standards: measured,
      measurements: measured,
      tolerance: localTolerance ?? null,
    })
  }

  return (
    <Stack gap="5">
      {/* 1) A/B/C Quality Standards table (example / config UI) */}
      <Reveal>
        <Card.Root
          className="anim-pressable"
          variant="outline"
          overflow="hidden"
        >
          <Card.Body>
            <QualityStandardsSection
              value={localQS}
              onChange={handleQSChange}
              readOnly={true} // example only; no editing here
              tolerance={localTolerance}
              onChangeTolerance={handleToleranceChange}
            />
          </Card.Body>
        </Card.Root>
      </Reveal>

      {/* 2) Editable measurements + Save button under the form */}
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
            <Stack gap="4">
              {/* Form with regular inputs + color select + percentage */}
              <QualityMeasurementsForm
                value={measured}
                onChange={setMeasured}
                readOnly={readOnly}
              />

              {/* Save button placed UNDER the form */}
              <HStack justify="flex-end">
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
            </Stack>
          </Card.Body>
        </Card.Root>
      </Reveal>
    </Stack>
  )
}
