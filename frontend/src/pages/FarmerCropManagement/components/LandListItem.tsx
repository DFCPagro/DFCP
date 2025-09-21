// src/pages/FarmerCropManagement/components/LandListItem.tsx
import { Badge, HStack, Stack, Text, chakra } from "@chakra-ui/react";
import { FiClock } from "react-icons/fi";
import type { LandDTO } from "@/types/agri";

export type LandListItemProps = {
  land: LandDTO;
  selected?: boolean;
  onSelect?: (landId: string) => void;
  disabled?: boolean;
};

/** Days since an ISO timestamp (integer, clamped to >= 0). */
function daysSince(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - t;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/** Tiered label: today → days → weeks → months (no mixing). With color bucket. */
function recencyLabelAndColor(
  iso: string
): { label: string; color: "green" | "yellow" | "red"; days: number } {
  const d = daysSince(iso);

  let label = "today";
  if (d === 0) {
    label = "today";
  } else if (d < 7) {
    label = d === 1 ? "1 day ago" : `${d} days ago`;
  } else if (d < 30) {
    const w = Math.floor(d / 7);
    label = w === 1 ? "1 week ago" : `${w} weeks ago`;
  } else {
    const m = Math.floor(d / 30);
    label = m === 1 ? "1 month ago" : `${m} months ago`;
  }

  const color: "green" | "yellow" | "red" = d <= 2 ? "green" : d <= 6 ? "yellow" : "red";
  return { label, color, days: d };
}

const LandButton = chakra("button");

export default function LandListItem({
  land,
  selected = false,
  onSelect,
  disabled = false,
}: LandListItemProps) {
  const { label, color } = recencyLabelAndColor(land.updatedAt);

  return (
    <LandButton
      type="button"
      w="full"
      textAlign="left"
      px="3"
      py="2.5"
      rounded="l2"
      borderWidth={selected ? "2px" : "1px"}
      borderColor={selected ? "blue.500" : "gray.200"}
      bg={selected ? "blue.50" : "bg"}
      _dark={{
        borderColor: selected ? "blue.400" : "gray.700",
        bg: selected ? "blue.900/20" : "bg",
      }}
      cursor={disabled ? "not-allowed" : "pointer"}
      opacity={disabled ? 0.6 : 1}
      pointerEvents={disabled ? "none" : "auto"}
      _hover={
        disabled
          ? undefined
          : {
            bg: selected ? "blue.100" : "gray.50",
            _dark: { bg: selected ? "blue.800/30" : "gray.800" },
          }
      }
      aria-pressed={selected}
      aria-disabled={disabled}
      data-selected={selected ? "" : undefined}
      onClick={() => {
        if (!disabled) onSelect?.(land.id);
      }}
    >
      <HStack justify="space-between" align="center" gap="3">
        <Stack gap="0">
          <Text fontWeight="semibold">{land.name}</Text>
          <Text fontSize="xs" color="fg.muted">
            {new Intl.NumberFormat().format(land.areaM2)} m² • {land.sectionsCount}{" "}
            {land.sectionsCount === 1 ? "section" : "sections"}
          </Text>
        </Stack>

        <HStack gap="1.5">
          <FiClock aria-hidden />
          <Badge colorPalette={color}>{label}</Badge>
        </HStack>
      </HStack>
    </LandButton>
  );
}
