import {
  Badge,
  Box,
  HStack,
  Heading,
  IconButton,
  Menu,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react";
import { EllipsisVertical, Check } from "lucide-react";
import { monthName } from "@/store/scheduleStore";
import ShiftInfoPanel from "./ShiftInfoPanel";

export default function HeaderBar({
  month,
  year,
  actionsVisible,
  editable,
  density,
  setDensity,
  hasTemplate,
  weekendShade,
  setWeekendShade,
  showOutside,
  setShowOutside,
  onSelectAllFromTemplate,
  onClearAll,
  onCheckWeekends,
  onUncheckWeekends,
}: {
  month: number;
  year: number;
  actionsVisible: boolean;
  editable: boolean;
  density: "dots" | "chips";
  setDensity: (d: "dots" | "chips") => void;
  hasTemplate: boolean;
  weekendShade: boolean;
  setWeekendShade: (v: boolean) => void;
  showOutside: boolean;
  setShowOutside: (v: boolean) => void;
  onSelectAllFromTemplate?: () => void;
  onClearAll?: () => void;
  onCheckWeekends?: () => void;
  onUncheckWeekends?: () => void;
}) {
  return (
    <VStack align="stretch" w="full" gap={3}>
      <HStack justify="space-between" align="center" w="full" gap={3}>
        <Heading size="md" lineHeight="1">
          {monthName(month)} {year}
        </Heading>

        {actionsVisible && (
          <HStack gap={2} flex="1" justify="flex-end" align="center" minW={0}>
            {/* Overflow menu: density + view toggles + bulk actions */}
            <Menu.Root>
              <Menu.Trigger asChild>
                <IconButton aria-label="More actions" variant="ghost" size="xs">
                  <EllipsisVertical size={16} />
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content minW="260px" p="4px">
                  <Text px="10px" py="6px" fontSize="xs" color="gray.500">
                    Display
                  </Text>
                  <Menu.Item
                    value="density-dots"
                    onSelect={() => setDensity("dots")}
                  >
                    {density === "dots" && <Check size={14} />}
                    <Box flex="1">Compact</Box>
                  </Menu.Item>
                  <Menu.Item
                    value="density-chips"
                    onSelect={() => setDensity("chips")}
                  >
                    {density === "chips" && <Check size={14} />}
                    <Box flex="1">Chips (detailed)</Box>
                  </Menu.Item>

                  <Separator my="4px" />

                  <Text px="10px" py="6px" fontSize="xs" color="gray.500">
                    View options
                  </Text>
                  <Menu.Item
                    value="toggle-weekend"
                    onSelect={() => setWeekendShade(!weekendShade)}
                  >
                    {weekendShade && <Check size={14} />}
                    <Box flex="1">Shade weekends</Box>
                  </Menu.Item>
                  <Menu.Item
                    value="toggle-adjacent"
                    onSelect={() => setShowOutside(!showOutside)}
                  >
                    {showOutside && <Check size={14} />}
                    <Box flex="1">Show adjacent days</Box>
                  </Menu.Item>

                  <Separator my="4px" />

                  <Text px="10px" py="6px" fontSize="xs" color="gray.500">
                    Bulk actions
                  </Text>
                  <Menu.Item value="clear-all" onSelect={onClearAll}>
                    Clear all
                  </Menu.Item>
                  {hasTemplate && (
                    <>
                      <Menu.Item
                        value="select-template"
                        onSelect={onSelectAllFromTemplate}
                      >
                        Select all (from template)
                      </Menu.Item>
                      <Menu.Item
                        value="check-weekends"
                        onSelect={onCheckWeekends}
                      >
                        Check weekends
                      </Menu.Item>
                      <Menu.Item
                        value="uncheck-weekends"
                        onSelect={onUncheckWeekends}
                      >
                        Uncheck weekends
                      </Menu.Item>
                    </>
                  )}
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
          </HStack>
        )}
      </HStack>

      {/* Shift info panel separated from table */}
      <ShiftInfoPanel editable={editable} />
    </VStack>
  );
}
