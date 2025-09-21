// src/pages/FarmerCropManagement/components/LandList.tsx
import { Box, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import type { LandDTO } from "@/types/agri";
import EmptyState from "./EmptyState";
import LandListItem from "./LandListItem";

export type LandListProps = {
  lands: LandDTO[];
  selectedLandId?: string | null;
  onSelect: (landId: string) => void;
  isLoading?: boolean;
  /** Optional title above the list */
  title?: string;
  /** Fixed height or max height for the scroll area */
  height?: string | number;
  /** Disable interaction (e.g., during a mutation) */
  disabled?: boolean;
};

export default function LandList({
  lands,
  selectedLandId = null,
  onSelect,
  isLoading = false,
  title = "Lands",
  height = "320px",
  disabled = false,
}: LandListProps) {
  return (
    <Box
      borderWidth="1px"
      rounded="l3"
      p="3"
      bg="bg"
      _dark={{ borderColor: "gray.700" }}
      w="full"
    >
      <Text fontWeight="semibold" mb="2">
        {title}
      </Text>

      {isLoading ? (
        <HStack justify="center" gap="3" py="4">
          <Spinner />
          <Text fontSize="sm" color="fg.muted">
            Loading lands…
          </Text>
        </HStack>
      ) : lands.length === 0 ? (
        <EmptyState
          title="No lands found"
          subtitle="You don’t have any lands yet."
          showOutline
          minH="120px"
        />
      ) : (
        <Box maxH={height} overflowY="auto" pr="1">
          <Stack as="ul" gap="2" listStyleType="none" m="0" p="0">
            {lands.map((land) => (
              <Box as="li" key={land.id}>
                <LandListItem
                  land={land}
                  selected={selectedLandId === land.id}
                  onSelect={onSelect}
                  disabled={disabled}
                />
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
