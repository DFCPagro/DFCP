// services/jobApplication.service.ts
import mongoose, { FilterQuery } from "mongoose";
import ApiError from "../utils/ApiError";
import logger from "../config/logger";
import {
  jobApplicationStatuses,
  jobApplicationRoles,
  JOB_APP_ALLOWED_TRANSITIONS,
} from "../utils/constants";
import JobApplication,
{
  JobApplicationBase,
  JobApplicationBaseDoc,
  DelivererApplication,
  IndustrialDelivererApplication,
  FarmerApplication,
  PickerApplication,
  SorterApplication,
} from "../models/jobApplication.model";
import { promoteFarmerApplication, promoteDelivererApplication } from "./promotion.service";

/** =========================
 * Types
 * ======================= */

export type JobApplicationStatus = (typeof jobApplicationStatuses)[number];
export type JobApplicationRole = (typeof jobApplicationRoles)[number];

export interface ListFilters {
  role?: JobApplicationRole;
  status?: JobApplicationStatus;
  user?: string;              // userId (ObjectId string)
  logisticCenterId?: string;  // ObjectId string
  from?: string;              // ISO date
  to?: string;                // ISO date
}

export interface ListOptions {
  page?: number;
  limit?: number;
  sort?: "-createdAt" | "createdAt" | "-updatedAt" | "updatedAt" | "-status" | "status";
  includeUser?: boolean;
}

export interface CreateApplicationInput {
  userId: string;                   // ObjectId string
  appliedRole: JobApplicationRole;
  logisticCenterId?: string | null; // ObjectId string or null
  applicationData: Record<string, any>;
}

export interface UpdateApplicationDataInput {
  id: string;       // application id
  userId: string;   // owner id
  applicationData: Record<string, any>;
}

export interface UpdateStatusInput {
  id: string;
  actorId: string; // who changed it (for audit/logging)
  toStatus: JobApplicationStatus;
  note?: string;
}

export interface UpdateMetaInput {
  id: string;
  logisticCenterId?: string | null; // ObjectId string or null
}

export interface PublicJobApplicationDTO {
  id: string;
  user: string | { id: string; name?: string; email?: string; role?: string } | undefined;
  appliedRole: JobApplicationRole;
  logisticCenterId: string | null; // public as string|null
  status: JobApplicationStatus;
  applicationData: Record<string, any> | undefined;
  createdAt: Date;
  updatedAt: Date;
}

/** =========================
 * Helpers
 * ======================= */

const SORT_WHITELIST = new Set([
  "-createdAt",
  "createdAt",
  "-updatedAt",
  "updatedAt",
  "-status",
  "status",
]);

/** Centralized map from constants for transitions */
function canTransition(from: JobApplicationStatus, to: JobApplicationStatus): boolean {
  if (from === to) return true; // no-op allowed
  const allowed = JOB_APP_ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/** Consistent public mapper */
export function toPublicJobApplication(
  doc: JobApplicationBaseDoc & { userInfo?: any },
  opts?: { includeUser?: boolean }
): PublicJobApplicationDTO {
  const base: PublicJobApplicationDTO = {
    id: String(doc._id),
    user: String(doc.user),
    appliedRole: doc.appliedRole as JobApplicationRole,
    logisticCenterId: doc.logisticCenterId ? String(doc.logisticCenterId) : null,
    status: doc.status as JobApplicationStatus,
    applicationData: (doc as any).applicationData,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };

  if (opts?.includeUser && (doc as any).userInfo) {
    const u = (doc as any).userInfo;
    base.user = {
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
    };
  }

  return base;
}

/** Choose correct discriminator (for role validity checks) */
function getDiscriminatorModel(role: JobApplicationRole) {
  switch (role) {
    case "deliverer":            return DelivererApplication;
    case "industrialDeliverer":  return IndustrialDelivererApplication;
    case "farmer":               return FarmerApplication;
    case "picker":               return PickerApplication;
    case "sorter":               return SorterApplication;
    default:                     return JobApplication;
  }
}

/** Employment gate stub */
async function employmentGateHasRole(userId: string, role: JobApplicationRole): Promise<boolean> {
  // TODO: implement when you have actual user/role linkage
  return false;
}

/** =========================
 * Service functions
 * ======================= */

export async function createApplication(input: CreateApplicationInput): Promise<PublicJobApplicationDTO> {
  let { userId, appliedRole, logisticCenterId, applicationData } = input;

  // Normalize blank-ish center to null
  if (
    logisticCenterId === undefined ||
    logisticCenterId === null ||
    logisticCenterId === "" ||
    logisticCenterId === "null"
  ) {
    logisticCenterId = null;
  }

  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }
  if (logisticCenterId && !mongoose.isValidObjectId(logisticCenterId)) {
    throw new ApiError(400, "Invalid logisticCenterId");
  }

  if (await employmentGateHasRole(userId, appliedRole)) {
    throw new ApiError(409, "You already hold this role and cannot apply again.");
  }

  // Validate role against discriminator set
  const Model = getDiscriminatorModel(appliedRole);
  if (!Model) throw new ApiError(400, "Invalid appliedRole");

  try {
    const doc = await JobApplication.create({
      user: new mongoose.Types.ObjectId(userId),
      appliedRole,
      logisticCenterId: logisticCenterId ? new mongoose.Types.ObjectId(logisticCenterId) : null,
      status: "pending",
      applicationData,
    });

    return toPublicJobApplication(doc as JobApplicationBaseDoc);
  } catch (err: any) {
    if (err?.code === 11000) {
      // e.g., unique index for (user, appliedRole, open-status) if you added it
      throw new ApiError(409, "You already have an open application for this role.");
    }
    if (err?.name === "CastError" && err?.path === "_id") {
      throw new ApiError(400, "Invalid identifier provided");
    }
    throw err;
  }
}

