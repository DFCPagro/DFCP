"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  Field,
  Icon,
  IconButton,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  VisuallyHidden,
  createListCollection,
} from "@chakra-ui/react";
import { Trash2 } from "lucide-react";
import MapPickerDialog from "@/components/common/MapPickerDialog";
import type { LandInput } from "@/types/availableJobs";
import { LandShapeMapper } from "./LandShapeMapper";

type Props = {
  value: LandInput[];
  onChange: (next: LandInput[]) => void;
  /** Optional: a button ref whose click will trigger addLand() */
  addButtonRef?: React.RefObject<HTMLElement | null>;
};

export function LandList({ value, onChange, addButtonRef }: Props) {
  const [picker, setPicker] = useState<null | {
    i: number;
    field: "pickup" | "loc";
  }>(null);

  const addLand = useCallback(() => {
    onChange([
      ...value,
      {
        landName: `Land ${value.length + 1}`,
        ownership: "Owned",
        measurements: {
          abM: 120,
          bcM: 100,
          cdM: 120,
          daM: 100,
          rotationDeg: 0,
        },
      } as LandInput,
    ]);
  }, [value, onChange]);

  // If a button ref is provided, clicking it will add a land
  useEffect(() => {
    const el = addButtonRef?.current ?? null;
    if (!el) return;
    const handler = (e: Event) => {
      e.preventDefault();
      addLand();
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [addButtonRef, addLand]);

  const removeLand = (idx: number) =>
    onChange(value.filter((_, i) => i !== idx));
  const upd = (idx: number, patch: Partial<LandInput>) =>
    onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const updMeas = (idx: number, next: NonNullable<LandInput["measurements"]>) =>
    onChange(
      value.map((l, i) => (i === idx ? { ...l, measurements: next } : l))
    );

  const ownershipOptions = useMemo(
    () =>
      createListCollection({
        items: [
          { label: "Owned", value: "Owned" },
          { label: "Rented", value: "Rented" },
        ],
      }),
    []
  );

  return (
    <Stack gap={5}>
      {value.length === 0 && (
        <Box
          borderWidth="1px"
          borderRadius="xl"
          p="4"
          textAlign="center"
          color="fg.muted"
        >
          No lands yet. Click “Add land” to define your first plot.
        </Box>
      )}

      {value.map((land, i) => (
        <Card.Root key={i} borderRadius="2xl">
          <Card.Body gap="4">
            <SimpleGrid columns={{ base: 1, md: 3 }} gap="4" alignItems="start">
              <Field.Root>
                <Field.Label>Custom name</Field.Label>
                <Input
                  value={land.landName ?? ""}
                  onChange={(e) => upd(i, { landName: e.target.value })}
                  placeholder="e.g., North Field"
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>Ownership</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field
                    value={land.ownership}
                    onChange={(e) =>
                      upd(i, {
                        ownership: e.target.value as LandInput["ownership"],
                      })
                    }
                  >
                    {ownershipOptions.items.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>

              <Box
                display="flex"
                justifyContent={{ base: "stretch", md: "flex-end" }}
              >
                <IconButton
                  aria-label="Remove land"
                  variant="outline"
                  colorPalette="red"
                  onClick={() => removeLand(i)}
                >
                  <Icon as={Trash2} />
                  <VisuallyHidden>Remove land</VisuallyHidden>
                </IconButton>
              </Box>
            </SimpleGrid>

            {/* NEW: Interactive land shape mapper (draggable A–D points) */}
            <LandShapeMapper
              value={land.measurements ?? undefined}
              onChange={(next) => updMeas(i, next)}
              editable={false}
            />

            <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
              <Field.Root>
                <Field.Label>Pickup address</Field.Label>
                <Input
                  readOnly
                  value={land.pickupAddress ?? ""}
                  placeholder="Pick on map"
                  onClick={() => setPicker({ i, field: "pickup" })}
                  cursor="pointer"
                />
              </Field.Root>

              <Field.Root>
                <Field.Label>Location</Field.Label>
                <Input
                  readOnly
                  value={land.location ?? ""}
                  placeholder="Pick on map"
                  onClick={() => setPicker({ i, field: "loc" })}
                  cursor="pointer"
                />
              </Field.Root>
            </SimpleGrid>
          </Card.Body>
        </Card.Root>
      ))}

      <MapPickerDialog
        open={!!picker}
        onClose={() => setPicker(null)}
        onConfirm={(p) => {
          if (!picker) return;
          const { i, field } = picker;
          if (field === "pickup") {
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
