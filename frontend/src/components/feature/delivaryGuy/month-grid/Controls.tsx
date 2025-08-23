import {
  HStack,
  ButtonGroup,
  Button,
  Menu,
  IconButton,
  Text,
  Separator,
  Box,
} from "@chakra-ui/react";
import { Check, EllipsisVertical } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { Density } from "./types";

type Props = {
  editable: boolean;
  hasTemplate: boolean;
  density: Density;
  setDensity: (d: Density) => void;
  weekendShade: boolean;
  setWeekendShade: (v: boolean) => void;
  showOutside: boolean;
  setShowOutside: (v: boolean) => void;
  onSelectAllFromTemplate?: () => void;
  onClearAll?: () => void;
  onCheckWeekends?: () => void;
  onUncheckWeekends?: () => void;
};

const ACTIVE_COLOR = "green" as const;

export function Controls({
  editable,
  hasTemplate,
  density,
  setDensity,
  weekendShade,
  setWeekendShade,
  showOutside,
  setShowOutside,
  onSelectAllFromTemplate,
  onClearAll,
  onCheckWeekends,
  onUncheckWeekends,
}: Props) {
  if (!editable) return null;

  // a tiny helper for checked menu rows
  const Row = ({
    label,
    checked,
    onSelect,
  }: {
    label: string;
    checked?: boolean;
    onSelect: () => void;
  }) => (
    <Box
      as="button"
      onClick={onSelect}
      display="flex"
      alignItems="center"
      gap="8px"
      px="10px"
      py="8px"
      w="full"
      _hover={{ bg: "gray.50" }}
    >
      <Box w="16px" h="16px" display="inline-flex" alignItems="center" justifyContent="center">
        {checked ? <Check size={14} /> : null}
      </Box>
      <Text>{label}</Text>
    </Box>
  );

  return (
    <HStack justify="space-between" gap={2} wrap="wrap">
      {/* Compact density toggle */}
      <Tooltip content="Display density">
        <ButtonGroup size="xs" variant="outline" attached>
          <Button
            aria-pressed={density === "dots"}
            onClick={() => setDensity("dots")}
            colorPalette={density === "dots" ? ACTIVE_COLOR : undefined}
          >
            Dots
          </Button>
          <Button
            aria-pressed={density === "chips"}
            onClick={() => setDensity("chips")}
            colorPalette={density === "chips" ? ACTIVE_COLOR : undefined}
          >
            Chips
          </Button>
        </ButtonGroup>
      </Tooltip>

      {/* Everything else lives in the overflow menu */}
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton aria-label="More actions" variant="ghost" size="xs">
            <EllipsisVertical size={16} />
          </IconButton>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content minW="220px" p="4px">
            {/* toggles */}
            <Text px="10px" py="6px" fontSize="xs" color="gray.500">
              View options
            </Text>
            <Row
              label="Shade weekends"
              checked={weekendShade}
              onSelect={() => setWeekendShade(!weekendShade)}
            />
            <Row
              label="Show adjacent days"
              checked={showOutside}
              onSelect={() => setShowOutside(!showOutside)}
            />

            <Separator my="4px" />

            {/* bulk actions */}
            <Text px="10px" py="6px" fontSize="xs" color="gray.500">
              Bulk actions
            </Text>
            <Row label="Clear all" onSelect={() => onClearAll?.()} />
            {hasTemplate && (
              <>
                <Row
                  label="Select all (from template)"
                  onSelect={() => onSelectAllFromTemplate?.()}
                />
                <Row label="Check weekends" onSelect={() => onCheckWeekends?.()} />
                <Row label="Uncheck weekends" onSelect={() => onUncheckWeekends?.()} />
              </>
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </HStack>
  );
}
