import * as React from "react"
import { NumberInput } from "@chakra-ui/react"
import { safeNumber } from "../utils/numbers"

export function InlineWeightEditor(props: { value: number; onChange: (n: number) => void }) {
  return (
    <NumberInput.Root
      value={String(props.value ?? 0)}
      onValueChange={(d) => props.onChange(safeNumber(d.value))}
      min={0}
      max={2000}
      step={0.5}
      width="160px"
      maxW="100%"
      size="sm"
      aria-label="Weight (kg)"
    >
      <NumberInput.Control />
      <NumberInput.Input inputMode="decimal" />
    </NumberInput.Root>
  )
}
