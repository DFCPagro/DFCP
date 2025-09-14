// src/api/jobApplications.ts
import { api } from "./config";
import type {
  JobApplicationCreateInput,
  JobApplicationDTO,
} from "@/types/jobApplications";

/** POST /job-applications (auth required) */
export async function createJobApplication(
  payload: JobApplicationCreateInput
): Promise<JobApplicationDTO> {
  const { data } = await api.post<JobApplicationDTO>("/jobApp", payload);
  return data;
}
