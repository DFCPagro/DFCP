import { Badge, Box, HStack, Separator, Text } from "@chakra-ui/react";
import { Info } from "lucide-react";
import { SHIFTS } from "@/store/scheduleStore";

const ACTIVE_COLOR = "green" as const;

export default function ShiftInfoPanel({ editable }: { editable: boolean }) {
  return (
    <Box
      role="region"
      aria-label="Shift info"
      border="1px"
      borderColor="gray.200"
      rounded="md"
      bg="white"
      px={3}
      py={2}
      w="full"
    >
      <HStack gap={2} mb={2} align="center">
        <Info size={16} />
        <Text fontWeight="semibold">Shift info</Text>
      </HStack>

      <HStack gap={2} flexWrap="wrap" mb={2}>
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

      <HStack flexWrap="wrap" gap={2} mt={2}>
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
                <Text fontSize="sm" color="gray.600">
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
    </Box>
  );
}
