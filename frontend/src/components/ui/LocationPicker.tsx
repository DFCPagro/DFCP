// src/components/ui/LocationPicker.tsx
import {
  HStack,
  Field,
  Button,
  Badge,
  Text,
} from "@chakra-ui/react";
import type { Address } from "@/types/address";

export interface LocationPickerProps {
  locations: Address[];
  value?: string; // use address as the key
  onChange?: (address?: string) => void;
  onOpenMap?: () => void;
}

export default function LocationPicker({
  locations,
  value,
  onChange,
  onOpenMap,
}: LocationPickerProps) {
  const selected = locations.find((l) => l.address === value);
console.log("LocationPicker selected:", selected);
  return (
    <HStack gap={3} align="end" flexWrap="wrap">
      <Field.Root>
        <Field.Label htmlFor="location-select">Saved locations</Field.Label>
        <select
          id="location-select"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value || undefined)}
          aria-label="Saved locations"
          style={{
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1px solid var(--chakra-colors-gray-300, rgba(0,0,0,0.12))",
            minWidth: 280,
            background: "var(--chakra-colors-white, #fff)",
          }}
        >
          <option value="">
            {locations.length ? "Choose saved address" : "No saved addresses"}
          </option>
          {locations.map((l) => (
            <option key={l.address} value={l.address}>
              {l.address}
            </option>
          ))}
        </select>
      </Field.Root>

      <Button type="button" onClick={onOpenMap} variant="outline">
        {selected ? "Change delivery location" : "Pick delivery location"}
      </Button>

      {selected && (
        <Badge colorPalette="green" variant="surface" title={selected.address}>
          <Text maxW="36ch" >
            {selected.address}
          </Text>
        </Badge>
      )}
    </HStack>
  );
}
