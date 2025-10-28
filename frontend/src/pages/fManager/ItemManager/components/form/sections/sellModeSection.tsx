import {
  Box,
  Field,
  NumberInput,
  Stack,
  Switch,
  Text,
} from "@chakra-ui/react"

type SellModes = {
  byKg?: boolean
  byUnit?: boolean
  unitBundleSize?: number
}

type Values = {
  category?: string
  sellModes?: SellModes
}

type Props = {
  values: Values
  setValues: React.Dispatch<React.SetStateAction<Values>>
  readOnly?: boolean
}

export default function SellModesSection({ values, setValues, readOnly }: Props) {
  const currentBundle =
    values.sellModes?.unitBundleSize ??
    (values.category === "egg_dairy" ? 12 : 1)

  return (
    <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
      <Text fontWeight="semibold" mb={3}>
        Sell Modes
      </Text>

      <Stack gap={4}>
        <Stack gap={8} wrap="wrap">
          <Field.Root>
            <Stack>
              <Switch.Root
                checked={values.sellModes?.byKg !== false}
                disabled={readOnly || values.category === "egg_dairy"}
                onCheckedChange={(e) => {
                  if (readOnly) return
                  setValues((s) => ({
                    ...s,
                    sellModes: { ...(s.sellModes ?? {}), byKg: e.checked },
                  }))
                }}
              >
                <Switch.Control />
                <Switch.Thumb />
              </Switch.Root>
              <Field.Label>Sell by kg</Field.Label>
            </Stack>
          </Field.Root>

          <Field.Root>
            <Stack>
              <Switch.Root
                checked={!!values.sellModes?.byUnit || values.category === "egg_dairy"}
                disabled={readOnly}
                onCheckedChange={(e) => {
                  if (readOnly) return
                  setValues((s) => ({
                    ...s,
                    sellModes: { ...(s.sellModes ?? {}), byUnit: e.checked },
                  }))
                }}
              >
                <Switch.Control />
                <Switch.Thumb />
              </Switch.Root>
              <Field.Label>Sell by unit</Field.Label>
            </Stack>
          </Field.Root>
        </Stack>

        <Field.Root>
          <Field.Label>Unit bundle size</Field.Label>
          {/* NumberInput.Root in Chakra v3 is string-controlled */}
          <NumberInput.Root
            min={1}
            step={1}
            value={String(currentBundle)}
            onValueChange={({ value }) => {
              if (readOnly) return
              const n = Number(value)
              const nb = Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1
              setValues((s) => ({
                ...s,
                sellModes: { ...(s.sellModes ?? {}), unitBundleSize: nb },
              }))
            }}
            disabled={readOnly}
          >
            <NumberInput.Input inputMode="numeric" />
            <NumberInput.Control>
              <NumberInput.IncrementTrigger />
              <NumberInput.DecrementTrigger />
            </NumberInput.Control>
          </NumberInput.Root>
          <Field.HelperText>
            Eggs &amp; dairy default to 12; kg selling is disabled for that category.
          </Field.HelperText>
        </Field.Root>
      </Stack>
    </Box>
  )
}
