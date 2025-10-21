// src/pages/FarmerCropManagement/components/AddCropDrawer.tsx
import {
  Badge,
  Box,
  Button,
  CloseButton,
  Drawer,
  Field,
  HStack,
  Input,
  NativeSelect,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toISODate, isISODateString } from "@/utils/date";
import { fmtGrams } from "@/utils/format";
import type { CreateCropInput } from "@/types/agri";
import useCropCatalog from "../hooks/useCropCatalog";
import useCreateCrop from "../hooks/useCreateCrop";

export type AddCropDrawerProps = {
  /** Controls drawer visibility */
  isOpen: boolean;
  /** Called when the drawer requests to close (Cancel, backdrop, X…) */
  onClose: () => void;
  /** Current land & section context */
  landId: string | null | undefined;
  sectionId: string | null | undefined;
};

type Errors = Partial<Record<keyof CreateCropInput | "form", string>>;
type FieldKey =
  | "itemId"
  | "plantedAmountGrams"
  | "avgRatePerUnit"
  | "expectedFruitingPerPlant"
  | "plantedOnDate"
  | "expectedHarvestDate";

type FieldSpec = {
  key: FieldKey;
  label: string;
  type: "select" | "number" | "date";
  required?: boolean;
  placeholder?: string;
  /** getter / setter for controlled value (string) */
  get: () => string;
  set: (v: string) => void;
  /** optional helper text under the field */
  helperText?: string | null;
};

