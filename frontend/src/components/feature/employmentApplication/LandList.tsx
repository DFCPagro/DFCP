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
import type { LandInput } from "@/api/applications";

type Land = LandInput;

export function LandList({ value, onChange }: { value: Land[]; onChange: (lands: Land[]) => void }) {
  const [picker, setPicker] = useState<null | { i: number; field: "pickup" | "loc" }>(null);

  const add = () =>
    onChange([...value, { landName: `Land ${value.length + 1}`, ownership: "Owned" }]);

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const upd = (idx: number, patch: Partial<Land>) =>
    onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  return (
    <Stack gap={4}>
      {value.map((land, i) => (
        <Box key={i} p={4} borderWidth="1px" rounded="md">
          <Flex gap={3} wrap="wrap">
            <Field.Root maxW="sm">
              <Field.Label>Custom Name</Field.Label>
              <Input value={land.landName ?? ""} onChange={(e) => upd(i, { landName: e.target.value })} />
            </Field.Root>

            <Field.Root maxW="sm">
              <Field.Label>Ownership</Field.Label>
              <NativeSelect.Root size="sm" width="100%">
                <NativeSelect.Field
                  value={land.ownership}
                  onChange={(e) => upd(i, { ownership: e.target.value as Land["ownership"] })}
                >
                  <option value="Owned">Owned</option>
                  <option value="Rented">Rented</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>

            <Field.Root maxW="sm">
              <Field.Label>Acres</Field.Label>
              <Input
                type="number"
                step="any"
                value={land.acres ?? ""}
                onChange={(e) => upd(i, { acres: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </Field.Root>
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
          if (field === "pickup") {
            upd(i, { pickupAddress: p.address, pickupLat: p.lat, pickupLng: p.lng });
          } else {
            upd(i, { location: p.address, locLat: p.lat, locLng: p.lng });
          }
          setPicker(null);
        }}
      />
    </Stack>
  );
}
