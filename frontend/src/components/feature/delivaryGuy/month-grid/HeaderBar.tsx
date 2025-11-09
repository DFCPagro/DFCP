import {
  HStack,
  Heading,
  IconButton,
  Menu,
  Box,
  Text,
  Separator,
  Badge,
  Popover,
} from "@chakra-ui/react";
import { Info, EllipsisVertical, Check, CheckIcon } from "lucide-react";
import { monthName, SHIFTS } from "@/store/scheduleStore";
import { Tooltip } from "@/components/ui/tooltip";
const ACTIVE_COLOR = "green" as const;

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
    <HStack justify="space-between" align="center">
      <Heading size="md" lineHeight="1">
        {monthName(month)} {year}
      </Heading>

      {actionsVisible && (
        <HStack gap={1}>
          {/* Info popover: legend + shift times (hidden by default) */}
          <Popover.Root>
            <Popover.Trigger asChild>
              <IconButton aria-label="Shift info" variant="ghost" size="xs" p="2">
                <Info size={16} />
                info
              </IconButton>
            </Popover.Trigger>
            <Popover.Positioner>
              <Popover.Content p={3} maxW="sm">
                <Text fontWeight="semibold" mb={2}>
                  Shift info
                </Text>
                <HStack gap={2} wrap="wrap" mb={2}>
                  <Badge variant="solid" colorPalette={ACTIVE_COLOR}>
                    On
                  </Badge>
                  <Badge
                    variant="outline"
                    borderStyle="dashed"
                    colorPalette={ACTIVE_COLOR}
                  >
                    Standby
                  </Badge>
                  <Badge variant="outline" colorPalette="gray">
                    Off
                  </Badge>
                </HStack>
                <Separator />
               <HStack wrap="wrap" gap={2} mt={2}>
  {SHIFTS.map((s) => {
    const first = s.name?.[0] ?? "";
    const rest = s.name?.slice(1) ?? "";
    return (
      <Box
        key={s.name}
        px={2.5}
        py={1}
        border="1px"
        borderColor="gray.200"
        rounded="md"
        bg="gray.50"
      >
        <HStack gap={3}>
          <Text>
            <Text as="span" color="teal.600" fontWeight="bold">
              {first}
            </Text>
            <Text as="span">{rest}</Text>
          </Text>
          <Text color="gray.600" fontSize="sm">
            {s.start}–{s.end}
          </Text>
        </HStack>
      </Box>
    );
  })}
</HStack>

                {editable && (
                  <Text mt={3} fontSize="xs" color="gray.600">
                    Click a day to cycle Off → On → Standby. Max 2 picks/day.
                  </Text>
                )}
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Root>

          {/* Overflow menu: density + view toggles + bulk actions */}
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton aria-label="More actions" variant="ghost" size="xs">
                <EllipsisVertical size={16} />
              </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content minW="240px" p="4px">
                <Text px="10px" py="6px" fontSize="xs" color="gray.500">
                  Display
                </Text>
                <Menu.Item
                  value="density-dots"
                  onSelect={() => setDensity("dots")}
                >
                  {density === "dots" && <CheckIcon />}
                  <Box flex="1">Compact</Box>
                </Menu.Item>
                <Menu.Item
                  value="density-chips"
                  onSelect={() => setDensity("chips")}
                >
                  {density === "chips" && <CheckIcon />}
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
                  {weekendShade && <CheckIcon />}
                  <Box flex="1">Shade weekends</Box>
                </Menu.Item>
                <Menu.Item
                  value="toggle-adjacent"
                  onSelect={() => setShowOutside(!showOutside)}
                >
                  {showOutside && <CheckIcon />}
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
  );
}
