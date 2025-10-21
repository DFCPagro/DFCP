// src/pages/FarmerCropManagement/components/SectionTabs.tsx
import { Box, Button, Spinner, Tabs, Text } from "@chakra-ui/react";
import { FiPlus } from "react-icons/fi";
import type { SectionDTO } from "@/types/agri";

export type SectionTabsProps = {
  sections: SectionDTO[];
  /** Currently selected section id (controlled) */
  selectedSectionId: string | null | undefined;
  /** Called when the user selects a different section */
  onSelect: (sectionId: string) => void;
  /** Called when the user clicks the right-most "+" button */
  onAddCrop?: (sectionId: string) => void;
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
  onAddCrop,
  isLoading = false,
}: SectionTabsProps) {
  const hasSections = sections?.length > 0;
  const value = selectedSectionId ?? (hasSections ? sections[0].id : null);

  const selectedSection = value ? sections.find((s) => s.id === value) ?? null : null;
  // Respect "one crop per section": enable + only when the selected section has no crop
  const canAddOnSelected =
    !!selectedSection && (selectedSection.crops?.length ?? 0) === 0;

  return (
    <Box w="full">
      {isLoading ? (
        <Box display="inline-flex" gap="12px" py="12px" alignItems="center">
          <Spinner />
          <Text fontSize="sm" color="fg.muted">Loading sections…</Text>
        </Box>
      ) : !hasSections ? (
        <Text py="12px" color="fg.muted">No sections for this land yet.</Text>
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
              p="4px"
              display="inline-flex"
              gap="4px"
              alignItems="center"
            >
              {/* All section triggers */}
              {sections.map((s, idx) => (
                <Tabs.Trigger
                  key={s.id}
                  value={s.id}
                  px="12px"
                  py="8px"
                  rounded="l2"
                  fontSize="sm"
                  whiteSpace="nowrap"
                >
                  {labelForSection(s, idx)}
                </Tabs.Trigger>
              ))}

              {/* Far-right "+" pseudo-tab */}
              <Button
                size="xs"
                variant="subtle"
                rounded="l2"
                aria-label="Add crop to selected section"
                title={
                  canAddOnSelected
                    ? "Add crop to selected section"
                    : "Selected section already has a crop"
                }
                colorPalette={canAddOnSelected ? "green" : "gray"}
                disabled={!canAddOnSelected || !onAddCrop}
                onClick={() => {
                  if (value && onAddCrop) onAddCrop(value);
                }}
              >
                <FiPlus />
              </Button>

              {/* Keep indicator last so it aligns to the selected trigger */}
              <Tabs.Indicator rounded="l2" />
            </Tabs.List>
          </Box>
        </Tabs.Root>
      )}
    </Box>
  );
}
