import * as React from "react"
import {
  Badge,
  Box,
  Field,
  HStack,
  Input,
  NativeSelect,
  NumberInput,
  Stack,
  Switch,
  Text,
  Textarea,
} from "@chakra-ui/react"

export type PackingInfo = {
  bulkDensityKgPerL?: number | null
  litersPerKg?: number | null
  fragility?: "very_fragile" | "fragile" | "normal" | "sturdy" | null
  allowMixing?: boolean
  requiresVentedBox?: boolean
  minBoxType?: string | null
  maxWeightPerBoxKg?: number | null
  notes?: string | null
}

type Props = {
  value?: PackingInfo | null
  onChange: (next?: PackingInfo | null) => void
  readOnly?: boolean
  boxTypeOptions?: string[]
}

const toNullableNumber = (v: string | number): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const normalized = v.replace(/\s/g, "").replace(",", ".")
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

// always feed NumberInput a string
const asStr = (n?: number | null) => (n == null ? "" : String(n))

export default function ItemsPackingSection({
  value,
  onChange,
  readOnly,
  boxTypeOptions,
}: Props) {
  const v: PackingInfo = value ?? {}

  const set = <K extends keyof PackingInfo>(key: K, next: PackingInfo[K]) => {
    const merged: PackingInfo = { ...v, [key]: next }

    // auto-derive litersPerKg <-> bulkDensity
    if (key === "bulkDensityKgPerL") {
      const d = merged.bulkDensityKgPerL ?? null
      merged.litersPerKg = d && d > 0 ? Number((1 / d).toFixed(3)) : null
    }
    if (key === "litersPerKg") {
      const l = merged.litersPerKg ?? null
      merged.bulkDensityKgPerL = l && l > 0 ? Number((1 / l).toFixed(3)) : null
    }

    // prune to undefined if totally empty
    const cleaned =
      Object.values(merged).every((x) => x == null || x === false || x === "")
        ? undefined
        : merged

    onChange(cleaned as any)
  }

  return (
    <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
      <Text fontWeight="semibold" mb={3}>
        Packing Data
      </Text>

      <Stack gap={4}>
        {/* Density pair */}
        <HStack align="start" gap={6} wrap="wrap">
          <Field.Root>
            <Field.Label>Bulk density</Field.Label>
            <HStack gap={2}>
              <NumberInput.Root
                value={asStr(v.bulkDensityKgPerL)}
                onValueChange={({ value }) =>
                  set("bulkDensityKgPerL", toNullableNumber(value))
                }
                step={0.01}
                min={0}
                disabled={readOnly}
              >
                <NumberInput.Input placeholder="e.g. 0.65" inputMode="decimal" />
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
              </NumberInput.Root>
              <Badge variant="subtle">kg/L</Badge>
            </HStack>
            <Field.HelperText>Auto-syncs with “Liters per 1 kg”.</Field.HelperText>
          </Field.Root>

          <Field.Root>
            <Field.Label>Liters per 1 kg</Field.Label>
            <HStack gap={2}>
              <NumberInput.Root
                value={asStr(v.litersPerKg)}
                onValueChange={({ value }) =>
                  set("litersPerKg", toNullableNumber(value))
                }
                step={0.01}
                min={0}
                disabled={readOnly}
              >
                <NumberInput.Input placeholder="e.g. 1.538" inputMode="decimal" />
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
              </NumberInput.Root>
              <Badge variant="subtle">L/kg</Badge>
            </HStack>
          </Field.Root>
        </HStack>

        {/* Fragility */}
        <Field.Root>
          <Field.Label>Fragility</Field.Label>
          <NativeSelect.Root disabled={readOnly}>
            <NativeSelect.Field
              value={v.fragility ?? ""}
              onChange={(e) =>
                set("fragility", (e.target.value || null) as PackingInfo["fragility"])
              }
            >
              <option value="">—</option>
              <option value="very_fragile">Very fragile</option>
              <option value="fragile">Fragile</option>
              <option value="normal">Normal</option>
              <option value="sturdy">Sturdy</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Field.HelperText>Very fragile items go on top.</Field.HelperText>
        </Field.Root>

        {/* Booleans */}
        <HStack gap={8} wrap="wrap">
          <Field.Root>
            <HStack>
              <Switch.Root
                checked={!!v.allowMixing}
                onCheckedChange={(e) => set("allowMixing", e.checked)}
                disabled={readOnly}
              >
                <Switch.Control />
                <Switch.Thumb />
              </Switch.Root>
              <Field.Label>Allow mixing with other items</Field.Label>
            </HStack>
          </Field.Root>

          <Field.Root>
            <HStack>
              <Switch.Root
                checked={!!v.requiresVentedBox}
                onCheckedChange={(e) => set("requiresVentedBox", e.checked)}
                disabled={readOnly}
              >
                <Switch.Control />
                <Switch.Thumb />
              </Switch.Root>
              <Field.Label>Requires vented box</Field.Label>
            </HStack>
          </Field.Root>
        </HStack>

        {/* Box type + max weight */}
        <HStack align="start" gap={6} wrap="wrap">
          <Field.Root>
            <Field.Label>Minimum box type</Field.Label>
            {boxTypeOptions && boxTypeOptions.length ? (
              <NativeSelect.Root disabled={readOnly}>
                <NativeSelect.Field
                  value={v.minBoxType ?? ""}
                  onChange={(e) => set("minBoxType", e.target.value || null)}
                >
                  <option value="">—</option>
                  {boxTypeOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            ) : (
              <Input
                placeholder="e.g. S-vented"
                value={v.minBoxType ?? ""}
                onChange={(e) => set("minBoxType", e.target.value || null)}
                readOnly={readOnly}
                disabled={readOnly}
              />
            )}
          </Field.Root>

          <Field.Root>
            <Field.Label>Max weight per box</Field.Label>
            <HStack gap={2}>
              <NumberInput.Root
                value={asStr(v.maxWeightPerBoxKg)}
                onValueChange={({ value }) =>
                  set("maxWeightPerBoxKg", toNullableNumber(value))
                }
                step={0.5}
                min={0}
                disabled={readOnly}
              >
                <NumberInput.Input placeholder="e.g. 12.0" inputMode="decimal" />
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
              </NumberInput.Root>
              <Badge variant="subtle">kg</Badge>
            </HStack>
          </Field.Root>
        </HStack>

        {/* Notes */}
        <Field.Root>
          <Field.Label>Notes</Field.Label>
          <Textarea
            placeholder="Any special handling, layering, or packaging notes…"
            value={v.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </Field.Root>
      </Stack>
    </Box>
  )
}