export default function AddCropDrawer({
  isOpen,
  onClose,
  landId,
  sectionId,
}: AddCropDrawerProps) {
  // catalog for Select Crop
  const { catalog, isLoading: isCatalogLoading } = useCropCatalog();

  // mutation
  const { createCrop, isPending, error: submitErr, reset } = useCreateCrop(
    sectionId ?? null,
    landId ?? null
  );

  // form refs / state
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);

  const [itemId, setItemId] = useState<string>("");
  const [plantedAmountGrams, setPlantedAmountGrams] = useState<string>("");
  const [avgRatePerUnit, setAvgRatePerUnit] = useState<string>("");
  const [expectedFruitingPerPlant, setExpectedFruitingPerPlant] = useState<string>("");
  const [plantedOnDate, setPlantedOnDate] = useState<string>("");
  const [expectedHarvestDate, setExpectedHarvestDate] = useState<string>("");

  // WIP section layout (non-functional for now)
  const [xCells, setXCells] = useState<string>("10");
  const [yCells, setYCells] = useState<string>("6");

  const [errors, setErrors] = useState<Errors>({});

  // Reset form when the drawer opens
  useEffect(() => {
    if (isOpen) {
      reset();
      setErrors({});
      setItemId("");
      setPlantedAmountGrams("");
      setAvgRatePerUnit("");
      setExpectedFruitingPerPlant("");
      // Prefill planted date as today for convenience
      setPlantedOnDate(toISODate(new Date()));
      setExpectedHarvestDate("");

      // WIP layout defaults
      setXCells("10");
      setYCells("6");
    }
  }, [isOpen, reset]);

  const isDisabled = !sectionId || !landId || isCatalogLoading || isPending;

  // Build payload + validate
  const payload = useMemo<CreateCropInput | null>(() => {
    const n = (v: string) => (v.trim() === "" ? null : Number(v));
    const planted = n(plantedAmountGrams);
    const avg = n(avgRatePerUnit);
    const fruit = n(expectedFruitingPerPlant);

    if (planted !== null && !Number.isFinite(planted)) return null;
    if (avg !== null && !Number.isFinite(avg)) return null;
    if (fruit !== null && !Number.isFinite(fruit)) return null;

    return {
      itemId,
      plantedAmountGrams: planted ?? 0,
      avgRatePerUnit: avg,
      expectedFruitingPerPlant: fruit,
      plantedOnDate: plantedOnDate || null,
      expectedHarvestDate: expectedHarvestDate || null,
    };
  }, [itemId, plantedAmountGrams, avgRatePerUnit, expectedFruitingPerPlant, plantedOnDate, expectedHarvestDate]);

  function validate(): Errors {
    const e: Errors = {};
    if (!itemId) e.itemId = "Please select a crop.";
    const planted = Number(plantedAmountGrams);
    if (!Number.isFinite(planted) || planted <= 0) e.plantedAmountGrams = "Enter a value > 0.";
    if (plantedOnDate && !isISODateString(plantedOnDate)) e.plantedOnDate = "Invalid date.";
    if (expectedHarvestDate && !isISODateString(expectedHarvestDate)) e.expectedHarvestDate = "Invalid date.";
    if (plantedOnDate && expectedHarvestDate) {
      const start = new Date(plantedOnDate).getTime();
      const end = new Date(expectedHarvestDate).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        e.expectedHarvestDate = "Harvest date must be after planted date.";
      }
    }
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0 || !payload) return;

    try {
      await createCrop(payload);
      onClose();
    } catch {
      // mutation already exposes error; we show it next to submit
    }
  }

  /** -------------------------
   * Config-driven field list
   * ------------------------*/
  const FIELD_SPECS: FieldSpec[] = [
    {
      key: "itemId",
      label: "Crop *",
      type: "select",
      required: true,
      get: () => itemId,
      set: setItemId,
    },
    {
      key: "plantedAmountGrams",
      label: "Planted Amount (g) *",
      type: "number",
      required: true,
      placeholder: "e.g., 120000",
      get: () => plantedAmountGrams,
      set: setPlantedAmountGrams,
      helperText: fmtGrams(Number(plantedAmountGrams) || 0),
    },
    {
      key: "avgRatePerUnit",
      label: "Average Rate per Plant (g)",
      type: "number",
      placeholder: "Optional",
      get: () => avgRatePerUnit,
      set: setAvgRatePerUnit,
    },
    {
      key: "expectedFruitingPerPlant",
      label: "Expected Fruiting per Plant",
      type: "number",
      placeholder: "Optional",
      get: () => expectedFruitingPerPlant,
      set: setExpectedFruitingPerPlant,
    },
  ];

  const DATE_FIELDS: FieldSpec[] = [
    {
      key: "plantedOnDate",
      label: "Planted On",
      type: "date",
      get: () => plantedOnDate,
      set: setPlantedOnDate,
    },
    {
      key: "expectedHarvestDate",
      label: "Expected Harvest Date",
      type: "date",
      get: () => expectedHarvestDate,
      set: setExpectedHarvestDate,
    },
  ];

  function renderField(spec: FieldSpec) {
    const err = errors[spec.key];

    if (spec.type === "select") {
      return (
        <Field.Root key={spec.key} required={!!spec.required} invalid={!!err}>
          <Field.Label>{spec.label}</Field.Label>

          <NativeSelect.Root disabled={isDisabled}>
            <NativeSelect.Field
              ref={firstFieldRef}
              value={spec.get()}
              onChange={(e) => spec.set(e.currentTarget.value)}
            >
              <option value="">Select a crop...</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>

          {err ? <Field.ErrorText>{err}</Field.ErrorText> : null}
        </Field.Root>
      );
    }

    return (
      <Field.Root key={spec.key} required={!!spec.required} invalid={!!err}>
        <Field.Label>{spec.label}</Field.Label>
        <Input
          type={spec.type === "number" ? "number" : "date"}
          inputMode={spec.type === "number" ? "decimal" : undefined}
          min={spec.type === "number" ? "0" : undefined}
          step={spec.type === "number" ? "1" : undefined}
          placeholder={spec.placeholder}
          value={spec.get()}
          onChange={(e) => spec.set(e.currentTarget.value)}
          disabled={isDisabled}
        />
        {spec.helperText ? <Field.HelperText>{spec.helperText}</Field.HelperText> : null}
        {err ? <Field.ErrorText>{err}</Field.ErrorText> : null}
      </Field.Root>
    );
  }

  // WIP matrix grid
  const xCount = Math.max(1, Math.min(50, Number(xCells) || 0));
  const yCount = Math.max(1, Math.min(50, Number(yCells) || 0));
  const matrixCells = Array.from({ length: xCount * yCount }, (_, i) => i);

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      size={{ base: "full", md: "md" }}
      placement={{ base: "bottom", md: "end" }}
      initialFocusEl={() => firstFieldRef.current}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content roundedTop={{ base: "l3", md: undefined }}>
            <Drawer.Header>
              <Drawer.Title>Add Crop</Drawer.Title>
              <Text color="fg.muted" fontSize="sm">
                Add a crop to the selected section. Required fields are marked *.
              </Text>
            </Drawer.Header>

            <Drawer.Body>
              <Stack gap="4">
                {/* Config-driven fields */}
                {FIELD_SPECS.map(renderField)}

                {/* Dates side-by-side */}
                <HStack gap="4">
                  {DATE_FIELDS.map((spec) => (
                    <Box key={spec.key} flex="1">
                      {renderField(spec)}
                    </Box>
                  ))}
                </HStack>

                {/* WIP: Section layout */}
                <Box
                  borderWidth="1px"
                  rounded="l3"
                  p="4"
                  bg="gray.50"
                  _dark={{ bg: "gray.800", borderColor: "gray.700" }}
                >
                  <HStack justify="space-between" mb="3">
                    <Text fontWeight="semibold">Section layout (WIP)</Text>
                    <Badge colorPalette="yellow">WIP</Badge>
                  </HStack>

                  <HStack align="start" gap="4">
                    <Box flex="1" overflow="hidden">
                      <Box
                        display="grid"
                        gridTemplateColumns={`repeat(${xCount}, 1fr)`}
                        gap="1"
                        height="180px"
                      >
                        {matrixCells.map((i) => (
                          <Box
                            key={i}
                            rounded="sm"
                            bg={i % 7 === 0 ? "green.300" : "gray.200"}
                            _dark={{ bg: i % 7 === 0 ? "green.700" : "gray.700" }}
                          />
                        ))}
                      </Box>
                    </Box>

                    <Stack w="220px" gap="3">
                      <Field.Root>
                        <Field.Label>X</Field.Label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          step="1"
                          value={xCells}
                          onChange={(e) => setXCells(e.currentTarget.value)}
                          disabled={isDisabled}
                        />
                        <Field.HelperText>Columns</Field.HelperText>
                      </Field.Root>

                      <Field.Root>
                        <Field.Label>Y</Field.Label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          step="1"
                          value={yCells}
                          onChange={(e) => setYCells(e.currentTarget.value)}
                          disabled={isDisabled}
                        />
                        <Field.HelperText>Rows</Field.HelperText>
                      </Field.Root>
                    </Stack>
                  </HStack>
                </Box>

                {/* Global error (mutation) */}
                {submitErr ? (
                  <Text color="red.500" fontSize="sm">
                    {String((submitErr as any)?.message || "Failed to create crop.")}
                  </Text>
                ) : null}
              </Stack>
            </Drawer.Body>

            <Drawer.Footer>
              <HStack gap="3">
                <Drawer.ActionTrigger asChild>
                  <Button variant="outline" onClick={onClose} disabled={isPending}>
                    Cancel
                  </Button>
                </Drawer.ActionTrigger>
                <Button onClick={handleSubmit} disabled={isDisabled} loading={isPending}>
                  Add Crop
                </Button>
              </HStack>
            </Drawer.Footer>

            <Drawer.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
