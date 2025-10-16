// src/pages/csManagerOrders/components/shiftFilterBar.tsx
import { Stack, HStack, Input, Button, Text, chakra } from "@chakra-ui/react";

export type ShiftName = "Morning" | "Afternoon" | "Evening" | "Night";
export const SHIFT_OPTIONS: ShiftName[] = ["Morning", "Afternoon", "Evening", "Night"];

// ✅ Properly typed HTML elements
const Label = chakra("label");
const SelectEl = chakra("select");

type Props = {
  fromDate: string; toDate: string;
  setFromDate: (v: string) => void; setToDate: (v: string) => void;
  searchDate: string; searchShift: ShiftName | "";
  setSearchDate: (v: string) => void; setSearchShift: (v: ShiftName | "") => void;
  exactValid: boolean;
  onApply: () => void;
  onClear: () => void;
};

export default function ShiftFilterBar({
  fromDate, toDate, setFromDate, setToDate,
  searchDate, searchShift, setSearchDate, setSearchShift,
  exactValid, onApply, onClear,
}: Props) {
  const fromId = "filter-from-date";
  const toId = "filter-to-date";
  const shiftDateId = "filter-shift-date";
  const shiftId = "filter-shift";

  return (
    <Stack direction={{ base: "column", md: "row" }} gap="3" align="end">
      {/* Date range */}
      <HStack gap="3" flex="1">
        <Stack minW="40">
          <Label htmlFor={fromId} fontSize="sm" fontWeight="medium" mb="1" display="block">From</Label>
          <Input id={fromId} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Stack>

        <Stack minW="40">
          <Label htmlFor={toId} fontSize="sm" fontWeight="medium" mb="1" display="block">To</Label>
          <Input id={toId} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Stack>
      </HStack>

      {/* Exact shift search */}
      <HStack gap="3" flex="1">
        <Stack minW="40">
          <Label htmlFor={shiftDateId} fontSize="sm" fontWeight="medium" mb="1" display="block">Shift date</Label>
          <Input id={shiftDateId} type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
        </Stack>

        <Stack minW="40">
          <Label htmlFor={shiftId} fontSize="sm" fontWeight="medium" mb="1" display="block">Shift</Label>
          {/* ✅ Properly typed select via chakra('select') */}
          <SelectEl
            id={shiftId}
            value={searchShift}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSearchShift(e.target.value as ShiftName)
            }
            px="3"
            py="2"
            borderWidth="1px"
            borderRadius="md"
            bg="bg"
            _focusVisible={{ boxShadow: "outline" }}
          >
            <option value="">Select</option>
            {SHIFT_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </SelectEl>
        </Stack>
      </HStack>

      {/* Actions */}
      <HStack gap="2">
        {!exactValid && (searchDate || searchShift) && (
          <Text color="red.500" fontSize="sm">Enter a valid date and shift.</Text>
        )}
        <Button variant="outline" onClick={onClear}>Clear</Button>
        <Button onClick={onApply}>Apply</Button>
      </HStack>
    </Stack>
  );
}
