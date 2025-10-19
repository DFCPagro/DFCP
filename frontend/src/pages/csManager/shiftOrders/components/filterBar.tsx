import { HStack, Select, Switch, Text, createListCollection } from "@chakra-ui/react";
import type { CSOrderStatus } from "@/types/cs.orders";

type Props = {
  status?: string;
  setStatus: (v: string | undefined) => void;
  problemOnly: boolean;
  setProblemOnly: (v: boolean) => void;
};

const statuses: CSOrderStatus[] = [
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

type SelectItem = { id: string; label: string };

// In Chakra v3 Select, the collection resolves the "value" from each item's `id`.
// No `getItemValue` prop exists — only `items` and optional `itemToString`.
const SELECT_ITEMS: SelectItem[] = [
  { id: "", label: "All" },
  ...statuses.map((s) => ({ id: s, label: s })),
];

const collection = createListCollection<SelectItem>({
  items: SELECT_ITEMS,
  itemToString: (item) => item.label,
});

export function FilterBar({
  status,
  setStatus,
  problemOnly,
  setProblemOnly,
}: Props) {
  return (
    <HStack gap="4" flexWrap="wrap">
      <HStack gap="2">
        <Text fontWeight="medium">Status</Text>

        <Select.Root
          size="sm"
          collection={collection}
          value={[status ?? ""]} // Select expects string[] of item ids
          onValueChange={(e) => {
            const v = e.value?.[0] ?? "";
            setStatus(v ? v : undefined);
          }}
        >
          <Select.Trigger w="220px">
            <Select.ValueText placeholder="All" />
          </Select.Trigger>
          <Select.Content>
            {SELECT_ITEMS.map((item) => (
              <Select.Item key={item.id} item={item}>
                {item.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </HStack>

      <HStack gap="2">
        {/* Chakra v3 Switch is namespaced */}
        <Switch.Root
          checked={problemOnly}
          onCheckedChange={(e) => setProblemOnly(e.checked)}
          size="sm"
        >
          <Switch.Control />
        </Switch.Root>
        <Text>Problem only</Text>
      </HStack>
    </HStack>
  );
}
