import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  Button,
  Stack,
  Grid,
  GridItem,
  Field,
  Input,
  Textarea,
  Heading,
  Kbd,
  Switch,
  NumberInput,
} from "@chakra-ui/react";
import type { PackageSize, Container } from "@/types/package-sizes";
import { toaster } from "@/components/ui/toaster";

type Mode = "package" | "container";

type Props = {
  open: boolean;
  mode: Mode;
  initial?: Partial<PackageSize | Container> | null;
  onClose(): void;
  onSubmit(values: Partial<PackageSize | Container>): Promise<void> | void;
};

// Local form model to avoid TS errors when backend type lacks fields
type FormValues = {
  key: string;
  name: string;
  innerDimsCm: { l: number; w: number; h: number };
  headroomPct: number; // 0..0.9 (used only in package mode)
  maxSkusPerBox: number; // used only in package mode
  maxWeightKg: number;
  mixingAllowed: boolean;
  tareWeightKg: number;
  vented: boolean;
  usableLiters?: number;
  notes?: string;
  active: boolean;
  values?: Record<string, number>; // package-only
};

const defaults: FormValues = {
  key: "",
  name: "",
  innerDimsCm: { l: 10, w: 10, h: 10 },
  headroomPct: 0.1,
  maxSkusPerBox: 1,
  maxWeightKg: 1,
  mixingAllowed: false,
  tareWeightKg: 0,
  vented: false,
  usableLiters: undefined,
  notes: "",
  active: true,
  values: undefined,
};

