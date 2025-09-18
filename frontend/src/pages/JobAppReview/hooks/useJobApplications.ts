// src/pages/JobAppReview/hooks/useJobApplications.ts
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { listJobApplications } from "@/api/jobApplications";
import type {
  JobApplicationDTO,
  ListJobApplicationsParams,
  Paginated,
} from "@/types/jobApplications";

/** Normalize params for a stable React Query key */
function toIso(v: string | Date | undefined): string | undefined {
  if (v == null) return undefined;
  return v instanceof Date ? v.toISOString() : v;
}

function prune<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete (out as any)[k];
  }
  return out;
}

/** Build a stable query key segment from list params */
function buildKeyParams(params: ListJobApplicationsParams) {
  return prune({
    role: params.role,
    status: params.status,
    user: params.user,
    logisticCenterId: params.logisticCenterId,
    from: toIso(params.from),
    to: toIso(params.to),
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    sort: params.sort ?? "-createdAt",
    includeUser: params.includeUser ?? true,
  });
}

export function useJobApplications(
  params: ListJobApplicationsParams
): UseQueryResult<Paginated<JobApplicationDTO>> {
  const keyParams = buildKeyParams(params);

  return useQuery({
    queryKey: ["jobApps", keyParams],
    queryFn: () => listJobApplications(keyParams),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}
