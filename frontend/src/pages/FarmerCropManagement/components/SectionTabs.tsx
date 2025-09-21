// src/pages/FarmerCropManagement/components/SectionTabs.tsx
import { Box, HStack, Spinner, Tabs, Text } from "@chakra-ui/react";
import type { SectionDTO } from "@/types/agri";

export type SectionTabsProps = {
  sections: SectionDTO[];
  /** Currently selected section id (controlled) */
  selectedSectionId: string | null | undefined;
  /** Called when the user selects a different section */
  onSelect: (sectionId: string) => void;
  /** Show loading state while sections are being fetched */
  isLoading?: boolean;
};

function labelForSection(s: SectionDTO, idx: number) {
  return s.name?.trim() || `Section ${idx + 1}`;
}

export default function SectionTabs({
  sections,
  selectedSectionId,
  onSelect,
  isLoading = false,
}: SectionTabsProps) {
  const hasSections = sections?.length > 0;

  // Use controlled Tabs. Fall back to the first section id if none provided.
  const value = selectedSectionId ?? (hasSections ? sections[0].id : null);

  return (
    <Box w="full">
      {isLoading ? (
        <HStack gap="3" py="3">
          <Spinner />
          <Text fontSize="sm" color="fg.muted">
            Loading sections…
          </Text>
        </HStack>
      ) : !hasSections ? (
        <Text py="3" color="fg.muted">
          No sections for this land yet.
        </Text>
      ) : (
        <Tabs.Root
          value={value}
          onValueChange={(e) => onSelect(e.value)}
          variant="plain"
        >
          <Box overflowX="auto">
            <Tabs.List
              minW="fit-content"
              bg="bg.muted"
              rounded="l3"
              p="1"
              // keep the list compact and pill-like
              display="inline-flex"
              gap="1"
            >
              {sections.map((s, idx) => (
                <Tabs.Trigger
                  key={s.id}
                  value={s.id}
                  px="3"
                  py="2"
                  rounded="l2"
                  fontSize="sm"
                  whiteSpace="nowrap"
                >
                  {labelForSection(s, idx)}
                </Tabs.Trigger>
              ))}
              <Tabs.Indicator rounded="l2" />
            </Tabs.List>
          </Box>
          {/* We render content below in the page (CropsTable), so no <Tabs.Content> here */}
        </Tabs.Root>
      )}
    </Box>
  );
}
