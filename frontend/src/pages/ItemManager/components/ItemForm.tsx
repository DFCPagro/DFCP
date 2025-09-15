import { useMemo, useState, useEffect } from "react";
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
} from "@chakra-ui/react";
import { z } from "zod";
import {
  itemCategories,
  itemFormSchema,
  type ItemFormValues,
} from "@/api/items";

// Convert Zod issues into a flat error map we can render easily
type Errors = Partial<
  Record<
    | "category"
    | "type"
    | "variety"
    | "imageUrl"
    | "caloriesPer100g"
    | "price.a"
    | "price.b"
    | "price.c",
    string
  >
>;

function zodErrorsToState(err: z.ZodError): Errors {
  const out: Errors = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    out[path as keyof Errors] = issue.message;
  }
  return out;
}

type Props = {
  defaultValues?: Partial<ItemFormValues>;
  onSubmit: (values: ItemFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
};

export default function ItemForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode = "create",
}: Props) {
  // ---------- form state ----------
  const initial: ItemFormValues = useMemo(
    () => ({
      category: "fruit",
      type: "",
      variety: "",
      imageUrl: "",
      caloriesPer100g: undefined,
      price: { a: null, b: null, c: null },
      ...defaultValues,
    }),
    [defaultValues]
  );

  const [values, setValues] = useState<ItemFormValues>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const numToInput = (n: number | null | undefined) =>
    n == null ? "" : String(n);

  // parse the string Chakra gives us, even if valueAsNumber is NaN
  const toNumber = (value: string, fractionDigits = 0) => {
    // normalize common decimal separators; we also remove spaces
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    return fractionDigits > 0
      ? Number(n.toFixed(fractionDigits))
      : Math.trunc(n);
  };

 

  const setField = <K extends keyof ItemFormValues>(
    key: K,
    v: ItemFormValues[K]
  ) => {
    setValues((s) => ({ ...s, [key]: v }));
  };

  const setPrice = (key: "a" | "b" | "c", v: number | null) => {
    setValues((s) => ({ ...s, price: { ...s.price, [key]: v } }));
  };

  const markTouched = (name: string) =>
    setTouched((t) => (t[name] ? t : { ...t, [name]: true }));

  const validate = (next?: ItemFormValues): Errors => {
    const data = next ?? values;
    const res = itemFormSchema.safeParse(data);
    if (res.success) {
      setErrors({});
      return {};
    } else {
      const mapped = zodErrorsToState(res.error);
      setErrors(mapped);
      return mapped;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (Object.keys(err).length === 0) {
      await onSubmit(values);
    } else {
      const allTouched: Record<string, boolean> = {};
      Object.keys(values).forEach((k) => (allTouched[k] = true));
      ["price.a", "price.b", "price.c"].forEach((k) => (allTouched[k] = true));
      setTouched((t) => ({ ...t, ...allTouched }));
    }
  };

  // Derived flag similar to RHF's isDirty/isValid
  const isDirty = JSON.stringify(values) !== JSON.stringify(initial);
  const isValid = useMemo(
    () => itemFormSchema.safeParse(values).success,
    [values]
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap={4}>
        {/* Category */}
        <Field.Root
          required
          invalid={!!errors["category"] && touched["category"]}
        >
          <Field.Label>Category</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={values.category}
              onChange={(e) => {
                markTouched("category");
                setField(
                  "category",
                  e.target.value as ItemFormValues["category"]
                );
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
              markTouched("type");
              setField("type", e.target.value);
            }}
            onBlur={() => validate()}
          />
          <Field.ErrorText>{errors["type"]}</Field.ErrorText>
        </Field.Root>

        {/* Variety */}
        <Field.Root
          required
          invalid={!!errors["variety"] && touched["variety"]}
        >
          <Field.Label>Variety</Field.Label>
          <Input
            placeholder="e.g. Fuji"
            value={values.variety ?? ""}
            required
            onChange={(e) => {
              markTouched("variety");
              setField("variety", e.target.value);
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
              markTouched("imageUrl");
              setField("imageUrl", e.target.value);
            }}
            onBlur={() => validate()}
          />
          <Field.ErrorText>{errors["imageUrl"]}</Field.ErrorText>
        </Field.Root>

        {/* Calories / 100g */}
        <Field.Root
          invalid={!!errors["caloriesPer100g"] && touched["caloriesPer100g"]}
        >
          <Field.Label>Calories / 100g</Field.Label>

          <NumberInput.Root
            min={0}
            step={1}
            // ✅ keep value a string
            value={
              values.caloriesPer100g == null
                ? ""
                : String(values.caloriesPer100g)
            }
            // ✅ make formatting deterministic
            locale="en-US"
            formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
            onValueChange={({ value, valueAsNumber }) => {
              markTouched("caloriesPer100g");
              const next =
                value === "" || Number.isNaN(valueAsNumber)
                  ? toNumber(value, 0) // fallback from string
                  : Math.trunc(valueAsNumber);

              setField("caloriesPer100g", next == null ? undefined : next);
            }}
          >
            <NumberInput.Input
              placeholder="optional"
              inputMode="numeric"
              onBlur={() => validate()}
            />
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
              <NumberInput.Root
                key={`price-a-${values.price.a ?? "nil"}`} // helps remount when editing different items
                min={0}
                step={0.01}
                value={values.price.a == null ? "" : String(values.price.a)}
                locale="en-US"
                formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
                onValueChange={({ value, valueAsNumber }) => {
                  markTouched("price.a");
                  const next =
                    value === "" || Number.isNaN(valueAsNumber)
                      ? toNumber(value, 2)
                      : Number(valueAsNumber.toFixed(2));
                  setPrice("a", next);
                }}
              >
                <NumberInput.Input
                  name="priceA"
                  id="priceA"
                  placeholder="A"
                  inputMode="decimal"
                  onBlur={() => validate()}
                />
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
              </NumberInput.Root>

              {/* B */}
              <NumberInput.Root
                key={`price-b-${values.price.b ?? "nil"}`}
                min={0}
                step={0.01}
                value={values.price.b == null ? "" : String(values.price.b)}
                locale="en-US"
                formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
                onValueChange={({ value, valueAsNumber }) => {
                  markTouched("price.b");
                  const next =
                    value === "" || Number.isNaN(valueAsNumber)
                      ? toNumber(value, 2)
                      : Number(valueAsNumber.toFixed(2));
                  setPrice("b", next);
                }}
              >
                <NumberInput.Input
                  name="priceB"
                  id="priceB"
                  placeholder="B"
                  inputMode="decimal"
                  onBlur={() => validate()}
                />
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
              </NumberInput.Root>

              {/* C */}
              <NumberInput.Root
                key={`price-c-${values.price.c ?? "nil"}`}
                min={0}
                step={0.01}
                value={values.price.c == null ? "" : String(values.price.c)}
                locale="en-US"
                formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
                onValueChange={({ value, valueAsNumber }) => {
                  markTouched("price.c");
                  const next =
                    value === "" || Number.isNaN(valueAsNumber)
                      ? toNumber(value, 2)
                      : Number(valueAsNumber.toFixed(2));
                  setPrice("c", next);
                }}
              >
                <NumberInput.Input
                  name="priceC"
                  id="priceC"
                  placeholder="C"
                  inputMode="decimal"
                  onBlur={() => validate()}
                />
                <NumberInput.Control>
                  <NumberInput.IncrementTrigger />
                  <NumberInput.DecrementTrigger />
                </NumberInput.Control>
              </NumberInput.Root>
          </HStack>

          <Field.ErrorText>
            {errors["price.a"] || errors["price.b"] || errors["price.c"]}
          </Field.ErrorText>
        </Field.Root>

        {/* Submit */}
        <Flex justify="flex-end" gap={3} pt={2}>
          <Button
            type="submit"
            colorPalette="teal"
            loading={isSubmitting}
            disabled={!isDirty || !isValid}
          >
            {mode === "create" ? "Create Item" : "Save Changes"}
          </Button>
        </Flex>
      </Stack>
    </form>
  );
}
