import { useMutation, useQueryClient } from "@tanstack/react-query";
import farmerCropsApi from "@/api/farmerCrops";
import type { CreateSectionInput, SectionDTO } from "@/types/agri";

export type UseCreateSectionResult = {
  createSection: (input: CreateSectionInput) => Promise<SectionDTO>;
  isPending: boolean;
  error: unknown;
  reset: () => void;
};

export default function useCreateSection(
  landId: string | null | undefined,
  options?: {
    onSuccess?: (section: SectionDTO) => void;
    onError?: (err: unknown) => void;
  }
): UseCreateSectionResult {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: CreateSectionInput) => {
      if (!landId) throw new Error("No land selected.");
      return farmerCropsApi.createSection(landId, input);
    },
    onSuccess: async (section) => {
      if (landId) {
        await qc.invalidateQueries({ queryKey: farmerCropsApi.keys.sections(landId) });
      }
      options?.onSuccess?.(section);
    },
    onError: (err) => {
      options?.onError?.(err);
    },
  });

  return {
    createSection: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
