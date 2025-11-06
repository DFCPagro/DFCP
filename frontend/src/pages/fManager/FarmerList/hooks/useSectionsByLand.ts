// src/pages/FarmerManager/FarmerList/hooks/useSectionsByLand.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSectionsByLand, qkFarmerSectionsByLand } from "@/api/farmer";
import type { FarmerSection } from "@/types/farmer";

export type UseSectionsByLandProps = {
  /** Land _id */
  landId?: string | null;

  /**
   * If the parent land object already contains embedded sections, pass them here.
   * When provided (even an empty array), the hook skips the API call unless `forceFetch` is true.
   */
  sectionsFromLand?: FarmerSection[] | null | undefined;

  /** Force a fetch even if sections are provided */
  forceFetch?: boolean;

  /** Enable/disable the hook */
  enabled?: boolean;
};

export type UseSectionsByLandResult = {
  /** Final sections to render */
  sections: FarmerSection[];

  /** Derived stats */
  sectionsCount: number;
  cropsCount: number;
  cropsByStatus: Record<string, number>;
  areaTotalM2: number;
  hasAnyMeasurements: boolean;

  /** React Query state (only relevant when fetching) */
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;

  /** Whether data came from "land" (embedded) or "api" (fetched) */
  source: "land" | "api";
};

/**
 * Fetch sections for a specific land.
 * - If `sectionsFromLand` is provided, uses that and skips the network call.
 * - Otherwise calls the backend via api/farmer.getSectionsByLand.
 */
export function useSectionsByLand({
  landId,
  sectionsFromLand,
  forceFetch = false,
  enabled = true,
}: UseSectionsByLandProps): UseSectionsByLandResult {
  const canUseEmbedded = !forceFetch && sectionsFromLand !== undefined;

  const query = useQuery({
    queryKey: landId
      ? qkFarmerSectionsByLand(landId)
      : ["farmerSections", "byLand", "empty"],
    queryFn: ({ signal }) => getSectionsByLand(landId as string, { signal }),
    enabled: enabled && Boolean(landId) && !canUseEmbedded,
    retry: 1,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  // Choose data source
  const sections: FarmerSection[] = useMemo(() => {
    if (canUseEmbedded) return (sectionsFromLand ?? []) as FarmerSection[];
    return query.data?.items ?? [];
  }, [canUseEmbedded, sectionsFromLand, query.data]);

  // Derived stats for quick UI use
  const {
    sectionsCount,
    cropsCount,
    cropsByStatus,
    areaTotalM2,
    hasAnyMeasurements,
  } = useMemo(() => {
    const stats = {
      sectionsCount: sections.length,
      cropsCount: 0,
      cropsByStatus: {} as Record<string, number>,
      areaTotalM2: 0,
      hasAnyMeasurements: false,
    };

    for (const s of sections) {
      // area
      if (typeof s.areaM2 === "number" && !Number.isNaN(s.areaM2)) {
        stats.areaTotalM2 += s.areaM2;
      }
      // measurements flag
      if (s.measurements) stats.hasAnyMeasurements = true;

      // crops
      const crops = s.crops ?? [];
      stats.cropsCount += crops.length;
      for (const c of crops) {
        const key = (c.status ?? "unknown") as string;
        stats.cropsByStatus[key] = (stats.cropsByStatus[key] ?? 0) + 1;
      }
    }
    return stats;
  }, [sections]);

  return {
    sections,
    sectionsCount,
    cropsCount,
    cropsByStatus,
    areaTotalM2,
    hasAnyMeasurements,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
    source: canUseEmbedded ? "land" : "api",
  };
}
