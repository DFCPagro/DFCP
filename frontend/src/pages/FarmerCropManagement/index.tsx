// src/pages/FarmerCropManagement/index.tsx
import { Box, Grid, Stack } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import useFarmerLands from "./hooks/useFarmerLands";
import useLandSections from "./hooks/useLandSections";

import LandList from "./components/LandList";
import MapPreviewWIP from "./components/MapPreviewWIP";
import SectionTabs from "./components/SectionTabs";
import CropsTable from "./components/CropsTable";
import AddCropDrawer from "./components/AddCropDrawer";
import EmptyState from "./components/EmptyState";

export default function FarmerCropManagementPage() {
  const [params, setParams] = useSearchParams();

  const landIdParam = params.get("landId");
  const sectionIdParam = params.get("sectionId");

  const [isAddOpen, setIsAddOpen] = useState(false);

  // Lands
  const {
    lands,
    landsById,
    hasLands,
    isLoading: landsLoading,
  } = useFarmerLands();

  // Resolve selected land id (fall back to first when ready)
  const selectedLandId = useMemo(() => {
    if (!hasLands) return null;
    if (landIdParam && landsById.has(landIdParam)) return landIdParam;
    return lands[0].id;
  }, [hasLands, landIdParam, lands, landsById]);

  // Sections for selected land
  const {
    sections,
    sectionsById,
    hasSections,
    isLoading: sectionsLoading,
    firstSectionId,
  } = useLandSections(selectedLandId);

  // Resolve selected section id (fall back to first available)
  const selectedSectionId = useMemo(() => {
    if (!hasSections) return null;
    if (sectionIdParam && sectionsById.has(sectionIdParam)) return sectionIdParam;
    return firstSectionId;
  }, [hasSections, sectionIdParam, sectionsById, firstSectionId]);

  const selectedLandName = selectedLandId ? landsById.get(selectedLandId)?.name ?? null : null;
  const selectedSection = selectedSectionId ? sectionsById.get(selectedSectionId) ?? null : null;

  // Keep URL params in sync (sets defaults when missing/invalid)
  useEffect(() => {
    const next = new URLSearchParams(params);

    // Ensure landId is valid
    if (selectedLandId && selectedLandId !== landIdParam) {
      next.set("landId", selectedLandId);
      // when land changes, drop sectionId (it will re-derive below)
      next.delete("sectionId");
    }

    // Ensure sectionId is valid for the selected land
    if (selectedSectionId && selectedSectionId !== sectionIdParam) {
      next.set("sectionId", selectedSectionId);
    }

    // Only push if something actually changed
    const changed =
      next.get("landId") !== landIdParam || next.get("sectionId") !== sectionIdParam;

    if (changed) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLandId, selectedSectionId]); // (params & setParams are stable from react-router)

  function handleSelectLand(newLandId: string) {
    const next = new URLSearchParams(params);
    next.set("landId", newLandId);
    next.delete("sectionId"); // will be derived to first section
    setParams(next);
  }

  function handleSelectSection(newSectionId: string) {
    const next = new URLSearchParams(params);
    next.set("sectionId", newSectionId);
    setParams(next);
  }

  return (
    <Stack gap="5" w="full">
      {/* Top split: persistent land list (left) + WIP map (right) */}
      <Grid
        templateColumns={{ base: "1fr", lg: "360px 1fr" }}
        gap="4"
        alignItems="start"
      >
        <LandList
          lands={lands}
          selectedLandId={selectedLandId}
          onSelect={handleSelectLand}
          isLoading={landsLoading}
          height="300px"
          title="Lands"
        />

        <MapPreviewWIP title="Map (WIP)" height="300px" />
      </Grid>

      {/* Bottom: sections + crops */}
      <Box>
        {landsLoading ? null : !hasLands ? (
          <EmptyState
            title="No lands found"
            subtitle="Register a land to start managing crops."
            showOutline
          />
        ) : (
          <Stack gap="4">
            <SectionTabs
              sections={sections}
              selectedSectionId={selectedSectionId}
              onSelect={handleSelectSection}
              isLoading={sectionsLoading}
            />

            <CropsTable
              landName={selectedLandName}
              section={selectedSection}
              isLoading={sectionsLoading}
              onAddCropClick={() => setIsAddOpen(true)}
            />
          </Stack>
        )}
      </Box>

      {/* Drawer for adding a crop */}
      <AddCropDrawer
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        landId={selectedLandId}
        sectionId={selectedSectionId}
      />
    </Stack>
  );
}
