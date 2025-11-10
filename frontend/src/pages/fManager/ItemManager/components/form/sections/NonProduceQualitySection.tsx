import { Box, Field, Input, NativeSelect, NumberInput, Text } from "@chakra-ui/react"

export type NonProduceQuality = {
  /** Enum grade: A | B | C */
  grade?: "A" | "B" | "C" | null
  /** Shelf-life or freshness in days, min 0 */
  freshnessDays?: number | null
  /** Fat percentage, 0–100 */
  fatPercentage?: number | null
}

type Props = {
  value?: NonProduceQuality | null
  onChange: (next?: NonProduceQuality | null) => void
  readOnly?: boolean
}

export default function NonProduceQualitySection({ value, onChange, readOnly }: Props) {
  const v = value ?? {}

  const set = <K extends keyof NonProduceQuality>(key: K, next: NonProduceQuality[K]) => {
    onChange({ ...v, [key]: next })
  }

  const parseNumber = (raw: string): number | null => {
    if (raw.trim() === "") return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  return (
    <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
      {/* Grade */}
      <Field.Root>
        <Field.Label>Quality grade</Field.Label>
        <NativeSelect.Root disabled={readOnly} width="240px">
          <NativeSelect.Field
            value={v.grade ?? ""}
            onChange={(e) => {
              const val = e.target.value as "A" | "B" | "C" | ""
              set("grade", val ? val : null)
            }}
          >
            <option value="">Select grade</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <Text mt="2" fontSize="xs" color="fg.muted">
          Choose one of the allowed grades: A, B, or C.
        </Text>
      </Field.Root>

      {/* Freshness (days) */}
      <Field.Root mt="4">
        <Field.Label>Freshness (days)</Field.Label>
        <NumberInput.Root min={0} step={1} width="240px" disabled={readOnly}>
          <NumberInput.Control />
          <NumberInput.Input
            inputMode="numeric"
            value={v.freshnessDays ?? ""}
            onChange={(e) => {
              const n = parseNumber(e.target.value)
              set("freshnessDays", n == null ? null : Math.max(0, n))
            }}
          />
        </NumberInput.Root>
        <Text mt="2" fontSize="xs" color="fg.muted">
          Non-negative number of days.
        </Text>
      </Field.Root>

      {/* Fat percentage */}
      <Field.Root mt="4">
        <Field.Label>Fat percentage (%)</Field.Label>
        <NumberInput.Root min={0} max={100} step={0.1} width="240px" disabled={readOnly}>
          <NumberInput.Control />
          <NumberInput.Input
            inputMode="decimal"
            value={v.fatPercentage ?? ""}
            onChange={(e) => {
              const n = parseNumber(e.target.value)
              if (n == null) {
                set("fatPercentage", null)
              } else {
                set("fatPercentage", Math.max(0, Math.min(100, n)))
              }
            }}
          />
        </NumberInput.Root>
        <Text mt="2" fontSize="xs" color="fg.muted">
          Value from 0 to 100.
        </Text>
      </Field.Root>
    </Box>
  )
}
