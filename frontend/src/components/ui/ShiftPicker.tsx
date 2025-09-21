// src/components/ui/ShiftPicker.tsx
import { HStack, Button, Badge } from "@chakra-ui/react";
import type { ShiftName } from "@/types/market";

export interface ShiftPickerProps {
  value?: ShiftName;
  available?: ShiftName[];
  onChange?: (shift?: ShiftName) => void;
}

const shifts: { key: ShiftName; label: string }[] = [
  { key: "morning", label: "Morning (6:00–12:00)" },
  { key: "afternoon", label: "Afternoon (12:00–16:00)" },
  { key: "evening", label: "Evening (16:00–22:00)" },
  { key: "night", label: "Night (22:00–6:00)" },
];

export default function ShiftPicker({ value, available = [], onChange }: ShiftPickerProps) {
  return (
    <HStack gap={2} flexWrap="wrap">
      {shifts.map((s) => {
        const isAvailable = available.includes(s.key);
        const isSelected = value === s.key;

        return (
          <Button
            key={s.key}
            size="sm"
            variant={isSelected ? "solid" : "outline"}
            colorScheme={isAvailable ? "blue" : "gray"}
            disabled={!isAvailable}
            onClick={() => onChange?.(s.key)}
          >
            {s.label}
            {isSelected && <Badge ml={2} colorScheme="green">Selected</Badge>}
          </Button>
        );
      })}
    </HStack>
  );
}
