// src/pages/FarmerManager/FarmerList/hooks/useFarmerLands.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFarmerLands, qkFarmerLandsByFarmer } from "@/api/farmer";
import type {
  FarmerLandDetail,
  FarmerLandLite,
  FarmerSection,
  FarmerLandId,
} from "@/types/farmer";

export type UseFarmerLandsProps = {
  /** Farmer _id */
  farmerId?: string | null;

  /** Optional lands coming from FarmerDetail (dialog parent).
   *  If provided and non-empty, we won't call the lands API. */
  landsFromDetail?: (FarmerLandLite | FarmerLandDetail)[] | null | undefined;

  /** Force fetch even if landsFromDetail exists */
  forceFetch?: boolean;

  /** Enable/disable hook */
  enabled?: boolean;
};

export type UseFarmerLandsResult = {
  /** Lands to render (either from detail or fetched) */
  lands: (FarmerLandLite | FarmerLandDetail)[];

  /** Derived conveniences */
  landsCount: number;
  sectionsCount: number;
  landIds: FarmerLandId[];
  hasEmbeddedSections: boolean; // true if at least one land includes embedded sections

  /** React Query state (for the fetch path) */
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;

  /** Whether data came from "detail" (no fetch) or "api" (fetched) */
  source: "detail" | "api";
};

/**
 * Returns lands for a farmer. If `landsFromDetail` is provided and not empty,
 * the hook will use those and skip the API call, unless `forceFetch` is true.
 */
export function useFarmerLands({
  farmerId,
  landsFromDetail,
  forceFetch = false,
  enabled = true,
}: UseFarmerLandsProps): UseFarmerLandsResult {
  const canUseDetail = Boolean(
    !forceFetch &&
      landsFromDetail &&
      Array.isArray(landsFromDetail) &&
      (landsFromDetail as any[]).length > 0
  );

  const query = useQuery({
    queryKey: farmerId
      ? qkFarmerLandsByFarmer(farmerId)
      : ["farmerLands", "byFarmer", "empty"],
    queryFn: ({ signal }) => getFarmerLands(farmerId as string, { signal }),
    enabled: enabled && Boolean(farmerId) && !canUseDetail,
    retry: 1,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const lands = useMemo<(FarmerLandLite | FarmerLandDetail)[]>(() => {
    if (canUseDetail)
      return (landsFromDetail as (FarmerLandLite | FarmerLandDetail)[]) ?? [];
    const apiItems = query.data?.items ?? [];
    return apiItems;
  }, [canUseDetail, landsFromDetail, query.data]);

  const { landsCount, sectionsCount, landIds, hasEmbeddedSections } =
    useMemo(() => {
      const ids: FarmerLandId[] = [];
      let sCount = 0;
      let hasEmbedded = false;

      for (const land of lands) {
        // @ts -expect-error: _id is required by schema for fetched DTOs
        if (land?._id) ids.push(land._id as FarmerLandId);

        // If this is a detail land with embedded sections
        const maybeSections = (land as FarmerLandDetail).sections;
        if (Array.isArray(maybeSections)) {
          hasEmbedded = true;
          sCount += (maybeSections as FarmerSection[]).length;
        }
      }

      return {
        landsCount: lands.length,
        sectionsCount: sCount,
        landIds: ids,
        hasEmbeddedSections: hasEmbedded,
      };
    }, [lands]);

  return {
    lands,
    landsCount,
    sectionsCount,
    landIds,
    hasEmbeddedSections,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
    source: canUseDetail ? "detail" : "api",
  };
}
