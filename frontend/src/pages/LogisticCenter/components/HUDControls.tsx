import {
  Card,
  Field,
  Switch,
  Select,
  createListCollection,
  Input,
  HStack,
  Text,
  Icon,
  Button,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { Filter, QrCode, Info, LocateFixed } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useState } from "react";

const typeOptions = createListCollection({
  items: [
    { label: "All types", value: "all" },
    { label: "Warehouse", value: "warehouse" },
    { label: "Picker", value: "picker" },
    { label: "Delivery", value: "delivery" },
  ],
});

export default function HUDControls() {
  const filterType = useUIStore((s) => s.filterType);
  const setFilterType = useUIStore((s) => s.setFilterType);
  const onlyAvoid = useUIStore((s) => s.onlyAvoid);
  const setOnlyAvoid = useUIStore((s) => s.setOnlyAvoid);
  const crowdedOnly = useUIStore((s) => s.crowdedOnly);
  const setCrowdedOnly = useUIStore((s) => s.setCrowdedOnly);
  const openScan = useUIStore((s) => s.openScan);

  const [goto, setGoto] = useState("");

  const focusShelf = (shelfId: string) => {
    // Fire a global event; Board now listens on window as well.
    window.dispatchEvent(
      new CustomEvent("app:gotoShelf", { detail: { shelfId } })
    );
  };

  return (
    <Card.Root
      position="fixed"
      bottom="16px"
      right="16px"
      zIndex={50}
      borderRadius="18px"
      bg={`linear-gradient(180deg, token(colors.gamePanelTop), token(colors.gamePanelBottom))`}
      shadow="lg"
      w={{ base: "auto", sm: "360px" }}
    >
      <Card.Header>
        <HStack justify="space-between">
          <HStack>
            <Icon as={Filter} />
            <Text fontWeight="bold">Controls</Text>
          </HStack>
          <Tooltip content="Quick filters and actions.">
            <Icon as={Info} color="muted" />
          </Tooltip>
        </HStack>
      </Card.Header>
      <Card.Body gap="3">
        <Select.Root
          collection={typeOptions}
          // Controlled value MUST be string[]; ensure we always pass a valid value
          value={[filterType]}
          onValueChange={(d) => {
            const next = (d?.value?.[0] ?? "all") as
              | "all"
              | "warehouse"
              | "picker"
              | "delivery";
            setFilterType(next);
          }}
          size="sm"
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
            onCheckedChange={(e) => setOnlyAvoid(!!e.checked)}
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
            onCheckedChange={(e) => setCrowdedOnly(!!e.checked)}
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Label />
          </Switch.Root>
        </Field.Root>

        <Field.Root>
          <Field.Label>Go to shelf</Field.Label>
          <HStack>
            <Input
              placeholder="e.g. C-3-6"
              size="sm"
              value={goto}
              onChange={(e) => setGoto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && goto.trim()) {
                  focusShelf(goto.trim());
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => goto.trim() && focusShelf(goto.trim())}
            >
              <Icon as={LocateFixed} />
            </Button>
          </HStack>
        </Field.Root>
      </Card.Body>
      <Card.Footer justifyContent="flex-end" gap="2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => openScan("container")}
        >
          <Icon as={QrCode} /> Scan
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}
