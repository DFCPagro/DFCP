import { useMemo, useState, useEffect } from "react"
import {
  Button,
  Field,
  Flex,
  Text,
  HStack,
  Input,
  NativeSelect,
  NumberInput,
  Stack,
} from "@chakra-ui/react"
import { z } from "zod"
import {
  itemCategories,
  itemFormSchema,
  type ItemFormValues,
} from "@/api/items"
import QualityStandardsEditorDialog from "./QualityStandardsEditorDialog"

// ---------- Error mapping ----------
type Errors = Partial<
  Record<
    | "category"
    | "type"
    | "variety"
    | "imageUrl"
    | "caloriesPer100g"
    | "price.a"
    | "price.b"
    | "price.c"
    | "season"
    | "tolerance",
    string
  >
>

function zodErrorsToState(err: z.ZodError): Errors {
  const out: Errors = {}
  for (const issue of err.issues) {
    const path = issue.path.join(".")
    out[path as keyof Errors] = issue.message
  }
  return out
}

// ---------- Helpers ----------
const normalizeFormDefaults = (defs?: Partial<ItemFormValues>): ItemFormValues => ({
  category: "fruit",
  type: "",
  variety: "",
  imageUrl: "",
  caloriesPer100g: undefined,
  season: "",
  tolerance: "",
  qualityStandards: undefined,
  ...defs,
  // ensure price shape
  price: {
    a: defs?.price?.a ?? null,
    b: defs?.price?.b ?? null,
    c: defs?.price?.c ?? null,
  },
})

const toNumber = (value: string, fractionDigits = 0): number | null => {
  const normalized = value.replace(/\s/g, "").replace(",", ".")
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return fractionDigits > 0 ? Number(n.toFixed(fractionDigits)) : Math.trunc(n)
}

// ---------- Component ----------
type Props = {
  defaultValues?: Partial<ItemFormValues>
  onSubmit: (values: ItemFormValues) => void | Promise<void>
  isSubmitting?: boolean
  mode?: "create" | "edit"
}

