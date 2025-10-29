// src/pages/items/form/sections/SellModesSection.tsx
import * as React from "react";
import {
  Box, Field, NumberInput, Stack, Switch, Text, SimpleGrid,
} from "@chakra-ui/react";

type SellModes = {
  byKg?: boolean;
  byUnit?: boolean;
  unitBundleSize?: number;
  kgBundleSize?: number;
};
type Values = { category?: string; sellModes?: SellModes };
type Props = {
  values: Values;
  setValues: React.Dispatch<React.SetStateAction<Values>>;
  readOnly?: boolean;
};

export default function SellModesSection({ values, setValues, readOnly }: Props) {
  const isEgg = values.category === "egg_dairy";

  const byKg = !!values.sellModes?.byKg;
  const byUnit = !!values.sellModes?.byUnit;
  const unitBundle = Math.max(1, values.sellModes?.unitBundleSize ?? 1);
  const kgBundle = Math.max(1, values.sellModes?.kgBundleSize ?? 1);

  const setSell = (patch: Partial<SellModes>) =>
    setValues((s) => ({ ...s, sellModes: { ...(s.sellModes ?? {}), ...patch } }));

  return (
    <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
      <Text fontWeight="semibold" mb={3}>Sell Modes</Text>

      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
        {/* Independent toggles */}
        <Stack gap={6}>
          <Field.Root>
            <Stack>
              <Switch.Root checked={byKg} disabled={readOnly || isEgg /* keep if policy */}>
                <Switch.HiddenInput
                  onChange={(e) => {
                    if (readOnly || isEgg) return;
                    setSell({ byKg: e.currentTarget.checked });
                  }}
                />
                <Switch.Control />
                <Switch.Thumb />
              </Switch.Root>
              <Field.Label>Sell by kg</Field.Label>
            </Stack>
          </Field.Root>

          <Field.Root>
            <Stack>
              <Switch.Root checked={byUnit} disabled={readOnly}>
                <Switch.HiddenInput
                  onChange={(e) => {
                    if (readOnly) return;
                    setSell({ byUnit: e.currentTarget.checked });
                  }}
                />
                <Switch.Control />
                <Switch.Thumb />
              </Switch.Root>
              <Field.Label>Sell by unit</Field.Label>
            </Stack>
          </Field.Root>
        </Stack>

        {/* Independent bundle sizes */}
        <Stack gap={6}>
          <Field.Root>
            <Field.Label>Unit bundle size</Field.Label>
            <NumberInput.Root
              min={1}
              step={1}
              value={String(unitBundle)}
              disabled={readOnly}
              onValueChange={({ value }) => {
                if (readOnly) return;
                const n = Number(value);
                setSell({ unitBundleSize: Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1 });
              }}
            >
              <NumberInput.Input inputMode="numeric" />
              <NumberInput.Control>
                <NumberInput.IncrementTrigger />
                <NumberInput.DecrementTrigger />
              </NumberInput.Control>
            </NumberInput.Root>
          </Field.Root>

          <Field.Root>
            <Field.Label>KG bundle size</Field.Label>
            <NumberInput.Root
              min={1}
              step={1}
              value={String(kgBundle)}
              disabled={readOnly}
              onValueChange={({ value }) => {
                if (readOnly) return;
                const n = Number(value);
                setSell({ kgBundleSize: Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : 1 });
              }}
            >
              <NumberInput.Input inputMode="numeric" />
              <NumberInput.Control>
                <NumberInput.IncrementTrigger />
                <NumberInput.DecrementTrigger />
              </NumberInput.Control>
            </NumberInput.Root>
          </Field.Root>
        </Stack>
      </SimpleGrid>
    </Box>
  );
}
