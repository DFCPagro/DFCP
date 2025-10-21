// src/pages/FarmerCropManagement/hooks/useLandSections.ts
// Fetch sections (with crops[]) for a given land.
// - Works with fake or real API (controlled by VITE_USE_FAKE_FARMER_API)
// - Keeps output simple for the page to orchestrate selection/tabs

import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import farmerCropsApi from "@/api/farmerCrops";
import type { SectionDTO } from "@/types/agri";

export type UseLandSectionsResult = {
  /** Sections for the selected land (empty if none or not enabled) */
  sections: SectionDTO[];
  /** Quick lookup by id */
  sectionsById: Map<string, SectionDTO>;
  /** Convenience flags */
  hasSections: boolean;
  isIdle: boolean; // not enabled yet (no landId)
  // TanStack Query passthrough
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => Promise<any>;
  /** First section id (useful as a default when nothing is selected) */
  firstSectionId: string | null;
};

export function useLandSections(landId: string | null | undefined): UseLandSectionsResult {
  const enabled = !!landId;

  const query = useQuery({
    queryKey: enabled ? farmerCropsApi.keys.sections(landId!) : ["farmer", "sections", "disabled"],
    queryFn: () => farmerCropsApi.listSectionsByLand(landId!),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const sections = (query.data ?? []) as SectionDTO[];

  const sectionsById = useMemo(
    () => new Map(sections.map((s) => [s.id, s] as const)),
    [sections]
  );

  const firstSectionId = sections.length ? sections[0].id : null;

  return {
    sections,
    sectionsById,
    hasSections: sections.length > 0,
    isIdle: !enabled,

    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,

    firstSectionId,
  };
}

export default useLandSections;