export default function PackageSizeForm({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: Props) {
  const start = useMemo<FormValues>(() => {
    const base = { ...defaults };
    if (!initial) return base;
    const anyInit = initial as any;

    return {
      ...base,
      ...anyInit,
      innerDimsCm: {
        l: Number(anyInit?.innerDimsCm?.l ?? base.innerDimsCm.l),
        w: Number(anyInit?.innerDimsCm?.w ?? base.innerDimsCm.w),
        h: Number(anyInit?.innerDimsCm?.h ?? base.innerDimsCm.h),
      },
      headroomPct:
        typeof anyInit?.headroomPct === "number"
          ? anyInit.headroomPct
          : base.headroomPct,
      maxSkusPerBox:
        typeof anyInit?.maxSkusPerBox === "number"
          ? anyInit.maxSkusPerBox
          : base.maxSkusPerBox,
      usableLiters:
        anyInit?.usableLiters !== undefined
          ? Number(anyInit.usableLiters)
          : undefined,
      active: anyInit?.active ?? true,
    };
  }, [initial]);

  const [values, setValues] = useState<FormValues>(start);
  const [loading, setLoading] = useState(false);
  useEffect(() => setValues(start), [start, open]);

  const set = (patch: Partial<FormValues>) =>
    setValues((v) => ({ ...v, ...patch }));
  const setDims = (patch: Partial<FormValues["innerDimsCm"]>) =>
    setValues((v) => ({
      ...v,
      innerDimsCm: { ...v.innerDimsCm, ...patch },
    }));

  const handleSubmit = async () => {
    if (!values.key?.trim() || !values.name?.trim()) {
      toaster.create({ type: "warning", title: "Key and Name are required" });
      return;
    }

    const keyTrim = values.key.trim();

    if (mode === "package") {
      // Enforce backend enum at runtime to satisfy TS union on Partial<PackageSize>["key"]
      const allowedKeys = ["Small", "Medium", "Large"] as const;
      if (!allowedKeys.includes(keyTrim as any)) {
        toaster.create({
          type: "warning",
          title: "Invalid key",
          description: 'Key must be one of: "Small", "Medium", or "Large".',
        });
        return;
      }
    }
    // In container mode: any non-empty key is allowed

    setLoading(true);
    try {
      // Common payload fields
      const payload: any = {
        key: keyTrim,
        name: values.name.trim(),
        innerDimsCm: values.innerDimsCm,
        maxWeightKg: values.maxWeightKg,
        tareWeightKg: values.tareWeightKg,
        mixingAllowed: values.mixingAllowed,
        vented: values.vented,
        usableLiters:
          values.usableLiters !== undefined && values.usableLiters !== null
            ? Number(values.usableLiters)
            : undefined,
        notes: values.notes?.trim() || undefined,
        active: values.active,
      };

      if (mode === "package") {
        // Only package sizes use these
        payload.headroomPct = values.headroomPct;
        payload.maxSkusPerBox = values.maxSkusPerBox;
        payload.values = values.values;
      }
      // Container mode: no headroomPct / maxSkusPerBox / values sent

      await onSubmit(payload as Partial<PackageSize | Container>);
      onClose();
    } catch (e: any) {
      toaster.create({
        type: "error",
        title: "Save failed",
        description: e?.response?.data?.message ?? e?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "package"
      ? (initial as any)?._id
        ? "Edit Package Size"
        : "New Package Size"
      : (initial as any)?._id
      ? "Edit Container"
      : "New Container";

  const keyPlaceholder =
    mode === "package"
      ? 'e.g. "Small", "Medium", "Large"'
      : 'e.g. "LC-Default", "Pallet60x40"';

  const keyHelperText =
    mode === "package"
      ? "Must match allowed keys (Small / Medium / Large)."
      : "Unique key for this container.";

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content rounded="2xl" p="6" w="full" maxW="3xl">
          <Stack gap="4">
            <Dialog.CloseTrigger />
            <Heading size="lg">{title}</Heading>

            <Grid
              templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
              gap="4"
            >
              <GridItem>
                <Field.Root required>
                  <Field.Label>Key</Field.Label>
                  <Input
                    value={values.key}
                    onChange={(e) => set({ key: e.target.value })}
                    placeholder={keyPlaceholder}
                    autoFocus
                  />
                  <Field.HelperText>{keyHelperText}</Field.HelperText>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root required>
                  <Field.Label>Name</Field.Label>
                  <Input
                    value={values.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder={
                      mode === "package"
                        ? "e.g. Small Box"
                        : "e.g. LC Pallet Container"
                    }
                  />
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root required>
                  <Field.Label>Length (cm)</Field.Label>
                  <NumberInput.Root
                    min={1}
                    value={String(values.innerDimsCm.l)}
                    onValueChange={(e) =>
                      setDims({ l: e.value === "" ? 1 : Number(e.value) })
                    }
                  >
                    <NumberInput.Label srOnly>Length</NumberInput.Label>
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                    <NumberInput.Scrubber />
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root required>
                  <Field.Label>Width (cm)</Field.Label>
                  <NumberInput.Root
                    min={1}
                    value={String(values.innerDimsCm.w)}
                    onValueChange={(e) =>
                      setDims({ w: e.value === "" ? 1 : Number(e.value) })
                    }
                  >
                    <NumberInput.Label srOnly>Width</NumberInput.Label>
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                    <NumberInput.Scrubber />
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root required>
                  <Field.Label>Height (cm)</Field.Label>
                  <NumberInput.Root
                    min={1}
                    value={String(values.innerDimsCm.h)}
                    onValueChange={(e) =>
                      setDims({ h: e.value === "" ? 1 : Number(e.value) })
                    }
                  >
                    <NumberInput.Label srOnly>Height</NumberInput.Label>
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                    <NumberInput.Scrubber />
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field.Root>
              </GridItem>

              {mode === "package" && (
                <>
                  <GridItem>
                    <Field.Root required>
                      <Field.Label>Headroom (%)</Field.Label>
                      <NumberInput.Root
                        min={0}
                        max={90}
                        value={String(Math.round(values.headroomPct * 100))}
                        onValueChange={(e) =>
                          set({
                            headroomPct:
                              (e.value === "" ? 0 : Number(e.value)) / 100,
                          })
                        }
                      >
                        <NumberInput.Label srOnly>Headroom</NumberInput.Label>
                        <NumberInput.Control>
                          <NumberInput.IncrementTrigger />
                          <NumberInput.DecrementTrigger />
                        </NumberInput.Control>
                        <NumberInput.Scrubber />
                        <NumberInput.Input />
                      </NumberInput.Root>
                      <Field.HelperText>
                        Reserved headroom percentage (0–90%).
                      </Field.HelperText>
                    </Field.Root>
                  </GridItem>

                  <GridItem>
                    <Field.Root required>
                      <Field.Label>Max SKUs per Box</Field.Label>
                      <NumberInput.Root
                        min={1}
                        value={String(values.maxSkusPerBox)}
                        onValueChange={(e) =>
                          set({ maxSkusPerBox: Number(e.value || 1) })
                        }
                      >
                        <NumberInput.Label srOnly>Max SKUs</NumberInput.Label>
                        <NumberInput.Control>
                          <NumberInput.IncrementTrigger />
                          <NumberInput.DecrementTrigger />
                        </NumberInput.Control>
                        <NumberInput.Scrubber />
                        <NumberInput.Input />
                      </NumberInput.Root>
                    </Field.Root>
                  </GridItem>
                </>
              )}

              <GridItem>
                <Field.Root required>
                  <Field.Label>Max Weight (kg)</Field.Label>
                  <NumberInput.Root
                    min={0.001}
                    value={String(values.maxWeightKg)}
                    onValueChange={(e) =>
                      set({ maxWeightKg: Number(e.value || 0.001) })
                    }
                  >
                    <NumberInput.Label srOnly>Max Weight</NumberInput.Label>
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                    <NumberInput.Scrubber />
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root required>
                  <Field.Label>Tare Weight (kg)</Field.Label>
                  <NumberInput.Root
                    min={0}
                    value={String(values.tareWeightKg)}
                    onValueChange={(e) =>
                      set({ tareWeightKg: Number(e.value || 0) })
                    }
                  >
                    <NumberInput.Label srOnly>Tare Weight</NumberInput.Label>
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                    <NumberInput.Scrubber />
                    <NumberInput.Input />
                  </NumberInput.Root>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root>
                  <Field.Label>Mixing Allowed</Field.Label>
                  <Switch.Root
                    checked={!!values.mixingAllowed}
                    onCheckedChange={(e) =>
                      set({ mixingAllowed: !!e.checked })
                    }
                  >
                    <Switch.HiddenInput />
                    <Switch.Control />
                  </Switch.Root>
                </Field.Root>
              </GridItem>

              <GridItem>
                <Field.Root>
                  <Field.Label>Vented</Field.Label>
                  <Switch.Root
                    checked={!!values.vented}
                    onCheckedChange={(e) => set({ vented: !!e.checked })}
                  >
                    <Switch.HiddenInput />
                    <Switch.Control />
                  </Switch.Root>
                </Field.Root>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 3 }}>
                <Field.Root>
                  <Field.Label>Usable Liters</Field.Label>
                  <NumberInput.Root
                    value={
                      values.usableLiters === undefined
                        ? ""
                        : String(values.usableLiters)
                    }
                    onValueChange={(e) =>
                      set({
                        usableLiters:
                          e.value === "" ? undefined : Number(e.value),
                      })
                    }
                    step={0.1}
                  >
                    <NumberInput.Label srOnly>Usable Liters</NumberInput.Label>
                    <NumberInput.Control>
                      <NumberInput.IncrementTrigger />
                      <NumberInput.DecrementTrigger />
                    </NumberInput.Control>
                    <NumberInput.Scrubber />
                    <NumberInput.Input />
                  </NumberInput.Root>
                  <Field.HelperText>
                    Backend recalculates on save; optional override.
                  </Field.HelperText>
                </Field.Root>
              </GridItem>

              <GridItem colSpan={{ base: 1, md: 3 }}>
                <Field.Root>
                  <Field.Label>Notes</Field.Label>
                  <Textarea
                    value={values.notes ?? ""}
                    onChange={(e) => set({ notes: e.target.value })}
                    placeholder="Optional notes…"
                    rows={3}
                  />
                </Field.Root>
              </GridItem>
            </Grid>

            <Stack direction="row" justify="flex-end" gap="3" mt="2">
              <Button variant="subtle" onClick={onClose}>
                Cancel <Kbd ml="2">Esc</Kbd>
              </Button>
              <Button
                colorPalette="teal"
                loading={loading}
                onClick={handleSubmit}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
