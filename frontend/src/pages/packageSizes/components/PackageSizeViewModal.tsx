import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  Flex,
  Heading,
  Text,
  Button,
  Stack,
  Grid,
  GridItem,
  Field,
  Input,
  Switch,
  Separator,
  Card,
  Kbd,
  NumberInput,
} from "@chakra-ui/react";
import type { PackageSize, Container } from "@/types/package-sizes";
import { FiBox } from "react-icons/fi";
type Mode = "package" | "container";

type Props = {
    mode: Mode;
  item: PackageSize | Container | null;
  onClose(): void;
  onSave(idOrKey: string, patch: Partial<PackageSize | Container>): Promise<void> | void;
};

type FormValues = {
   key: string;
  name: string;
  innerDimsCm: { l: number; w: number; h: number };
  headroomPct: number; // package-only
  mixingAllowed: boolean;
  vented: boolean;
  maxSkusPerBox: number; // package-only
  maxWeightKg: number;
  tareWeightKg: number;
  usableLiters?: number;
  notes?: string;
  values?: Record<string, number>;
};

// lightweight volume calc parity with backend rounding
function calcUsableLitersLocal(d: { l: number; w: number; h: number }, headroomPct: number) {
  const liters = (d.l * d.w * d.h * (1 - headroomPct)) / 1000;
  return Number(liters.toFixed(1));
}

export default function PackageSizeViewModal({ mode, item, onClose, onSave }: Props) {
  const open = !!item;

  const start = useMemo<FormValues>(() => {
    if (!item) {
      return {
        key: "",
        name: "",
        innerDimsCm: { l: 1, w: 1, h: 1 },
        headroomPct: 0,
        mixingAllowed: false,
        vented: false,
        maxSkusPerBox: 1,
        maxWeightKg: 1,
        tareWeightKg: 0,
        usableLiters: undefined,
        notes: "",
        values: undefined,
      };
    }
    return {
      key: (item as any).key ?? "",
      name: (item as any).name ?? "",
      innerDimsCm: {
        l: Number((item as any)?.innerDimsCm?.l ?? 1),
        w: Number((item as any)?.innerDimsCm?.w ?? 1),
        h: Number((item as any)?.innerDimsCm?.h ?? 1),
      },
      headroomPct: Number((item as any)?.headroomPct ?? 0),
      mixingAllowed: !!(item as any)?.mixingAllowed,
      vented: !!(item as any)?.vented,
      maxSkusPerBox: Number((item as any)?.maxSkusPerBox ?? 1),
      maxWeightKg: Number((item as any)?.maxWeightKg ?? 1),
      tareWeightKg: Number((item as any)?.tareWeightKg ?? 0),
      usableLiters:
        (item as any)?.usableLiters !== undefined ? Number((item as any).usableLiters) : undefined,
      notes: (item as any)?.notes ?? "",
      values: (item as any)?.values ?? undefined,
    };
  }, [item]);

  const [values, setValues] = useState<FormValues>(start);
  useEffect(() => setValues(start), [start, open]);

  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));
  const setDims = (patch: Partial<FormValues["innerDimsCm"]>) =>
    setValues((v) => ({ ...v, innerDimsCm: { ...v.innerDimsCm, ...patch } }));

  const idOrKey = (item?._id as any) ?? item?.key;

  const computedUsable = useMemo(() => {
    const d = (values.innerDimsCm ?? { l: 0, w: 0, h: 0 }) as { l: number; w: number; h: number };
    if (
      typeof d.l === "number" &&
      typeof d.w === "number" &&
      typeof d.h === "number" &&
      typeof values.headroomPct === "number"
    ) {
      return calcUsableLitersLocal(d, values.headroomPct);
    }
    return undefined;
  }, [values, mode]);
  // SVG refs to focus inputs on side click
  const lRef = useRef<HTMLInputElement>(null);
  const wRef = useRef<HTMLInputElement>(null);
  const hRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!idOrKey) return;
    // Enforce enum for key to satisfy Partial<PackageSize> typing
    const keyTrim = (values.key ?? "").trim();
        if (!keyTrim) return;

