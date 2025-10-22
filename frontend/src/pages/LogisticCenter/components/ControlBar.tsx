import {
  Card,
  HStack,
  Select,
  Switch,
  Field,
  Badge,
  createListCollection,
} from "@chakra-ui/react";
import { useUIStore } from "@/store/useUIStore";

const typeOptions = createListCollection({
  items: [
    { label: "All types", value: "all" },
    { label: "Warehouse", value: "warehouse" },
    { label: "Picker", value: "picker" },
    { label: "Delivery", value: "delivery" },
  ],
});

export default function ControlBar() {
  const filterType = useUIStore((s) => s.filterType);
  const setFilterType = useUIStore((s) => s.setFilterType);
  const onlyAvoid = useUIStore((s) => s.onlyAvoid);
  const setOnlyAvoid = useUIStore((s) => s.setOnlyAvoid);
  const crowdedOnly = useUIStore((s) => s.crowdedOnly);
  const setCrowdedOnly = useUIStore((s) => s.setCrowdedOnly);
  const openScan = useUIStore((s) => s.openScan);

  return (
    <Card.Root
      bg="linear-gradient(180deg, var(--colors-gamePanelTop), var(--colors-gamePanelBottom))"
      borderRadius="2xl"
    >
      <Card.Body gap="4">
        <HStack justify="space-between" wrap="wrap" gap="4">
          <Select.Root
            collection={typeOptions}
            width="220px"
            value={[filterType]}
            onValueChange={(d) => setFilterType((d.value[0] ?? "all") as any)}
            size="md"
          >
            <Select.HiddenSelect />
            <Select.Label>Type</Select.Label>
            <Select.Control>
              <Select.Trigger>
                <Select.ValueText placeholder="Shelf type" />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
                <Select.ClearTrigger />
              </Select.IndicatorGroup>
            </Select.Control>
            <Select.Positioner>
              <Select.Content>
                {typeOptions.items.map((z) => (
                  <Select.Item key={z.value} item={z}>
                    {z.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>

          <Field.Root orientation="horizontal">
            <Field.Label>Only Avoid-flagged</Field.Label>
            <Switch.Root
              checked={onlyAvoid}
              onCheckedChange={(e) => setOnlyAvoid(e.checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label />
            </Switch.Root>
          </Field.Root>

          <Field.Root orientation="horizontal">
            <Field.Label>Crowded (busy ≥ 70)</Field.Label>
            <Switch.Root
              checked={crowdedOnly}
              onCheckedChange={(e) => setCrowdedOnly(e.checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Label />
            </Switch.Root>
          </Field.Root>

          <Badge
            asChild
            variant="solid"
            colorPalette="lime"
            borderRadius="full"
            px="3"
            py="2"
          >
            <button onClick={() => openScan("container")}>
              Scan Container / Slot
            </button>
          </Badge>
        </HStack>
      </Card.Body>
    </Card.Root>
  );
}
