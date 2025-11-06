// src/pages/FarmerManager/FarmerList/hooks/useFarmerById.ts
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFarmerById, qkFarmerById } from "@/api/farmer";
import type {
  FarmerDetail,
  FarmerDetailResponse,
  FarmerLandDetail,
  FarmerLandLite,
} from "@/types/farmer";

export type UseFarmerByIdProps = {
  farmerId?: string | null;
  enabled?: boolean;
};

export type UseFarmerByIdResult = {
  /** Raw API response (parsed by Zod in api layer) */
  response?: FarmerDetailResponse;
  /** Main entity for the dialog */
  farmer?: FarmerDetail;

  /** Convenience derived values for UI */
  joinedAt?: string | Date;
  landsCount: number;
  sectionsCount: number;

  /** React Query state */
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

/**
 * Fetch a single farmer detail by id.
 * - Uses real API (`/farmers/:id`) via api/farmer.
 * - API already validates with Zod; hook simply exposes a typed, UI-friendly shape.
 */
export function useFarmerById({
  farmerId,
  enabled = true,
}: UseFarmerByIdProps): UseFarmerByIdResult {
  const isEnabled = enabled && Boolean(farmerId);

  const query = useQuery({
    queryKey: farmerId ? qkFarmerById(farmerId) : ["farmers", "byId", "empty"],
    queryFn: ({ signal }) => getFarmerById(farmerId as string, { signal }),
    enabled: isEnabled,
    retry: 1,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const response = query.data;
  const farmer = response?.farmer;

  // Derived counts (works whether lands are lite or fully populated)
  const { landsCount, sectionsCount } = useMemo(() => {
    const lands = farmer?.lands ?? [];
    const lCount = lands?.length ?? 0;

    // If lands are detailed, they may include embedded sections
    const sCount = (lands ?? []).reduce((acc, land) => {
      const detail = land as FarmerLandDetail;
      const lite = land as FarmerLandLite;
      if (Array.isArray((detail as any).sections)) {
        return acc + ((detail.sections ?? []).length || 0);
      }
      // If lite (ids only) you could count strings here if your BE returns them,
      // but our lite schema uses "undefined" sections by design.
      if (Array.isArray((lite as any).sections)) {
        return acc + ((lite as any).sections?.length || 0);
      }
      return acc;
    }, 0);

    return { landsCount: lCount, sectionsCount: sCount };
  }, [farmer?.lands]);

  const joinedAt = farmer?.createdAt;

  return {
    response,
    farmer,
    joinedAt,
    landsCount,
    sectionsCount,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
  };
}
