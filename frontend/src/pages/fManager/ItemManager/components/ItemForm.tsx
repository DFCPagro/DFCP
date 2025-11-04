// src/pages/items/ItemForm.tsx
import { useMemo } from "react";
import {
  Box,
  Button,
  Field,
  Flex,
  Input,
  NativeSelect,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { itemCategories, type ItemFormValues } from "@/api/items";
import ImagePreview from "./form/sections/ImagePreview";
import PriceFields from "./form/sections/PriceFields";
import QualityStandardsSection, {
  type QualityStandards,
} from "../../../../components/common/items/QualityStandardsSection";
import {
  normalizeFormDefaults,
  useItemFormState,
} from "./form/useItemFormState";
import ItemsPackingSection from "./form/sections/itemPacking";
import SellModesSection from "./form/sections/sellModeSection";
import NonProduceQualitySection, {
  type NonProduceQuality,
} from "./form/sections/NonProduceQualitySection";

type Props = {
  defaultValues?: Partial<ItemFormValues>;
  onSubmit: (values: ItemFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
  readOnly?: boolean;
};

type StringKeys<T> = Extract<keyof T, string>;

const toNumber = (value: string, fractionDigits = 0): number | null => {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return fractionDigits > 0 ? Number(n.toFixed(fractionDigits)) : Math.trunc(n);
};

const isFruitOrVegetable = (c?: string | null) =>
  typeof c === "string" ? /(fruit|vegetable)s?$/i.test(c) : false;

export default function ItemForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  mode = "create",
  readOnly = false,
}: Props) {
  const normalizedDefaults = useMemo(
    () => normalizeFormDefaults(defaultValues),
    [defaultValues]
  );

  const {
    values,
    setValues,
    errors,
    touched,
    markTouched,
    validate,
    isDirty,
    isValid,
  } = useItemFormState(normalizedDefaults);

  const setField = <K extends keyof ItemFormValues>(
    key: K,
    v: ItemFormValues[K]
  ) => setValues((s) => ({ ...s, [key]: v }));

  const setPrice = (key: "a" | "b" | "c", v: number | null) =>
    setValues((s) => ({ ...s, price: { ...s.price, [key]: v } }));

  const markAllTouched = () => {
    (Object.keys(values) as StringKeys<ItemFormValues>[]).forEach((k) =>
      markTouched(k)
    );
    ["price.a", "price.b", "price.c"].forEach((k) => markTouched(k as any));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (Object.keys(err).length === 0) {
      await onSubmit(values);
    } else {
      markAllTouched();
    }
  };

  // Count for produce matrix. Keeps previous UX metric text.
  const countProduceMetrics = (qs: QualityStandards | undefined) => {
    if (!qs) return 0;
    let c = 0;
    for (const k of Object.keys(qs) as StringKeys<QualityStandards>[]) {
      const row = (qs as any)[k];
      if (row && (row.A || row.B || row.C)) c++;
    }
    return c;
  };

  const isProduce = isFruitOrVegetable(values.category);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap={4}>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
            <Field.Root
              required
              invalid={!!errors["category"] && touched["category"]}
            >
              <Field.Label>Category</Field.Label>
              <NativeSelect.Root disabled={readOnly}>
                <NativeSelect.Field
                  value={values.category}
                  onChange={(e) => {
                    if (readOnly) return;
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
          </Box>

          <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
            <Field.Root required invalid={!!errors["type"] && touched["type"]}>
              <Field.Label>Type</Field.Label>
              <Input
                placeholder="e.g. Apple"
                value={values.type}
                onChange={(e) => {
                  if (readOnly) return;
                  markTouched("type");
                  setField("type", e.target.value);
                }}
                onBlur={() => validate()}
                readOnly={readOnly}
                disabled={readOnly}
              />
              <Field.ErrorText>{errors["type"]}</Field.ErrorText>
            </Field.Root>
          </Box>

          <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
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
                  if (readOnly) return;
                  markTouched("variety");
                  setField("variety", e.target.value);
                }}
                onBlur={() => validate()}
                readOnly={readOnly}
                disabled={readOnly}
              />
              <Field.ErrorText>{errors["variety"]}</Field.ErrorText>
            </Field.Root>
          </Box>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
            <Field.Root invalid={!!errors["imageUrl"] && touched["imageUrl"]}>
              <Field.Label>Image URL</Field.Label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={values.imageUrl ?? ""}
                onChange={(e) => {
                  if (readOnly) return;
                  markTouched("imageUrl");
                  setField("imageUrl", e.target.value);
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
          </Box>

          <Box bg="bg.panel" p={4} borderRadius="md" borderWidth="1px">
            <Field.Root invalid={!!errors["season"] && touched["season"]}>
              <Field.Label>Season</Field.Label>
              <Input
                placeholder="e.g. Nov–Mar"
                value={(values as any).season ?? ""}
                onChange={(e) => {
                  if (readOnly) return;
                  markTouched("season" as any);
                  setField("season" as any, e.target.value);
                }}
                onBlur={() => validate()}
                readOnly={readOnly}
                disabled={readOnly}
              />
              <Field.ErrorText>{errors["season"]}</Field.ErrorText>
            </Field.Root>

            <Field.Root
              invalid={
                !!errors["caloriesPer100g"] && touched["caloriesPer100g"]
              }
              mt={4}
            >
              <Field.Label>Calories / 100g</Field.Label>
              <NumberInput.Root
                min={0}
                step={1}
                value={
                  values.caloriesPer100g == null
                    ? ""
                    : String(values.caloriesPer100g)
                }
                locale="en-US"
                formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
                onValueChange={({ value, valueAsNumber }) => {
                  if (readOnly) return;
                  markTouched("caloriesPer100g");
                  const next =
                    value === "" || Number.isNaN(valueAsNumber)
                      ? toNumber(value, 0)
                      : Math.trunc(valueAsNumber);
                  setField("caloriesPer100g", next == null ? undefined : next);
                }}
                disabled={readOnly}
              >
                <NumberInput.Input
                  placeholder="e.g. 52"
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
          </Box>
        </SimpleGrid>

        <SellModesSection
          values={values}
          setValues={setValues}
          readOnly={readOnly}
        />

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

        {isProduce ? (
          <>
            <QualityStandardsSection
              value={
                (values as any).qualityStandards as
                  | QualityStandards
                  | undefined
              }
              onChange={(next) => {
                if (readOnly) return;
                setValues((s) => ({ ...(s as any), qualityStandards: next }));
              }}
              readOnly={readOnly}
            />
            <Text fontSize="xs" color="fg.muted">
              {countProduceMetrics(
                (values as any).qualityStandards as QualityStandards | undefined
              )}{" "}
              metric
              {countProduceMetrics(
                (values as any).qualityStandards as QualityStandards | undefined
              ) === 1
                ? ""
                : "s"}{" "}
              set
            </Text>
          </>
        ) : (
          <NonProduceQualitySection
            value={
              (values as any).qualityStandards as
                | NonProduceQuality
                | undefined
            }
            onChange={(next) => {
              if (readOnly) return;
              const cleaned =
                next && next.grade && next.grade.length > 0 ? next : undefined;
              setValues((s) => ({ ...(s as any), qualityStandards: cleaned }));
            }}
            readOnly={readOnly}
          />
        )}

        <ItemsPackingSection
          value={values.packing}
          onChange={(next) => setField("packing", next ?? undefined)}
          readOnly={readOnly}
        />

        {!readOnly && (
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
        )}
      </Stack>
    </form>
  );
}
