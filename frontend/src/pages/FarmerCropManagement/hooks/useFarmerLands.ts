// src/pages/FarmerCropManagement/hooks/useFarmerLands.ts
// Fetches farmer lands via the farmerCrops API facade.
// - Works with either the fake or real API (controlled by VITE_USE_FAKE_FARMER_API)
// - Keeps return shape simple for the page/index to orchestrate selection

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import farmerCropsApi from "@/api/farmerCrops";
import type { LandDTO } from "@/types/agri";

export type UseFarmerLandsResult = {
  /** Array of lands (empty when none or while loading) */
  lands: LandDTO[];
  /** Quick lookup by id */
  landsById: Map<string, LandDTO>;
  /** Convenience flag */
  hasLands: boolean;

  // TanStack Query passthrough
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => Promise<any>;
};

export function useFarmerLands(): UseFarmerLandsResult {
  const query = useQuery({
    queryKey: farmerCropsApi.keys.lands(),
    queryFn: farmerCropsApi.listLands,
    // Keep lands reasonably fresh; tune later if needed
    staleTime: 60_000,
  });

  const lands = query.data ?? [];

  const landsById = useMemo(() => {
    return new Map(lands.map((l) => [l.id, l]));
  }, [lands]);

  return {
    lands,
    landsById,
    hasLands: lands.length > 0,

    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export default useFarmerLands;
