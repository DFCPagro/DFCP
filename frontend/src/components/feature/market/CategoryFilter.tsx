import { HStack } from "@chakra-ui/react";
import { StyledButton } from "@/components/ui/Button";


export type CatCode = "ALL" | "fruit" | "vegetable" | "eggs" | "dairy";

const CATS: { code: CatCode; label: string }[] = [
  { code: "ALL", label: "All" },
  { code: "vegetable", label: "Vegetables" },
  { code: "fruit", label: "Fruits" },
  { code: "eggs", label: "Eggs" },
  { code: "dairy", label: "Milk & Cheese" },
];

export default function CategoryFilter({
  value,
  onChange,
}: {
  value: CatCode;
  onChange: (v: CatCode) => void;
}) {
  const selected = String(value || "ALL").toLowerCase();
  return (
    <HStack wrap="wrap" gap="2">
      {CATS.map(({ code, label }) => {
        const isActive =
          selected === "all" ? code === "ALL" : selected === String(code).toLowerCase();
        return (
          <StyledButton
            key={code}
            visual="solid"
            size="sm"
            variant={isActive ? "solid" : "outline"}
            colorPalette="teal"
            onClick={() => onChange(code)}
            aria-pressed={isActive}
          >
            {label}
          </StyledButton>
        );
      })}
    </HStack>
  );
}
