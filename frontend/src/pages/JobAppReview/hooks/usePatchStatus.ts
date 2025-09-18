// src/pages/JobAppReview/hooks/usePatchStatus.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchJobApplicationStatus } from "@/api/jobApplications";
import type {
  JobApplicationDTO,
  Paginated,
  PatchStatusPayload,
} from "@/types/jobApplications";

/**
 * Updates an application's status.
 * - Performs an optimistic UI update on list caches keyed by ['jobApps', ...]
 * - Rolls back on error
 * - Finally invalidates all 'jobApps' queries to ensure server truth
 */
export function usePatchStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: { id: string; payload: PatchStatusPayload }) => {
      const { id, payload } = args;
      return patchJobApplicationStatus(id, payload);
    },

    // Optimistic update: patch the item in any paginated 'jobApps' cache
    onMutate: async ({ id, payload }) => {
      await qc.cancelQueries({ queryKey: ["jobApps"] });

      const previousCaches: Array<{
        key: unknown[];
        data: Paginated<JobApplicationDTO> | undefined;
      }> = [];

      const matcher = { queryKey: ["jobApps"] as const };

      qc.getQueryCache()
        .findAll(matcher)
        .forEach((q) => {
          const key = q.queryKey as unknown[];
          const data = qc.getQueryData<Paginated<JobApplicationDTO>>(key);
          previousCaches.push({ key, data });

          if (!data) return;

          const patched: Paginated<JobApplicationDTO> = {
            ...data,
            items: data.items.map((it) =>
              it.id === id
                ? {
                    ...it,
                    status: payload.status,
                    // let server be source of truth for timestamps; we don't fake createdAt/updatedAt here
                  }
                : it
            ),
          };

          qc.setQueryData(key, patched);
        });

      // context for rollback
      return { previousCaches };
    },

    // Rollback on error
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previousCaches) return;
      for (const { key, data } of ctx.previousCaches) {
        qc.setQueryData(key, data);
      }
    },

    // Ensure server-truth after mutation settles
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["jobApps"] });
    },
  });
}
