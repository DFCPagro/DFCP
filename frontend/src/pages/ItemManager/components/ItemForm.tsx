import { useMemo } from "react"
import {
  Button,
  Field,
  Flex,
  Text,
  Input,
  NativeSelect,
  NumberInput,
  Stack,
  Box,
} from "@chakra-ui/react"
import {
  itemCategories,
  type ItemFormValues,
} from "@/api/items"
import ImagePreview from "./form/sections/ImagePreview"
import PriceFields from "./form/sections/PriceFields"
import QualityStandardsSection, { type QualityStandards } from "./form/sections/QualityStandardsSection"
import { normalizeFormDefaults, useItemFormState } from "./form/useItemFormState"

type Props = {
  defaultValues?: Partial<ItemFormValues>
  onSubmit: (values: ItemFormValues) => void | Promise<void>
  isSubmitting?: boolean
  mode?: "create" | "edit"
  /** When true, renders a non-editable, view-only form */
  readOnly?: boolean
}

const toNumber = (value: string, fractionDigits = 0): number | null => {
  const normalized = value.replace(/\s/g, "").replace(",", ".")
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return fractionDigits > 0 ? Number(n.toFixed(fractionDigits)) : Math.trunc(n)
}

export default function ItemForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode = "create",
  readOnly = false,
}: Props) {
  const initial = useMemo(() => normalizeFormDefaults(defaultValues), [defaultValues])
  const {
    values,
    setValues,
    errors,
    touched,
    markTouched,
    validate,
    isDirty,
    isValid,
  } = useItemFormState(defaultValues)

  const setField = <K extends keyof ItemFormValues>(key: K, v: ItemFormValues[K]) =>
    setValues((s) => ({ ...s, [key]: v }))

  const setPrice = (key: "a" | "b" | "c", v: number | null) =>
    setValues((s) => ({ ...s, price: { ...s.price, [key]: v } }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (Object.keys(err).length === 0) {
      await onSubmit(values)
    } else {
      const allTouched: Record<string, boolean> = {}
      Object.keys(values).forEach((k) => (allTouched[k] = true))
      ;["price.a", "price.b", "price.c"].forEach((k) => (allTouched[k] = true))
    }
  }

  const countQs = (qs: any | undefined) => {
    if (!qs) return 0
    let c = 0
    for (const k of Object.keys(qs)) {
      const row = (qs as any)[k]
      if (row && (row.A || row.B || row.C)) c++
    }
    return c
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap={4}>
        {/* Category */}
        <Field.Root required invalid={!!errors["category"] && touched["category"]}>
          <Field.Label>Category</Field.Label>
          <NativeSelect.Root disabled={readOnly}>
            <NativeSelect.Field
              value={values.category}
              onChange={(e) => {
                if (readOnly) return
                markTouched("category")
                setField("category", e.target.value as ItemFormValues["category"])
              }}
              onBlur={() => validate()}
            >
              {itemCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
          <Field.ErrorText>{errors["category"]}</Field.ErrorText>
        </Field.Root>

        {/* Type */}
        <Field.Root required invalid={!!errors["type"] && touched["type"]}>
          <Field.Label>Type</Field.Label>
          <Input
            placeholder="e.g. Apple"
            value={values.type}
            onChange={(e) => {
              if (readOnly) return
              markTouched("type")
              setField("type", e.target.value)
            }}
            onBlur={() => validate()}
            readOnly={readOnly}
            disabled={readOnly}
          />
          <Field.ErrorText>{errors["type"]}</Field.ErrorText>
        </Field.Root>

        {/* Variety */}
        <Field.Root required invalid={!!errors["variety"] && touched["variety"]}>
          <Field.Label>Variety</Field.Label>
          <Input
            placeholder="e.g. Fuji"
            value={values.variety ?? ""}
            required
            onChange={(e) => {
              if (readOnly) return
              markTouched("variety")
              setField("variety", e.target.value)
            }}
            onBlur={() => validate()}
            readOnly={readOnly}
            disabled={readOnly}
          />
        </Field.Root>

        {/* Image URL + Preview */}
        <Field.Root invalid={!!errors["imageUrl"] && touched["imageUrl"]}>
          <Field.Label>Image URL</Field.Label>
          <Input
            placeholder="https://example.com/image.jpg"
            value={values.imageUrl ?? ""}
            onChange={(e) => {
              if (readOnly) return
              markTouched("imageUrl")
              setField("imageUrl", e.target.value)
            }}
            onBlur={() => validate()}
            readOnly={readOnly}
            disabled={readOnly}
          />
          <Box mt="3">
            <ImagePreview src={values.imageUrl} />
          </Box>
          <Field.ErrorText>{errors["imageUrl"]}</Field.ErrorText>
        </Field.Root>

        {/* Season */}
        <Field.Root invalid={!!errors["season"] && touched["season"]}>
          <Field.Label>Season</Field.Label>
          <Input
            placeholder="e.g. Nov–Mar"
            value={(values as any).season ?? ""}
            onChange={(e) => {
              if (readOnly) return
              markTouched("season")
              setField("season" as any, e.target.value)
            }}
            onBlur={() => validate()}
            readOnly={readOnly}
            disabled={readOnly}
          />
          <Field.ErrorText>{errors["season"]}</Field.ErrorText>
        </Field.Root>

        {/* Tolerance */}
        <Field.Root invalid={!!errors["tolerance"] && touched["tolerance"]}>
          <Field.Label>Tolerance</Field.Label>
          <Input
            placeholder="±2%"
            value={(values as any).tolerance ?? ""}
            onChange={(e) => {
              if (readOnly) return
              markTouched("tolerance")
              setField("tolerance" as any, e.target.value)
            }}
            onBlur={() => validate()}
            readOnly={readOnly}
            disabled={readOnly}
          />
          <Field.ErrorText>{errors["tolerance"]}</Field.ErrorText>
        </Field.Root>

        {/* Calories / 100g */}
        <Field.Root invalid={!!errors["caloriesPer100g"] && touched["caloriesPer100g"]}>
          <Field.Label>Calories / 100g</Field.Label>
          <NumberInput.Root
            min={0}
            step={1}
            value={values.caloriesPer100g == null ? "" : String(values.caloriesPer100g)}
            locale="en-US"
            formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
            onValueChange={({ value, valueAsNumber }) => {
              if (readOnly) return
              markTouched("caloriesPer100g")
              const next =
                value === "" || Number.isNaN(valueAsNumber)
                  ? toNumber(value, 0)
                  : Math.trunc(valueAsNumber)
              setField("caloriesPer100g", next == null ? undefined : next)
            }}
            disabled={readOnly}
          >
            <NumberInput.Input placeholder="e.g. 52" inputMode="numeric" onBlur={() => validate()} />
            <NumberInput.Control>
              <NumberInput.IncrementTrigger />
              <NumberInput.DecrementTrigger />
            </NumberInput.Control>
          </NumberInput.Root>
          <Field.ErrorText>{errors["caloriesPer100g"]}</Field.ErrorText>
        </Field.Root>

        {/* Price (A/B/C) */}
        <Field.Root
          invalid={
            !!(errors["price.a"] || errors["price.b"] || errors["price.c"]) &&
            (touched["price.a"] || touched["price.b"] || touched["price.c"])
          }
        >
          <Field.Label>Price (A/B/C)</Field.Label>
          <PriceFields
            value={values.price}
            onChange={setPrice}
            onBlur={() => validate()}
            readOnly={readOnly}
          />
          <Field.ErrorText>
            {errors["price.a"] || errors["price.b"] || errors["price.c"]}
          </Field.ErrorText>
        </Field.Root>

        {/* Collapsible Quality Standards – now part of the form */}
        <QualityStandardsSection
          value={(values as any).qualityStandards as QualityStandards | undefined}
          onChange={(next) => {
            if (readOnly) return
            setValues((s) => ({ ...(s as any), qualityStandards: next }))
          }}
          readOnly={readOnly}
        />
        <Text fontSize="xs" color="fg.muted">
          {countQs((values as any).qualityStandards)} metric
          {countQs((values as any).qualityStandards) === 1 ? "" : "s"} set
        </Text>

        {/* Submit */}
        {!readOnly && (
          <Flex justify="flex-end" gap={3} pt={2}>
            <Button type="submit" colorPalette="teal" loading={isSubmitting} disabled={!isDirty || !isValid}>
              {mode === "create" ? "Create Item" : "Save Changes"}
            </Button>
          </Flex>
        )}
      </Stack>
    </form>
  )
}
