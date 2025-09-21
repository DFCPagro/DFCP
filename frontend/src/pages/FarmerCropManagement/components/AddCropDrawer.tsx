// src/pages/FarmerCropManagement/components/AddCropDrawer.tsx
import {
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
                {/* Select Crop */}
                <Field.Root required invalid={!!errors.itemId}>
                    <Field.Label>Crop *</Field.Label>

                    {/* move disabled here */}
                    <NativeSelect.Root disabled={isDisabled}>
                        <NativeSelect.Field
                        ref={firstFieldRef}
                        value={itemId}
                        onChange={(e) => setItemId(e.currentTarget.value)}
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

                {errors.itemId ? <Field.ErrorText>{errors.itemId}</Field.ErrorText> : null}
                </Field.Root>



                {/* Planted Amount (g) */}
                <Field.Root required invalid={!!errors.plantedAmountGrams}>
                  <Field.Label>Planted Amount (g) *</Field.Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    placeholder="e.g., 120000"
                    value={plantedAmountGrams}
                    onChange={(e) => setPlantedAmountGrams(e.currentTarget.value)}
                    disabled={isDisabled}
                  />
                  <Field.HelperText>{fmtGrams(Number(plantedAmountGrams) || 0)}</Field.HelperText>
                  {errors.plantedAmountGrams ? (
                    <Field.ErrorText>{errors.plantedAmountGrams}</Field.ErrorText>
                  ) : null}
                </Field.Root>

                {/* Average Rate per Plant (g) */}
                <Field.Root invalid={!!errors.avgRatePerUnit}>
                  <Field.Label>Average Rate per Plant (g)</Field.Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    placeholder="Optional"
                    value={avgRatePerUnit}
                    onChange={(e) => setAvgRatePerUnit(e.currentTarget.value)}
                    disabled={isDisabled}
                  />
                  {errors.avgRatePerUnit ? (
                    <Field.ErrorText>{errors.avgRatePerUnit}</Field.ErrorText>
                  ) : null}
                </Field.Root>

                {/* Expected Fruiting per Plant */}
                <Field.Root invalid={!!errors.expectedFruitingPerPlant}>
                  <Field.Label>Expected Fruiting per Plant</Field.Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    placeholder="Optional"
                    value={expectedFruitingPerPlant}
                    onChange={(e) => setExpectedFruitingPerPlant(e.currentTarget.value)}
                    disabled={isDisabled}
                  />
                  {errors.expectedFruitingPerPlant ? (
                    <Field.ErrorText>{errors.expectedFruitingPerPlant}</Field.ErrorText>
                  ) : null}
                </Field.Root>

                {/* Dates */}
                <HStack gap="4">
                  <Field.Root flex="1" invalid={!!errors.plantedOnDate}>
                    <Field.Label>Planted On</Field.Label>
                    <Input
                      type="date"
                      value={plantedOnDate}
                      onChange={(e) => setPlantedOnDate(e.currentTarget.value)}
                      disabled={isDisabled}
                    />
                    {errors.plantedOnDate ? (
                      <Field.ErrorText>{errors.plantedOnDate}</Field.ErrorText>
                    ) : null}
                  </Field.Root>

                  <Field.Root flex="1" invalid={!!errors.expectedHarvestDate}>
                    <Field.Label>Expected Harvest Date</Field.Label>
                    <Input
                      type="date"
                      value={expectedHarvestDate}
                      onChange={(e) => setExpectedHarvestDate(e.currentTarget.value)}
                      disabled={isDisabled}
                    />
                    {errors.expectedHarvestDate ? (
                      <Field.ErrorText>{errors.expectedHarvestDate}</Field.ErrorText>
                    ) : null}
                  </Field.Root>
                </HStack>

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