if (mode === "package") {
      const allowedKeys = ["Small", "Medium", "Large"] as const;
      if (!allowedKeys.includes(keyTrim as any)) {
        return;
      }
    }
    const patch: any = {
      key: keyTrim,
      name: values.name,
      innerDimsCm: values.innerDimsCm,
      mixingAllowed: values.mixingAllowed,
      vented: values.vented,
      maxWeightKg: values.maxWeightKg,
      tareWeightKg: values.tareWeightKg,
      ...(values.usableLiters !== undefined
        ? { usableLiters: Number(values.usableLiters) }
        : {}),
    };

    if (mode === "package") {
      patch.headroomPct = values.headroomPct;
      patch.maxSkusPerBox = values.maxSkusPerBox;
      patch.notes = values.notes;
      patch.values = values.values;
    }

    await onSave(String(idOrKey), patch as Partial<PackageSize | Container>);
  };

  // normalize to draw proportions
  const dims = (values.innerDimsCm ?? { l: 1, w: 1, h: 1 }) as { l: number; w: number; h: number };
  const maxDim = Math.max(dims.l || 1, dims.w || 1, dims.h || 1);
  const scale = 160 / maxDim; // keep within card size
  const title = mode === "package" ? "Package Details" : "Container Details";

  const keyHelper =
    mode === "package"
      ? "Must be one of: Small, Medium, Large"
      : "Unique key (no strict enum).";


  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content rounded="2xl" p="6" maxW="5xl" w="full">
          <Stack gap="4">
            <Dialog.CloseTrigger />
            <Flex align="center" justify="space-between">
              <Heading size="lg">{title}</Heading>
            </Flex>

            <Grid templateColumns={{ base: "1fr", lg: "1.2fr 1fr" }} gap="6">
              <GridItem>
                <Card.Root rounded="xl" borderWidth="1px" p="4">
                  <Flex align="center" gap="3" mb="3">
                    <FiBox />
                    <Heading size="sm">Interactive Dimensions</Heading>
                  </Flex>

                  {/* SVG: top view (L x W) and side view (H) with clickable edges */}
                  <Flex gap="6" wrap="wrap" align="center" justify="center">
                    <svg width="220" height="220" viewBox="0 0 220 220" aria-label="Top view">
                      {/* Top rectangle (L x W) */}
                      <rect
                        x="30"
                        y="30"
                        width={(dims.l || 1) * scale}
                        height={(dims.w || 1) * scale}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="2"
                        rx="12"
                      />
                      {/* Clickable length edge (top) */}
                      <rect
                        x="30"
                        y="22"
                        width={(dims.l || 1) * scale}
                        height="6"
                        fill="currentColor"
                        opacity="0.08"
                        style={{ cursor: "pointer" }}
                        onClick={() => lRef.current?.focus()}
                      />
                      <text
                        x={30 + ((dims.l || 1) * scale) / 2}
                        y="18"
                        fontSize="10"
                        textAnchor="middle"
                      >
                        Length (L)
                      </text>
                      {/* Clickable width edge (left) */}
                      <rect
                        x="22"
                        y="30"
                        width="6"
                        height={(dims.w || 1) * scale}
                        fill="currentColor"
                        opacity="0.08"
                        style={{ cursor: "pointer" }}
                        onClick={() => wRef.current?.focus()}
                      />
                      <text
                        x="12"
                        y={30 + ((dims.w || 1) * scale) / 2}
                        fontSize="10"
                        textAnchor="middle"
                        transform={`rotate(-90, 12, ${
                          30 + ((dims.w || 1) * scale) / 2
                        })`}
                      >
                        Width (W)
                      </text>
                    </svg>

                    <svg width="220" height="220" viewBox="0 0 220 220" aria-label="Side view">
                      {/* Side rectangle (H x L) */}
                      <rect
                        x="30"
                        y={30 + 160 - (dims.h || 1) * scale}
                        width={(dims.l || 1) * scale}
                        height={(dims.h || 1) * scale}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="2"
                        rx="12"
                      />
                      {/* Clickable height edge (right) */}
                      <rect
                        x={30 + (dims.l || 1) * scale + 2}
                        y={30 + 160 - (dims.h || 1) * scale}
                        width="6"
                        height={(dims.h || 1) * scale}
                        fill="currentColor"
                        opacity="0.08"
                        style={{ cursor: "pointer" }}
                        onClick={() => hRef.current?.focus()}
                      />
                      <text
                        x={30 + (dims.l || 1) * scale + 18}
                        y={
                          30 +
                          160 -
                          (dims.h || 1) * scale +
                          ((dims.h || 1) * scale) / 2
                        }
                        fontSize="10"
                        textAnchor="middle"
                        transform={`rotate(-90, ${
                          30 + (dims.l || 1) * scale + 18
                        }, ${
                          30 +
                          160 -
                          (dims.h || 1) * scale +
                          ((dims.h || 1) * scale) / 2
                        })`}
                      >
                        Height (H)
                      </text>
                    </svg>
                  </Flex>

                  <Separator my="4" />

                  <Grid
                    templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
                    gap="4"
                  >
                    <GridItem>
                      <Field.Root>
                        <Field.Label>Length (cm)</Field.Label>
                        <NumberInput.Root
                          min={1}
                          value={String(values.innerDimsCm.l)}
                          onValueChange={(e) =>
                            setDims({ l: e.value === "" ? 1 : Number(e.value) })
                          }
                        >
                          <NumberInput.Control>
                            <NumberInput.IncrementTrigger />
                            <NumberInput.DecrementTrigger />
                          </NumberInput.Control>
                          <NumberInput.Scrubber />
                          <NumberInput.Input ref={lRef as any} />
                        </NumberInput.Root>
                      </Field.Root>
                    </GridItem>
                    <GridItem>
                      <Field.Root>
                        <Field.Label>Width (cm)</Field.Label>
                        <NumberInput.Root
                          min={1}
                          value={String(values.innerDimsCm.w)}
                          onValueChange={(e) =>
                            setDims({ w: e.value === "" ? 1 : Number(e.value) })
                          }
                        >
                          <NumberInput.Control>
                            <NumberInput.IncrementTrigger />
                            <NumberInput.DecrementTrigger />
                          </NumberInput.Control>
                          <NumberInput.Scrubber />
                          <NumberInput.Input ref={wRef as any} />
                        </NumberInput.Root>
                      </Field.Root>
                    </GridItem>
                    <GridItem>
                      <Field.Root>
                        <Field.Label>Height (cm)</Field.Label>
                        <NumberInput.Root
                          min={1}
                          value={String(values.innerDimsCm.h)}
                          onValueChange={(e) =>
                            setDims({ h: e.value === "" ? 1 : Number(e.value) })
                          }
                        >
                          <NumberInput.Control>
                            <NumberInput.IncrementTrigger />
                            <NumberInput.DecrementTrigger />
                          </NumberInput.Control>
                          <NumberInput.Scrubber />
                          <NumberInput.Input ref={hRef as any} />
                        </NumberInput.Root>
                      </Field.Root>
                    </GridItem>
                  </Grid>

                  <Grid
                    templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
                    gap="4"
                    mt="3"
                  >
                    {mode === "package" && (
                      <GridItem>
                        <Field.Root>
                          <Field.Label>Headroom (%)</Field.Label>
                          <NumberInput.Root
                            min={0}
                            max={90}
                            value={String(
                              Math.round((values.headroomPct ?? 0) * 100)
                            )}
                            onValueChange={(e) =>
                              set({
                                headroomPct:
                                  (e.value === "" ? 0 : Number(e.value)) / 100,
                              })
                            }
                          >
                            <NumberInput.Control>
                              <NumberInput.IncrementTrigger />
                              <NumberInput.DecrementTrigger />
                            </NumberInput.Control>
                            <NumberInput.Scrubber />
                            <NumberInput.Input />
                          </NumberInput.Root>
                        </Field.Root>
                      </GridItem>
                    )}
                    <GridItem>
                      <Field.Root>
                        <Field.Label>Usable Liters (computed)</Field.Label>
                        <Input value={computedUsable ?? ""} readOnly />
                      </Field.Root>
                    </GridItem>
                    <GridItem>
                      <Field.Root>
                        <Field.Label>Override Usable Liters</Field.Label>
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
                          <NumberInput.Control>
                            <NumberInput.IncrementTrigger />
                            <NumberInput.DecrementTrigger />
                          </NumberInput.Control>
                          <NumberInput.Scrubber />
                          <NumberInput.Input />
                        </NumberInput.Root>
                      </Field.Root>
                    </GridItem>
                  </Grid>
                </Card.Root>
              </GridItem>

              <GridItem>
                <Card.Root rounded="xl" borderWidth="1px" p="4">
                  <Heading size="sm" mb="3">
                    Meta & Controls
                  </Heading>

                  <Grid templateColumns={{ base: "1fr" }} gap="4">
                    <Field.Root>
                      <Field.Label>Key</Field.Label>
                      <Input
                        value={values.key ?? ""}
                        onChange={(e) => set({ key: e.target.value })}
                      />
                      <Text color="fg.muted" fontSize="xs" mt="1">
                        {keyHelper}
                      </Text>
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>Name</Field.Label>
                      <Input
                        value={values.name ?? ""}
                        onChange={(e) => set({ name: e.target.value })}
                      />
                    </Field.Root>

                    {mode === "package" && (
                      <Field.Root>
                        <Field.Label>Max SKUs per Box</Field.Label>
                        <NumberInput.Root
                          min={1}
                          value={String(values.maxSkusPerBox)}
                          onValueChange={(e) =>
                            set({ maxSkusPerBox: Number(e.value || 1) })
                          }
                        >
                          <NumberInput.Control>
                            <NumberInput.IncrementTrigger />
                            <NumberInput.DecrementTrigger />
                          </NumberInput.Control>
                          <NumberInput.Scrubber />
                          <NumberInput.Input />
                        </NumberInput.Root>
                      </Field.Root>
                    )}

                    <Field.Root>
                      <Field.Label>Max Weight (kg)</Field.Label>
                      <NumberInput.Root
                        min={0.001}
                        value={String(values.maxWeightKg)}
                        onValueChange={(e) =>
                          set({ maxWeightKg: Number(e.value || 0.001) })
                        }
                      >
                        <NumberInput.Control>
                          <NumberInput.IncrementTrigger />
                          <NumberInput.DecrementTrigger />
                        </NumberInput.Control>
                        <NumberInput.Scrubber />
                        <NumberInput.Input />
                      </NumberInput.Root>
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>Tare Weight (kg)</Field.Label>
                      <NumberInput.Root
                        min={0}
                        value={String(values.tareWeightKg)}
                        onValueChange={(e) =>
                          set({ tareWeightKg: Number(e.value || 0) })
                        }
                      >
                        <NumberInput.Control>
                          <NumberInput.IncrementTrigger />
                          <NumberInput.DecrementTrigger />
                        </NumberInput.Control>
                        <NumberInput.Scrubber />
                        <NumberInput.Input />
                      </NumberInput.Root>
                    </Field.Root>

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

                    <Field.Root>
                      <Field.Label>Vented</Field.Label>
                      <Switch.Root
                        checked={!!values.vented}
                        onCheckedChange={(e) =>
                          set({ vented: !!e.checked })
                        }
                      >
                        <Switch.HiddenInput />
                        <Switch.Control />
                      </Switch.Root>
                    </Field.Root>
                  </Grid>

                  <Separator my="4" />

                  <Flex justify="space-between" align="center">
                    <Text color="fg.muted" fontSize="sm">
                      Tip: Click the rectangle edges to focus dimension inputs.{" "}
                      <Kbd ml="1">Enter</Kbd> to save.
                    </Text>
                    <Stack direction="row" gap="3">
                      <Button variant="subtle" onClick={onClose}>
                        Close
                      </Button>
                      <Button colorPalette="teal" onClick={save}>
                        Save Changes
                      </Button>
                    </Stack>
                  </Flex>
                </Card.Root>
              </GridItem>
            </Grid>
          </Stack>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
