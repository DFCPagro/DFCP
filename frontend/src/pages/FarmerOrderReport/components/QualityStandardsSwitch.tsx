// src/features/farmerOrderReport/components/QualityStandardsSwitch.tsx
import {
  Card,
  Separator,
  Stack,
  Text,
  HStack,
  Alert,
} from "@chakra-ui/react"
import { useMemo, useState, useCallback, useEffect } from "react"

import QualityStandardsPanel from "./QualityStandardsPanel"
import DairyQualityStandardsPanel from "./DairyQualityStandardsPanel"

import type { QualityStandards } from "@/components/common/items/QualityStandardsTable"
import type { DairyQualityStandards } from "@/components/common/items/DairyQualityStandardsTable"
import type {
  QualityMeasurements,
  DairyQualityMeasurements,
} from "@/types/items"

import { updateFarmerOrderQualityStandards } from "@/api/farmerOrders"

type Props = {
  /** lowercased category string, e.g. "dairy", "produce", etc. */
  category?: string | null
  readOnly?: boolean
  /** FO id so we can PATCH /quality-standards */
  farmerOrderId?: string

  /** Existing per-order produce QS (flat measurements) */
  initialMeasurements?: QualityMeasurements
  /** Existing per-order dairy QS (flat measurements) */
  initialDairyMeasurements?: DairyQualityMeasurements

  /** Existing per-order tolerance stored on the FO */
  initialTolerance?: string | null
}

/**
 * Chooses which quality standards UI to render based on category.
 * Uses subtle motion via Card hover and Reveal inside each panel.
 */
export default function QualityStandardsSwitch({
  category,
  readOnly,
  farmerOrderId,
  initialMeasurements,
  initialDairyMeasurements,
  initialTolerance,
}: Props) {
  const isDairy = useMemo(() => {
    const c = (category ?? "").toLowerCase()
    return !!c && /(dairy|milk|cheese|yogurt|egg)/.test(c)
  }, [category])

  // Local state – QS config (A/B/C) for produce + tolerance
  const [produceStandards, setProduceStandards] =
    useState<QualityStandards | undefined>()
  const [produceTolerance, setProduceTolerance] = useState<string | null>(
    initialTolerance ?? null,
  )

  // QS config (if any) for dairy
  const [dairyStandards, setDairyStandards] =
    useState<DairyQualityStandards | undefined>()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    setProduceTolerance(initialTolerance ?? null)
  }, [initialTolerance])

  // ---------- SAVE: Produce / non-dairy ----------
  const onSaveProduce = useCallback(
    async (payload: {
      standards: QualityMeasurements | undefined
      measurements: QualityMeasurements | undefined
      tolerance: string | null
    }) => {
      if (!farmerOrderId) return

      setSaving(true)
      setSaveError(null)
      setSaveSuccess(false)

      try {
        await updateFarmerOrderQualityStandards(farmerOrderId, {
          category,
          standards: payload.standards,
          // backend currently only expects tolerance for produce
          tolerance: isDairy ? null : payload.tolerance,
        })

        setSaveSuccess(true)
      } catch (e: any) {
        setSaveError(e?.message || "Failed to save quality standards")
      } finally {
        setSaving(false)
      }
    },
    [farmerOrderId, category, isDairy],
  )

  // ---------- SAVE: Dairy ----------
  const onSaveDairy = useCallback(
    async (payload: {
      measurements: DairyQualityMeasurements | undefined
      tolerance: string | null
    }) => {
      if (!farmerOrderId) return

      setSaving(true)
      setSaveError(null)
      setSaveSuccess(false)

      try {
        await updateFarmerOrderQualityStandards(farmerOrderId, {
          category,
          standards: payload.measurements,
          // no separate tolerance for dairy (yet)
          tolerance: null,
        })

        setSaveSuccess(true)
      } catch (e: any) {
        setSaveError(e?.message || "Failed to save quality standards")
      } finally {
        setSaving(false)
      }
    },
    [farmerOrderId, category],
  )

  return (
    <Card.Root className="anim-pressable" variant="subtle">
      <Card.Header>
        <HStack justify="space-between" align="center" wrap="wrap" gap="3">
          <Text fontWeight="semibold" color="fg.subtle">
            Quality Standards {isDairy ? "— Dairy" : "— Produce"}
          </Text>
        </HStack>

        <Separator />

        <Stack mt="3">
          {isDairy ? (
            <DairyQualityStandardsPanel
              value={dairyStandards}
              onChange={setDairyStandards}
              readOnly={readOnly}
              // 🔑 these are the defaults from the farmer order
              initialMeasurements={initialDairyMeasurements}
              onSave={onSaveDairy}
              isSaving={saving}
            />
          ) : (
            <QualityStandardsPanel
              readOnly={readOnly}
              value={produceStandards}
              onChange={setProduceStandards}
              tolerance={produceTolerance}
              onChangeTolerance={setProduceTolerance}
              onSave={onSaveProduce}
              isSaving={saving}
              // 🔑 defaults for produce
              initialMeasurements={initialMeasurements}
            />
          )}
        </Stack>

        {saveError && (
          <Alert.Root status="error" mt="3">
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>{saveError}</Alert.Description>
          </Alert.Root>
        )}

        {saveSuccess && !saveError && (
          <Alert.Root status="success" mt="3">
            <Alert.Title>Saved</Alert.Title>
            <Alert.Description>
              Quality standards were updated for this farmer order.
            </Alert.Description>
          </Alert.Root>
        )}
      </Card.Header>
      <Card.Body />
    </Card.Root>
  )
}
