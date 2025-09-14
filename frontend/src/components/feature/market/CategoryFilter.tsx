import { HStack, Button } from "@chakra-ui/react";
import type { CategoryCode } from "@/types/market";

const CATS: { value: CategoryCode | "ALL"; label: string }[] = [
  { value: "ALL",        label: "All" },
  { value: "VEGETABLES", label: "Vegetables" },
  { value: "FRUITS",     label: "Fruits" },
  { value: "EGGS",       label: "Eggs" },
  { value: "DAIRY",      label: "Milk & Cheese" },
];

export default function CategoryFilter({
  value,
  onChange,
}: {
  value: CategoryCode | "ALL";
  onChange: (v: CategoryCode | "ALL") => void;
}) {
  return (
    <HStack wrap="wrap" gap="2">
      {CATS.map((c) => (
        <Button
          key={c.value}
          size="sm"
          variant={value === c.value ? "solid" : "outline"}
          colorPalette="teal"
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </Button>
      ))}
    </HStack>
  );
}
