// src/pages/AdminExpectedHarvest/components/FilterBar.tsx
import { memo } from "react";
import { Stack, VStack, Field, NativeSelect } from "@chakra-ui/react";
import {
  FAKE_ITEMS,
  SHIFTS,
  type HarvestShift,
} from "@/api/fakes/farmerSectionHarvest";

export type ShiftFilter = HarvestShift | "all";

export type FilterBarProps = {
  /** Selected crop/item id (required) */
  itemId: string;
  onItemIdChange: (id: string) => void;

  /** Selected shift (default "all") */
  shift?: ShiftFilter;
  onShiftChange?: (s: ShiftFilter) => void;
};

function FilterBarBase({
  itemId,
  onItemIdChange,
  shift = "all",
  onShiftChange,
}: FilterBarProps) {
  return (
    <Stack gap="4" width="full">
      <VStack gap="4" align="start" flexWrap="wrap">
        {/* Item selector */}
        <Field.Root>
          <Field.Label>Item</Field.Label>
          <NativeSelect.Root size="sm" width="260px">
            <NativeSelect.Field
              placeholder="Select item"
              value={itemId ?? ""}
              onChange={(e) => onItemIdChange(e.currentTarget.value)}
            >
              <option value="" disabled>
                Select item
              </option>
              {FAKE_ITEMS.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>

        {/* Shift selector (All or a single shift) */}
        <Field.Root>
          <Field.Label>Shift</Field.Label>
          <NativeSelect.Root size="sm" width="220px">
            <NativeSelect.Field
              placeholder="All shifts"
              value={shift ?? "all"}
              onChange={(e) =>
                onShiftChange?.((e.currentTarget.value || "all") as ShiftFilter)
              }
            >
              <option value="all">All</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
      </VStack>
    </Stack>
  );
}

export const FilterBar = memo(FilterBarBase);
export default FilterBar;
