// src/pages/AdminExpectedHarvest/hooks/useFarmerSectionHarvest.ts
import { useQuery } from "@tanstack/react-query";
import {
  fakeFetchFarmerSectionHarvest,
  type FarmerSectionHarvestRecord,
} from "@/api/fakes/farmerSectionHarvest";

/**
 * Thin wrapper over the fake dataset fetcher.
 * Keeps the API consistent with your other page-local hooks.
 */
export function useFarmerSectionHarvest() {
  const query = useQuery<FarmerSectionHarvestRecord[], Error>({
    queryKey: ["farmerSectionHarvest"],
    queryFn: fakeFetchFarmerSectionHarvest,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return query;
}
