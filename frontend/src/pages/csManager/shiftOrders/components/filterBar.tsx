// src/pages/csManager/shiftOrders/components/filterBar.tsx
import { HStack, Text, NativeSelect, Switch } from "@chakra-ui/react";
import type { OrderStatus } from "@/types/cs.orders";

type Props = {
  stageKey?: string;
  setStatus: (v: string | undefined) => void;
  problemOnly: boolean;
  setProblemOnly: (v: boolean) => void;
};

const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "farmer",
  "in-transit",
  "packing",
  "ready_for_pickUp",
  "out_for_delivery",
  "delivered",
  "received",
  "canceled",
  "problem",
];

const labelize = (k: string) =>
  k.replace(/[_-]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export function FilterBar({
  stageKey,
  setStatus,
  problemOnly,
  setProblemOnly,
}: Props) {
  return (
    <HStack
      gap="6"
      alignItems="center"
      justifyContent="flex-start"
      flexWrap="wrap"
      position="relative"
      zIndex="1"
    >
      {/* Status label + dropdown inline */}
      <HStack gap="2" alignItems="center" opacity={problemOnly ? 0.5 : 1}>
        <Text fontWeight="medium">Status</Text>
        <NativeSelect.Root size="sm" disabled={problemOnly} w="220px">
          <NativeSelect.Field
            value={stageKey ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setStatus(v ? v : undefined);
            }}
          >
            <option value="">All Statuses</option>
            {STATUSES.filter((s) => s !== "problem").map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </HStack>

      {/* Problem-only switch inline */}
      <label htmlFor="problem-only" style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "8px" }}>
        <Switch.Root
          id="problem-only"
          checked={problemOnly}
          onCheckedChange={(e) => {
            const next = !!e.checked;
            setProblemOnly(next);
            if (next) setStatus(undefined);
          }}
          size="sm"
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
        <Text>Problem only</Text>
      </label>
    </HStack>
  );
}

export default FilterBar;
