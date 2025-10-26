import { HStack, NumberInput, Stack, Text } from "@chakra-ui/react"

type Price = { a?: number | null; b?: number | null; c?: number | null }

type Props = {
  value: Price
  onChange: (key: "a" | "b" | "c", v: number | null) => void
  onBlur?: () => void
  readOnly?: boolean
}

const toFixedOrNull = (n: number | null | undefined, digits = 2) =>
  n == null ? "" : String(Number(n).toFixed(digits))

export default function PriceFields({ value, onChange, onBlur, readOnly }: Props) {
  return (
    <HStack gap="3" align="start">
      {/* A */}
      <Stack minW="110px" gap="1">
        <Text fontSize="xs" color="fg.muted">
          A
        </Text>
        <NumberInput.Root
          min={0}
          step={0.01}
          value={toFixedOrNull(value.a)}
          locale="en-US"
          formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
          onValueChange={({ valueAsNumber, value }) => {
            if (readOnly) return
            const next =
              value === "" || Number.isNaN(valueAsNumber)
                ? null
                : Number(valueAsNumber.toFixed(2))
            onChange("a", next)
          }}
          disabled={readOnly}
        >
          <NumberInput.Input id="priceA" placeholder="e.g. 2.50" inputMode="decimal" onBlur={onBlur} />
          <NumberInput.Control>
            <NumberInput.IncrementTrigger />
            <NumberInput.DecrementTrigger />
          </NumberInput.Control>
        </NumberInput.Root>
      </Stack>

      {/* B */}
      <Stack minW="110px" gap="1">
        <Text fontSize="xs" color="fg.muted">
          B
        </Text>
        <NumberInput.Root
          min={0}
          step={0.01}
          value={toFixedOrNull(value.b)}
          locale="en-US"
          formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
          onValueChange={({ valueAsNumber, value }) => {
            if (readOnly) return
            const next =
              value === "" || Number.isNaN(valueAsNumber)
                ? null
                : Number(valueAsNumber.toFixed(2))
            onChange("b", next)
          }}
          disabled={readOnly}
        >
          <NumberInput.Input id="priceB" placeholder="e.g. 2.00" inputMode="decimal" onBlur={onBlur} />
          <NumberInput.Control>
            <NumberInput.IncrementTrigger />
            <NumberInput.DecrementTrigger />
          </NumberInput.Control>
        </NumberInput.Root>
      </Stack>

      {/* C */}
      <Stack minW="110px" gap="1">
        <Text fontSize="xs" color="fg.muted">
          C
        </Text>
        <NumberInput.Root
          min={0}
          step={0.01}
          value={toFixedOrNull(value.c)}
          locale="en-US"
          formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
          onValueChange={({ valueAsNumber, value }) => {
            if (readOnly) return
            const next =
              value === "" || Number.isNaN(valueAsNumber)
                ? null
                : Number(valueAsNumber.toFixed(2))
            onChange("c", next)
          }}
          disabled={readOnly}
        >
          <NumberInput.Input id="priceC" placeholder="e.g. 1.50" inputMode="decimal" onBlur={onBlur} />
          <NumberInput.Control>
            <NumberInput.IncrementTrigger />
            <NumberInput.DecrementTrigger />
          </NumberInput.Control>
        </NumberInput.Root>
      </Stack>
    </HStack>
  )
}
