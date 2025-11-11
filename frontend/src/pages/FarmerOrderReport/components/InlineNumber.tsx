import * as React from "react"
import { NumberInput } from "@chakra-ui/react"
import { safeNumber } from "../utils/numbers"

export function InlineNumber(props: {
  value: number
  onValue: (n: number) => void
  min?: number
  max?: number
  step?: number
  width?: string
  size?: "xs" | "sm" | "md" | "lg"
}) {
  const { value, onValue, min = 0, max = 1_000_000, step = 0.1, size = "sm" } = props
  return (
    <NumberInput.Root
      className="anim-scale-hover"
      value={String(value ?? "")}
      onValueChange={(d) => onValue(safeNumber(d.value))}
      min={min}
      max={max}
      step={step}
      width={props.width ?? "220px"}
      maxW="100%"
      size={size}
      aria-label="Numeric value"
    >
      <NumberInput.Control />
      <NumberInput.Input inputMode="decimal" />
    </NumberInput.Root>
  )
}
