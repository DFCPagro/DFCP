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
 * Uses subtle motion via Card hover and Reveal inside each panel.
 */
export default function QualityStandardsSwitch({ category, readOnly }: Props) {
  const isDairy = useMemo(() => {
    const c = (category ?? "").toLowerCase()
    return !!c && /(dairy|milk|cheese|yogurt)/.test(c)
  }, [category])

  return (
    <Card.Root className="anim-pressable" variant="subtle">
      <Card.Header>
        <Text fontWeight="semibold" color="fg.subtle">
          Quality Standards {isDairy ? "— Dairy" : "— Produce"}
        </Text>
        <Separator />
        <Stack>
          {isDairy ? (
            <DairyQualityStandardsPanel readOnly={readOnly} />
          ) : (
            <QualityStandardsPanel readOnly={readOnly} />
          )}
        </Stack>
      </Card.Header>
      <Card.Body />
    </Card.Root>
  )
}
