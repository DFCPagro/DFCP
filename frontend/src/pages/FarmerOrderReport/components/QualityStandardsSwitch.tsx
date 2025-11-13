import {
  Card,
  Separator,
  Stack,
  Text,
  Button,
  HStack,
  Alert,
} from "@chakra-ui/react"
import QualityStandardsPanel from "./QualityStandardsPanel"
import DairyQualityStandardsPanel from "./DairyQualityStandardsPanel"
import { useMemo, useState, useCallback } from "react"
import type { QualityStandards } from "@/components/common/items/QualityStandardsSection"
import type { DairyQualityStandards } from "@/components/common/items/DairyQualityStandards"
import { updateFarmerOrderQualityStandards } from "@/api/farmerOrders"

type Props = {
  /** lowercased category string, e.g. "dairy", "produce", etc. */
  category?: string | null
  readOnly?: boolean
  /** FO id so we can PATCH /quality-standards */
  farmerOrderId?: string
}

/**
 * Chooses which quality standards UI to render based on category.
 * Uses subtle motion via Card hover and Reveal inside each panel.
 */
export default function QualityStandardsSwitch({
  category,
  readOnly,
  farmerOrderId,
}: Props) {
  const isDairy = useMemo(() => {
    const c = (category ?? "").toLowerCase()
    return !!c && /(dairy|milk|cheese|yogurt)/.test(c)
  }, [category])

  // Local state – in a richer setup you could hydrate this from the BE
  const [produceStandards, setProduceStandards] = useState<QualityStandards | undefined>()
  const [produceTolerance, setProduceTolerance] = useState<string | null>(null)
  const [dairyStandards, setDairyStandards] = useState<DairyQualityStandards | undefined>()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const onSave = useCallback(async () => {
    if (!farmerOrderId) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const standards = isDairy ? dairyStandards : produceStandards
      const tolerance = isDairy ? null : produceTolerance

      await updateFarmerOrderQualityStandards(farmerOrderId, {
        category,
        standards,
        tolerance,
      })

      setSaveSuccess(true)
    } catch (e: any) {
      setSaveError(e?.message || "Failed to save quality standards")
    } finally {
      setSaving(false)
    }
  }, [farmerOrderId, isDairy, dairyStandards, produceStandards, produceTolerance, category])

  return (
    <Card.Root className="anim-pressable" variant="subtle">
      <Card.Header>
        <HStack justify="space-between" align="center" wrap="wrap" gap="3">
          <Text fontWeight="semibold" color="fg.subtle">
            Quality Standards {isDairy ? "— Dairy" : "— Produce"}
          </Text>

          <HStack gap="2">
            <Button
              size="sm"
              variant="outline"
              onClick={onSave}
              disabled={readOnly || !farmerOrderId || saving}
              loading={saving}
              className="anim-pressable"
            >
              Save quality standards
            </Button>
          </HStack>
        </HStack>

        <Separator />

        <Stack mt="3">
          {isDairy ? (
            // In your actual DairyQualityStandardsPanel, make sure it accepts value/onChange/readOnly
            <DairyQualityStandardsPanel
              value={dairyStandards}
              onChange={setDairyStandards}
              readOnly={readOnly}
            />
          ) : (
            // In your QualityStandardsPanel, make sure it accepts tolerance + callbacks
            <QualityStandardsPanel
              readOnly={readOnly}
              // ↓ you’ll need to extend QualityStandardsPanel to accept these three props
              value={produceStandards}
              onChange={setProduceStandards}
              tolerance={produceTolerance}
              onChangeTolerance={setProduceTolerance}
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
