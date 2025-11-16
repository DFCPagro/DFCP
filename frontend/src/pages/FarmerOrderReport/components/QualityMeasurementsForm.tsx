import * as React from "react"
import {
  Badge,
  Field,
  HStack,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react"

import type { QualityMeasurements } from "@/types/items";


type Props = {
  value?: QualityMeasurements
  onChange: (next: QualityMeasurements | undefined) => void
  readOnly?: boolean
}

const UNITS: Partial<Record<keyof QualityMeasurements, string>> = {
  brix: "%",
  acidityPercentage: "%",
  pressure: "kg/cm²",
  colorPercentage: "%",
  weightPerUnitG: "g",
  diameterMM: "mm",
}

const COLOR_OPTIONS = [
  { value: "bright", label: "Bright coloration" },
  { value: "moderate", label: "Moderate coloration" },
  { value: "pale", label: "Pale / uneven" },
]

export function QualityMeasurementsForm({ value, onChange, readOnly }: Props) {
  const setField = React.useCallback(
    (key: keyof QualityMeasurements, raw: string) => {
      const v = raw.trim()
      const next: QualityMeasurements = { ...(value ?? {}) }

      if (!v) {
        delete (next as any)[key]
      } else {
        ;(next as any)[key] = v
      }

      onChange(Object.keys(next).length ? next : undefined)
    },
    [value, onChange],
  )

  const disabled = !!readOnly
  const hasColorSelection = !!value?.colorDescription

  return (
    <Stack gap="4">
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        {/* Brix */}
        <Field.Root>
          <Field.Label>Brix %</Field.Label>
          <HStack gap="2">
            <Input
              size="sm"
              value={value?.brix ?? ""}
              onChange={(e) => setField("brix", e.target.value)}
              placeholder="e.g. 12.5"
              disabled={disabled}
            />
            <Badge variant="subtle">{UNITS.brix}</Badge>
          </HStack>
        </Field.Root>

        {/* Acidity */}
        <Field.Root>
          <Field.Label>Acidity %</Field.Label>
          <HStack gap="2">
            <Input
              size="sm"
              value={value?.acidityPercentage ?? ""}
              onChange={(e) => setField("acidityPercentage", e.target.value)}
              placeholder="e.g. 0.45"
              disabled={disabled}
            />
            <Badge variant="subtle">{UNITS.acidityPercentage}</Badge>
          </HStack>
        </Field.Root>

        {/* Pressure */}
        <Field.Root>
          <Field.Label>Firmness / Pressure</Field.Label>
          <HStack gap="2">
            <Input
              size="sm"
              value={value?.pressure ?? ""}
              onChange={(e) => setField("pressure", e.target.value)}
              placeholder="e.g. 7.0"
              disabled={disabled}
            />
            <Badge variant="subtle">{UNITS.pressure}</Badge>
          </HStack>
        </Field.Root>

        {/* Weight */}
        <Field.Root>
          <Field.Label>Weight per unit</Field.Label>
          <HStack gap="2">
            <Input
              size="sm"
              value={value?.weightPerUnitG ?? ""}
              onChange={(e) => setField("weightPerUnitG", e.target.value)}
              placeholder="e.g. 160"
              disabled={disabled}
            />
            <Badge variant="subtle">{UNITS.weightPerUnitG}</Badge>
          </HStack>
        </Field.Root>

        {/* Diameter */}
        <Field.Root>
          <Field.Label>Diameter (mm)</Field.Label>
          <HStack gap="2">
            <Input
              size="sm"
              value={value?.diameterMM ?? ""}
              onChange={(e) => setField("diameterMM", e.target.value)}
              placeholder="e.g. 68"
              disabled={disabled}
            />
            <Badge variant="subtle">{UNITS.diameterMM}</Badge>
          </HStack>
        </Field.Root>

        {/* COLOR: description + percentage */}
        <Field.Root>
          <Field.Label>Color</Field.Label>
          <Stack gap="2">
            {/* Description dropdown */}
            <HStack gap="2">
              <NativeSelect.Root size="sm" disabled={disabled}>
                <NativeSelect.Field
                  value={value?.colorDescription ?? ""}
                  onChange={(e) =>
                    setField("colorDescription", e.target.value)
                  }
                >
                  <option value="" disabled>
                    Select coloration...
                  </option>
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </HStack>

            {/* Percentage */}
            <HStack gap="2" align="flex-start">
              <Input
                size="sm"
                value={value?.colorPercentage ?? ""}
                onChange={(e) => setField("colorPercentage", e.target.value)}
                placeholder="Color coverage %"
                disabled={disabled || !hasColorSelection}
              />
              <Badge variant="subtle" mt="1">
                {UNITS.colorPercentage}
              </Badge>
              <Text fontSize="xs" color="fg.muted" mt="1">
                {hasColorSelection
                  ? "e.g. 85"
                  : "Select coloration before entering coverage."}
              </Text>
            </HStack>
          </Stack>
        </Field.Root>
      </SimpleGrid>

      <Text fontSize="xs" color="fg.muted">
        Tip: fields left blank will be ignored.
      </Text>
    </Stack>
  )
}

export default QualityMeasurementsForm
