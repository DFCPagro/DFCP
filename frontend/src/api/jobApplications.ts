// src/api/jobApplications.ts
import { api } from "./config";
import type { AxiosResponse } from "axios";
import type {
  JobApplicationDTO,
  ListJobApplicationsParams,
  Paginated,
  PatchStatusPayload,
  JobApplicationCreateInput,
} from "@/types/jobApplications";


function toIso(v: string | Date | undefined): string | undefined {
  if (v == null) return undefined;
  return v instanceof Date ? v.toISOString() : v;
}

// REPLACE prune with this
function prune<T extends object>(obj: T): T {
  const out = { ...(obj as any) } as Record<string, any>;
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }
  return out as T;
}


const BASE = "/jobApp";


/* =========================
 * API
 * ======================= */

/**
 * GET /job-applications/admin
 * List job applications with server-side pagination & filtering.
 */
export async function listJobApplications(
  params: ListJobApplicationsParams = {}
): Promise<Paginated<JobApplicationDTO>> {
  const query = prune({
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

  const { data }: AxiosResponse<Paginated<JobApplicationDTO>> = await api.get(
    `${BASE}/admin`,
    { params: query }
  );
  return data;
}

/**
 * PATCH /job-applications/admin/:id/status
 * Update application status (pending→contacted/approved/denied; contacted→approved/denied).
 */
export async function patchJobApplicationStatus(
  id: string,
  payload: PatchStatusPayload
): Promise<JobApplicationDTO> {
  const body = prune({
    status: payload.status,
    reviewerNotes: payload.reviewerNotes,
    contactedAt: toIso(payload.contactedAt),
    approvedAt: toIso(payload.approvedAt),
  });

  const { data }: AxiosResponse<JobApplicationDTO> = await api.patch(
    `${BASE}/admin/${id}/status`,
    body
  );
  return data;
}

/** POST /job-applications (auth required) */
// REPLACE only the create function
export async function createJobApplication(
  payload: JobApplicationCreateInput
): Promise<JobApplicationDTO> {
  const body = prune(payload); // drop top-level undefined; keep nulls
  const { data }: AxiosResponse<JobApplicationDTO> = await api.post(`${BASE}`, body);
  return data;
}

