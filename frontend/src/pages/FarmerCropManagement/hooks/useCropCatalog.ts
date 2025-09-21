// src/pages/FarmerCropManagement/hooks/useCropCatalog.ts
// Loads the crop catalog for the AddCrop form dropdown.
// Works with fake or real API via /src/api/farmerCrops.ts

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import farmerCropsApi from "@/api/farmerCrops";
import type { CatalogItemDTO } from "@/types/agri";

export type UseCropCatalogResult = {
  /** Full catalog list (empty while loading/if none) */
  catalog: CatalogItemDTO[];
  /** Quick lookup by id */
  catalogById: Map<string, CatalogItemDTO>;
  /** Convenience options for a Select component */
  selectOptions: Array<{ value: string; label: string; imageUrl?: string | null }>;

  // TanStack Query passthrough
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => Promise<any>;
};

export function useCropCatalog(): UseCropCatalogResult {
  const query = useQuery({
    queryKey: farmerCropsApi.keys.catalogCrops(),
    queryFn: farmerCropsApi.listCropCatalog,
    staleTime: 5 * 60_000, // 5 minutes; catalog changes rarely
  });

  const catalog = query.data ?? [];

  const catalogById = useMemo(
    () => new Map(catalog.map((c) => [c.id, c] as const)),
    [catalog]
  );

  const selectOptions = useMemo(
    () =>
      catalog.map((c) => ({
        value: c.id,
        label: c.name,
        imageUrl: c.imageUrl ?? null,
      })),
    [catalog]
  );

  return {
    catalog,
    catalogById,
    selectOptions,

    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export default useCropCatalog;