export default function ItemForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode = "create",
}: Props) {
  // initial snapshot (used for isDirty)
  const initial = useMemo(() => normalizeFormDefaults(defaultValues), [defaultValues])

  const [values, setValues] = useState<ItemFormValues>(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [qsOpen, setQsOpen] = useState(false)

  // keep state in sync when defaultValues change (e.g., switching edited item)
  useEffect(() => {
    const next = normalizeFormDefaults(defaultValues)
    setValues(next)
    setErrors({})
    setTouched({})
  }, [defaultValues])

  const setField = <K extends keyof ItemFormValues>(key: K, v: ItemFormValues[K]) => {
    setValues((s) => ({ ...s, [key]: v }))
  }

  const setPrice = (key: "a" | "b" | "c", v: number | null) => {
    setValues((s) => ({ ...s, price: { ...s.price, [key]: v } }))
  }

  const markTouched = (name: string) =>
    setTouched((t) => (t[name] ? t : { ...t, [name]: true }))

  const validate = (next?: ItemFormValues): Errors => {
    const data = next ?? values
    const res = itemFormSchema.safeParse(data)
    if (res.success) {
      setErrors({})
      return {}
    } else {
      const mapped = zodErrorsToState(res.error)
      setErrors(mapped)
      return mapped
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validate()
    if (Object.keys(err).length === 0) {
      await onSubmit(values)
    } else {
      const allTouched: Record<string, boolean> = {}
      Object.keys(values).forEach((k) => (allTouched[k] = true))
      ;["price.a", "price.b", "price.c"].forEach((k) => (allTouched[k] = true))
      setTouched((t) => ({ ...t, ...allTouched }))
    }
  }

  // Derived flags
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial)
  const isValid = useMemo(() => itemFormSchema.safeParse(values).success, [values])

  // quality standards metrics count (for subtitle)
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
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.category}
              onChange={(e) => {
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
              markTouched("type")
              setField("type", e.target.value)
            }}
            onBlur={() => validate()}
          />
          <Field.ErrorText>{errors["type"]}</Field.ErrorText>
        </Field.Root>

        {/* Variety (required by your backend) */}
        <Field.Root required invalid={!!errors["variety"] && touched["variety"]}>
          <Field.Label>Variety</Field.Label>
          <Input
            placeholder="e.g. Fuji"
            value={values.variety ?? ""}
            required
            onChange={(e) => {
              markTouched("variety")
              setField("variety", e.target.value)
            }}
            onBlur={() => validate()}
          />
          <Field.ErrorText>{errors["variety"]}</Field.ErrorText>
        </Field.Root>

        {/* Image URL */}
        <Field.Root invalid={!!errors["imageUrl"] && touched["imageUrl"]}>
          <Field.Label>Image URL</Field.Label>
          <Input
            placeholder="https://..."
            value={values.imageUrl ?? ""}
            onChange={(e) => {
              markTouched("imageUrl")
              setField("imageUrl", e.target.value)
            }}
            onBlur={() => validate()}
          />
          <Field.ErrorText>{errors["imageUrl"]}</Field.ErrorText>
        </Field.Root>

        {/* Season */}
        <Field.Root invalid={!!errors["season"] && touched["season"]}>
          <Field.Label>Season</Field.Label>
          <Input
            placeholder="e.g. Nov–Mar"
            value={(values as any).season ?? ""}
            onChange={(e) => {
              markTouched("season")
              setField("season" as any, e.target.value)
            }}
            onBlur={() => validate()}
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
              markTouched("tolerance")
              setField("tolerance" as any, e.target.value)
            }}
            onBlur={() => validate()}
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
              markTouched("caloriesPer100g")
              const next =
                value === "" || Number.isNaN(valueAsNumber)
                  ? toNumber(value, 0)
                  : Math.trunc(valueAsNumber)
              setField("caloriesPer100g", next == null ? undefined : next)
            }}
          >
            <NumberInput.Input placeholder="optional" inputMode="numeric" onBlur={() => validate()} />
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
          <HStack gap="3" align="start">
            {/* A */}
            <Stack minW="110px" gap="1">
              <Text fontSize="xs" color="fg.muted">
                A
              </Text>
              <NumberInput.Root
                min={0}
                step={0.01}
                value={values.price.a == null ? "" : String(values.price.a)}
                locale="en-US"
                formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
                onValueChange={({ value, valueAsNumber }) => {
                  markTouched("price.a")
                  const next =
                    value === "" || Number.isNaN(valueAsNumber)
                      ? toNumber(value, 2)
                      : Number(valueAsNumber.toFixed(2))
                  setPrice("a", next)
                }}
              >
                <NumberInput.Input name="priceA" id="priceA" placeholder="A" inputMode="decimal" onBlur={() => validate()} />
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
                value={values.price.b == null ? "" : String(values.price.b)}
                locale="en-US"
                formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
                onValueChange={({ value, valueAsNumber }) => {
                  markTouched("price.b")
                  const next =
                    value === "" || Number.isNaN(valueAsNumber)
                      ? toNumber(value, 2)
                      : Number(valueAsNumber.toFixed(2))
                  setPrice("b", next)
                }}
              >
                <NumberInput.Input name="priceB" id="priceB" placeholder="B" inputMode="decimal" onBlur={() => validate()} />
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
                value={values.price.c == null ? "" : String(values.price.c)}
                locale="en-US"
                formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
                onValueChange={({ value, valueAsNumber }) => {
                  markTouched("price.c")
                  const next =
                    value === "" || Number.isNaN(valueAsNumber)
                      ? toNumber(value, 2)
                      : Number(valueAsNumber.toFixed(2))
                  setPrice("c", next)
                }}
              >
                <NumberInput.Input name="priceC" id="priceC" placeholder="C" inputMode="decimal" onBlur={() => validate()} />
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
              </NumberInput.Root>
            </Stack>
          </HStack>
          <Field.ErrorText>
            {errors["price.a"] || errors["price.b"] || errors["price.c"]}
          </Field.ErrorText>
        </Field.Root>

        {/* Quality Standards editor trigger + summary */}
        <Field.Root>
          <HStack justify="space-between" align="center">
            <Stack gap="0">
              <Field.Label>Quality standards</Field.Label>
              <Text fontSize="xs" color="fg.muted">
                {countQs((values as any).qualityStandards)} metric
                {countQs((values as any).qualityStandards) === 1 ? "" : "s"} set
              </Text>
            </Stack>
            <Button size="sm" variant="outline" onClick={() => setQsOpen(true)}>
              Edit
            </Button>
          </HStack>
        </Field.Root>

        {/* Editor dialog (portals) */}
        <QualityStandardsEditorDialog
          open={qsOpen}
          setOpen={setQsOpen}
          value={(values as any).qualityStandards}
          onChange={(next) => {
            setValues((s) => ({ ...(s as any), qualityStandards: next }))
            validate({ ...(values as any), qualityStandards: next })
          }}
        />

        {/* Submit */}
        <Flex justify="flex-end" gap={3} pt={2}>
          <Button type="submit" colorPalette="teal" loading={isSubmitting} disabled={!isDirty || !isValid}>
            {mode === "create" ? "Create Item" : "Save Changes"}
          </Button>
        </Flex>
      </Stack>
    </form>
  )
}
