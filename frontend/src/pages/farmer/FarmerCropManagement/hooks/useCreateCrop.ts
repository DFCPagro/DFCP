// src/pages/FarmerCropManagement/hooks/useCreateCrop.ts
// Creates a crop under a given section, then invalidates the land's sections query.
// - Works with fake or real API (via /src/api/farmerCrops.ts)
// - Designed to be awaited from the Drawer form: await createCrop(payload)

import { useMutation, useQueryClient } from "@tanstack/react-query";
import farmerCropsApi from "@/api/farmerCrops";
import type { CreateCropInput, SectionCropDTO } from "@/types/agri";

export type UseCreateCropResult = {
  /** Call this to create the crop; await it in your form submit handler */
  createCrop: (input: CreateCropInput) => Promise<SectionCropDTO>;
  /** React Query mutation state */
  isPending: boolean;
  error: unknown;
  reset: () => void;
};

export function useCreateCrop(
  sectionId: string | null | undefined,
  landId: string | null | undefined,
  options?: {
    onSuccess?: (crop: SectionCropDTO) => void;
    onError?: (err: unknown) => void;
  }
): UseCreateCropResult {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: CreateCropInput) => {
      if (!sectionId) throw new Error("No section selected.");
      // Minimal client-side guard; backend will validate again.
      if (!input?.itemId) throw new Error("Please select a crop item.");
      if (typeof input.plantedAmountGrams !== "number" || input.plantedAmountGrams <= 0) {
        throw new Error("Planted amount must be greater than zero.");
      }
      return farmerCropsApi.createSectionCrop(sectionId, input);
    },
    onSuccess: async (data) => {
      // Refresh sections for the selected land so the table updates
      if (landId) {
        await qc.invalidateQueries({ queryKey: farmerCropsApi.keys.sections(landId) });
      }
      options?.onSuccess?.(data);
    },
    onError: (err) => {
      options?.onError?.(err);
    },
  });

  return {
    createCrop: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export default useCreateCrop;
