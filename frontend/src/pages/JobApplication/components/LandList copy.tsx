import { useMemo, useState, forwardRef, useImperativeHandle } from "react"
import {
  Box,
  Card,
  Field,
  Float,
  Heading,
  Icon,
  IconButton,
  Input,
  NativeSelect,
  SimpleGrid,
  Stack,
  VisuallyHidden,
  createListCollection,
} from "@chakra-ui/react"
import { Plus, Square, Trash2 } from "lucide-react"
import MapPickerDialog from "@/components/common/MapPickerDialog"
import type { LandInput } from "@/types/availableJobs"
import { LandMeasurementsEditor } from "./LandMeasurementsEditor"

type Props = {
  value: LandInput[]
  onChange: (next: LandInput[]) => void
}

/** Exposes imperative actions so a parent can trigger "Add land" via ref. */
export type LandListHandle = {
  addLand: () => void
}

export const LandList = forwardRef<LandListHandle, Props>(function LandList(
  { value, onChange }: Props,
  ref
) {
  const [picker, setPicker] = useState<null | { i: number; field: "pickup" | "loc" }>(null)

  const addLand = () =>
    onChange([
      ...value,
      {
        landName: `Land ${value.length + 1}`,
        ownership: "Owned",
        measurements: { abM: 50, bcM: 40, cdM: 50, daM: 40, rotationDeg: 0 },
      } as LandInput,
    ])

  useImperativeHandle(ref, () => ({ addLand }), [value, onChange])

  const removeLand = (idx: number) => onChange(value.filter((_, i) => i !== idx))
  const upd = (idx: number, patch: Partial<LandInput>) =>
    onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  const updMeas = (idx: number, next: NonNullable<LandInput["measurements"]>) =>
    onChange(value.map((l, i) => (i === idx ? { ...l, measurements: next } : l)))

  const ownershipOptions = useMemo(
    () =>
      createListCollection({
        items: [
          { label: "Owned", value: "Owned" },
          { label: "Rented", value: "Rented" },
        ],
      }),
    []
  )

  return (
    <Stack gap={5}>
      {/* Button removed from here. Control via ref: ref.current?.addLand() */}
      {/* Example (outside this component):
          const landRef = useRef<LandListHandle>(null)
          <StyledIconButton onClick={() => landRef.current?.addLand()}>Add land</StyledIconButton>
          <LandList ref={landRef} ... />
      */}

      {value.length === 0 && (
        <Box borderWidth="1px" borderRadius="xl" p="4" textAlign="center" color="fg.muted">
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
                      upd(i, { ownership: e.target.value as LandInput["ownership"] })
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

              <Box display="flex" justifyContent={{ base: "stretch", md: "flex-end" }}>
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

            {/* Measurements via inputs + visual preview with active-side highlight */}
            <LandMeasurementsEditor
              value={land.measurements ?? undefined}
              onChange={(next) => updMeas(i, next)}
            />

            {/* Map pickers */}
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
          if (!picker) return
          const { i, field } = picker
          if (field === "pickup") {
            upd(i, {
              pickupAddress: p.address,
              pickupLat: p.lat,
              pickupLng: p.lng,
              pickupAddressObj: { alt: p.lat, lnt: p.lng, address: p.address },
            } as any)
          } else {
            upd(i, {
              location: p.address,
              locLat: p.lat,
              locLng: p.lng,
              addressObj: { alt: p.lat, lnt: p.lng, address: p.address },
            } as any)
          }
          setPicker(null)
        }}
      />
    </Stack>
  )
})
