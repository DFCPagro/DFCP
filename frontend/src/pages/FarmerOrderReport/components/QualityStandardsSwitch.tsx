import { Card, Separator, Stack, Text } from "@chakra-ui/react"
import QualityStandardsPanel from "./QualityStandardsPanel"
import DairyQualityStandardsPanel from "./DairyQualityStandardsPanel"
import { useMemo } from "react"

type Props = {
  /** lowercased category string, e.g. "dairy", "produce", etc. */
  category?: string | null
  readOnly?: boolean
}

/**
 * Chooses which quality standards UI to render based on category.
 * - "dairy" (or contains "dairy", "milk", "cheese", "yogurt") → DairyQualityStandardsPanel
 * - otherwise → default produce QualityStandardsPanel
 *
 * Panels themselves render:
 *  - read-only A/B/C example table (for reference)
 *  - measurement table (single values) for user input
 */
export default function QualityStandardsSwitch({ category, readOnly }: Props) {
  const isDairy = useMemo(() => {
    const c = String(category ?? "").toLowerCase()
    return !!c && /(dairy|milk|cheese|yogurt|labneh|kefir)/i.test(c)
  }, [category])

  return (
    <Card.Root variant="outline" overflow="hidden">
      <Card.Body gap="4">
        <Text fontSize="lg" fontWeight="semibold">
          Quality Standards {isDairy ? "— Dairy" : "— Produce"}
        </Text>
        <Separator />
        <Stack>
          {isDairy ? (
            <DairyQualityStandardsPanel />
          ) : (
            <QualityStandardsPanel />
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
