import {
  Box,
  Button,
  Flex,
  Input,
  Stack,
  Field,
  NativeSelect,
} from "@chakra-ui/react";
import { useState } from "react";
import MapPickerDialog from "@/components/common/MapPickerDialog";
import type { LandInput } from "@/api/jobApplications";

type Land = LandInput;
// derive a square from acres so we can send abM/bcM/cdM/daM
const deriveSquareFromAcres = (acres?: number) => {
  if (acres == null || Number.isNaN(acres)) return undefined;
  const areaM2 = acres * 4046.8564224;
  const side = Math.sqrt(areaM2);
  return { abM: side, bcM: side, cdM: side, daM: side, rotationDeg: 0 };
};


export function LandList({ value, onChange }: { value: Land[]; onChange: (lands: Land[]) => void }) {
  const [picker, setPicker] = useState<null | { i: number; field: "pickup" | "loc" }>(null);

const add = () =>
  onChange([
    ...value,
    {
      landName: `Land ${value.length + 1}`,
      ownership: "Owned",
      // start measurements so inputs are controlled
      measurements: { abM: undefined, bcM: undefined, cdM: undefined, daM: undefined, rotationDeg: undefined },
    } as Land,
  ]);



  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const upd = (idx: number, patch: Partial<Land>) =>
    onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const updMeas = (
    idx: number,
    patch: Partial<NonNullable<Land["measurements"]>>
  ) => {
    const curr = value[idx];
    const next = {
      ...curr,
      measurements: { ...(curr.measurements ?? {}), ...patch },
    } as Land;
    onChange(value.map((l, i) => (i === idx ? next : l)));
  };


  return (
    <Stack gap={4}>
      {value.map((land, i) => (
        <Box key={i} p={4} borderWidth="1px" rounded="md">
          <Flex gap={3} wrap="wrap">
            <Field.Root maxW="sm">
              <Field.Label>Custom Name</Field.Label>
              <Input
                value={land.landName ?? ""}
                onChange={(e) => upd(i, { landName: e.target.value })}
              />
            </Field.Root>

            <Field.Root maxW="sm">
              <Field.Label>Ownership</Field.Label>
              <NativeSelect.Root size="sm" width="100%">
                <NativeSelect.Field
                  value={land.ownership}
                    onChange={(e) =>
                      upd(i, { ownership: e.target.value as Land["ownership"] })
                    }
                >
                  <option value="Owned">Owned</option>
                  <option value="Rented">Rented</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Flex gap={3} wrap="wrap">
              {(["abM", "bcM", "cdM", "daM"] as const).map((k) => (
                <Field.Root key={k} maxW="xs">
                  <Field.Label>{k} (m)</Field.Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={(land.measurements as any)?.[k] ?? ""}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "+") e.preventDefault();
                    }}
                    onChange={(e) =>
                      updMeas(i, {
                        [k]: e.target.value === "" ? undefined : Number(e.target.value),
                      } as any)
                    }
                  />
                </Field.Root>
              ))}
            </Flex>

          </Flex>

          <Flex gap={3} mt={3} wrap="wrap">
            <Field.Root flex="1">
              <Field.Label>Pickup Address</Field.Label>
              <Input
                readOnly
                value={land.pickupAddress ?? ""}
                placeholder="Pick on map"
                onClick={() => setPicker({ i, field: "pickup" })}
                cursor="pointer"
              />
            </Field.Root>

            <Field.Root flex="1">
              <Field.Label>Location</Field.Label>
              <Input
                readOnly
                value={land.location ?? ""}
                placeholder="Pick on map"
                onClick={() => setPicker({ i, field: "loc" })}
                cursor="pointer"
              />
            </Field.Root>
          </Flex>

          <Button mt={3} size="sm" variant="outline" colorPalette="red" onClick={() => remove(i)}>
            Delete Land
          </Button>
        </Box>
      ))}

      <Button onClick={add} size="sm" colorPalette="green">Add Land</Button>

      <MapPickerDialog
        open={!!picker}
        onClose={() => setPicker(null)}
        onConfirm={(p) => {
          if (!picker) return;
          const { i, field } = picker;

          // helpful visibility
          console.log("[MapPickerDialog confirm]", { field, address: p.address, lat: p.lat, lng: p.lng });

          if (field === "pickup") {
            // keep existing string fields for UI
            // ALSO store a structured copy that matches backend keys (non-breaking extra)
            upd(i, {
              pickupAddress: p.address,
              pickupLat: p.lat,
              pickupLng: p.lng,
              pickupAddressObj: { alt: p.lat, lnt: p.lng, address: p.address },
            } as any);
          } else {
            upd(i, {
              location: p.address,
              locLat: p.lat,
              locLng: p.lng,
              addressObj: { alt: p.lat, lnt: p.lng, address: p.address },
            } as any);
          }
          setPicker(null);
        }}
      />

    </Stack>
  );
}