export async function getById(id: string, opts?: { includeUser?: boolean }): Promise<PublicJobApplicationDTO> {
  const q = JobApplication.findById(id);
  if (opts?.includeUser) q.populate("userInfo", "name email role");
  const doc = await q.exec();
  if (!doc) throw new ApiError(404, "Application not found");
  return toPublicJobApplication(doc as JobApplicationBaseDoc, { includeUser: !!opts?.includeUser });
}

export async function listApplications(
  filters: ListFilters,
  options: ListOptions = {}
): Promise<{ items: PublicJobApplicationDTO[]; page: number; limit: number; total: number }> {
  const { role, status, user, logisticCenterId, from, to } = filters;

  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 20)));
  const sortParam = options.sort && SORT_WHITELIST.has(options.sort) ? options.sort : "-createdAt";

  const query: FilterQuery<JobApplicationBase> = {};
  if (role)  query.appliedRole = role;
  if (status) query.status = status;
  if (user) {
    if (!mongoose.isValidObjectId(user)) throw new ApiError(400, "Invalid user filter");
    query.user = new mongoose.Types.ObjectId(user);
  }
  if (logisticCenterId) {
    if (!mongoose.isValidObjectId(logisticCenterId)) throw new ApiError(400, "Invalid logisticCenterId filter");
    query.logisticCenterId = new mongoose.Types.ObjectId(logisticCenterId);
  }

  if (from || to) {
    query.createdAt = {};
    if (from) (query.createdAt as any).$gte = new Date(from);
    if (to)   (query.createdAt as any).$lte = new Date(to);
  }

  const q = JobApplication.find(query);
  if (options.includeUser) q.populate("userInfo", "name email role");

  const [items, total] = await Promise.all([
    q.sort(sortParam as any).skip((page - 1) * limit).limit(limit).exec(),
    JobApplication.countDocuments(query).exec(),
  ]);

  return {
    items: items.map((d: any) => toPublicJobApplication(d as JobApplicationBaseDoc, { includeUser: !!options.includeUser })),
    page,
    limit,
    total,
  };
}

/** (Unused for now, kept for future if you re-enable "mine") */
export async function listMine(
  userId: string,
  filters: Omit<ListFilters, "user">,
  options: ListOptions = {}
): Promise<{ items: PublicJobApplicationDTO[]; page: number; limit: number; total: number }> {
  return listApplications({ ...filters, user: userId }, { ...options, includeUser: false });
}

export async function updateApplicationData(input: UpdateApplicationDataInput): Promise<PublicJobApplicationDTO> {
  const { id, userId, applicationData } = input;

  const doc = await JobApplication.findById(id).exec();
  if (!doc) throw new ApiError(404, "Application not found");

  if (String(doc.user) !== String(userId)) {
    throw new ApiError(403, "You do not have permission to update this application.");
  }

  if (!(doc.status === "pending" || doc.status === "contacted")) {
    throw new ApiError(400, `Cannot edit application in status '${doc.status}'.`);
  }

  (doc as any).applicationData = applicationData;

  await doc.save();
  return toPublicJobApplication(doc as JobApplicationBaseDoc);
}

export async function updateStatus(input: UpdateStatusInput): Promise<PublicJobApplicationDTO> {
  const { id, actorId, toStatus, note } = input;

  const doc = await JobApplication.findById(id).exec();
  if (!doc) throw new ApiError(404, "Application not found");

  const fromStatus = doc.status as JobApplicationStatus;
  if (!canTransition(fromStatus, toStatus)) {
    throw new ApiError(400, `Invalid status transition: ${fromStatus} → ${toStatus}`);
  }

  // Apply transition
  doc.status = toStatus;
  await doc.save();

  // 🔑 Promotion flow after APPROVED
  if (toStatus === "approved") {
    switch (doc.appliedRole) {
      case "farmer":
        await promoteFarmerApplication(doc as any);
        break;
      case "deliverer":
        await promoteDelivererApplication(doc as any);
        break;
      // TODO: add industrialDeliverer, picker, sorter handlers if/when you have them
    }
  }

  // Best-effort audit log
  try {
    logger.info("job-applications:status-change", {
      appId: String(doc._id),
      from: fromStatus,
      to: toStatus,
      by: actorId,
      note: note || undefined,
    });
  } catch {
    // no-op
  }

  return toPublicJobApplication(doc as any);
}

export async function updateMeta(input: UpdateMetaInput): Promise<PublicJobApplicationDTO> {
  const { id, logisticCenterId } = input;

  const doc = await JobApplication.findById(id).exec();
  if (!doc) throw new ApiError(404, "Application not found");

  // Store as ObjectId or null, per the model
  if (logisticCenterId) {
    if (!mongoose.isValidObjectId(logisticCenterId)) {
      throw new ApiError(400, "Invalid logisticCenterId");
    }
    doc.logisticCenterId = new mongoose.Types.ObjectId(logisticCenterId) as any;
  } else {
    doc.logisticCenterId = null as any;
  }

  await doc.save();
  return toPublicJobApplication(doc as JobApplicationBaseDoc);
}
