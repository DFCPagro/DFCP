// services/jobApplication.service.ts
import mongoose, { FilterQuery } from "mongoose";
import ApiError from "../utils/ApiError";
import logger from "../config/logger";
import {
  jobApplicationStatuses,
  jobApplicationRoles,
} from "../utils/constants";
import JobApplication, {
  IJobApplicationBase,
  DelivererApplication,
  IndustrialDelivererApplication,
  FarmerApplication,
  PickerApplication,
  SorterApplication,
} from "../models/jobApplication.model";

/** =========================
 * Types
 * ======================= */

export type JobApplicationStatus = (typeof jobApplicationStatuses)[number];
export type JobApplicationRole = (typeof jobApplicationRoles)[number];

export interface ListFilters {
  role?: JobApplicationRole;
  status?: JobApplicationStatus;
  user?: string; // userId
  logisticCenterId?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
}

export interface ListOptions {
  page?: number;
  limit?: number;
  sort?: "-createdAt" | "createdAt" | "-updatedAt" | "updatedAt" | "-status" | "status";
  includeUser?: boolean;
}

export interface CreateApplicationInput {
  userId: string;
  appliedRole: JobApplicationRole;
  logisticCenterId?: string | null;
  applicationData: Record<string, any>;
}

export interface UpdateApplicationDataInput {
  id: string;
  userId: string; // owner
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
  logisticCenterId?: string | null;
}

export interface PublicJobApplicationDTO {
  id: string;
  user: string | { id: string; name?: string; email?: string; role?: string } | undefined;
  appliedRole: JobApplicationRole;
  logisticCenterId: string | null;
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

const isTerminal = (s: JobApplicationStatus) => s === "approved" || s === "denied";

/**
 * Allowed transitions we agreed on:
 * pending -> contacted | approved | denied
 * contacted -> approved | denied
 * No transitions out of approved/denied.
 */
function canTransition(from: JobApplicationStatus, to: JobApplicationStatus): boolean {
  if (from === to) return true; // no-op allowed (controller may avoid calling)
  switch (from) {
    case "pending":
      return to === "contacted" || to === "approved" || to === "denied";
    case "contacted":
      return to === "approved" || to === "denied";
    default:
      // approved/denied -> nowhere
      return false;
  }
}

/**
 * Consistent public mapper (mirrors toPublicUser pattern)
 */
export function toPublicJobApplication(
  doc: IJobApplicationBase & { userInfo?: any },
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

/**
 * Choose correct discriminator for create()
 */
function getDiscriminatorModel(role: JobApplicationRole) {
  switch (role) {
    case "deliverer":
      return DelivererApplication;
    case "industrialDeliverer":
      return IndustrialDelivererApplication;
    case "farmer":
      return FarmerApplication;
    case "picker":
      return PickerApplication;
    case "sorter":
      return SorterApplication;
    default:
      // Fallback to base - should not happen due to validation.
      return JobApplication;
  }
}

/**
 * Employment gate: block application if the user already holds that job/role.
 * NOTE: Implement your real checks here (e.g., DelivererProfile.findOne({ user: userId, active: true }))
 * For now, returns false (no block). Keep the function for easy future wiring.
 */
async function employmentGateHasRole(userId: string, role: JobApplicationRole): Promise<boolean> {
  // TODO: wire to your actual role/employee/profile collections.
  // Example:
  // if (role === "deliverer") return !!(await DelivererProfile.findOne({ user: userId, active: true }).lean());
  // if (role === "farmer") return !!(await FarmerProfile.findOne({ user: userId, active: true }).lean());
  return false;
}

/** =========================
 * Service functions
 * ======================= */

// services/jobApplication.service.ts (replace createApplication with this hardened version)
export async function createApplication(input: CreateApplicationInput): Promise<PublicJobApplicationDTO> {
  let { userId, appliedRole, logisticCenterId, applicationData } = input;

  // Normalize logisticCenterId: treat "", null, undefined, and "null" as null
  if (
    logisticCenterId === undefined ||
    logisticCenterId === null ||
    logisticCenterId === "" ||
    logisticCenterId === "null"
  ) {
    logisticCenterId = null;
  }

  // Validate IDs *before* constructing ObjectId
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }
  if (logisticCenterId && !mongoose.isValidObjectId(logisticCenterId)) {
    throw new ApiError(400, "Invalid logisticCenterId");
  }

  // Employment gate
  if (await employmentGateHasRole(userId, appliedRole)) {
    throw new ApiError(409, "You already hold this role and cannot apply again.");
  }

  // Pick discriminator model safely
  const Model = getDiscriminatorModel(appliedRole);
  if (!Model) {
    throw new ApiError(400, "Invalid appliedRole");
  }

  try {
    const doc = await JobApplication.create({
        user: new mongoose.Types.ObjectId(userId),
        appliedRole, // discriminatorKey
        logisticCenterId: logisticCenterId ? new mongoose.Types.ObjectId(logisticCenterId) : null,
        status: "pending",
        applicationData,
    });
    return toPublicJobApplication(doc);
} catch (err: any) {
    if (err?.code === 11000) {
      throw new ApiError(409, "You already have an open application for this role.");
    }
    // Helpful message if the failure was an ObjectId cast that slipped through
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
  return toPublicJobApplication(doc as any, { includeUser: !!opts?.includeUser });
}

export async function listApplications(
  filters: ListFilters,
  options: ListOptions = {}
): Promise<{ items: PublicJobApplicationDTO[]; page: number; limit: number; total: number }> {
  const {
    role,
    status,
    user,
    logisticCenterId,
    from,
    to,
  } = filters;

  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 20)));
  const sortParam = options.sort && SORT_WHITELIST.has(options.sort) ? options.sort : "-createdAt";

  const query: FilterQuery<IJobApplicationBase> = {};
  if (role) query.appliedRole = role;
  if (status) query.status = status;
  if (user) query.user = new mongoose.Types.ObjectId(user);
  if (logisticCenterId) query.logisticCenterId = new mongoose.Types.ObjectId(logisticCenterId);

  if (from || to) {
    query.createdAt = {};
    if (from) (query.createdAt as any).$gte = new Date(from);
    if (to) (query.createdAt as any).$lte = new Date(to);
  }

  const q = JobApplication.find(query);
  if (options.includeUser) q.populate("userInfo", "name email role");

  const [items, total] = await Promise.all([
    q.sort(sortParam as any)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec(),
    JobApplication.countDocuments(query).exec(),
  ]);

  return {
    items: items.map((d: any) => toPublicJobApplication(d, { includeUser: !!options.includeUser })),
    page,
    limit,
    total,
  };
}

export async function listMine(
  userId: string,
  filters: Omit<ListFilters, "user">,
  options: ListOptions = {}
): Promise<{ items: PublicJobApplicationDTO[]; page: number; limit: number; total: number }> {
  return listApplications(
    { ...filters, user: userId },
    { ...options, includeUser: false }
  );
}

export async function updateApplicationData(input: UpdateApplicationDataInput): Promise<PublicJobApplicationDTO> {
  const { id, userId, applicationData } = input;

  const doc = await JobApplication.findById(id).exec();
  if (!doc) throw new ApiError(404, "Application not found");

  // Ownership check
  if (String(doc.user) !== String(userId)) {
    throw new ApiError(403, "You do not have permission to update this application.");
  }

  // Status check: only pending/contacted
  if (!(doc.status === "pending" || doc.status === "contacted")) {
    throw new ApiError(400, `Cannot edit application in status '${doc.status}'.`);
  }

  // Only applicationData is editable (validators enforced at route level)
  (doc as any).applicationData = applicationData;

  await doc.save();
  return toPublicJobApplication(doc);
}

export async function updateStatus(input: UpdateStatusInput): Promise<PublicJobApplicationDTO> {
  const { id, actorId, toStatus, note } = input;

  const doc = await JobApplication.findById(id).exec();
  if (!doc) throw new ApiError(404, "Application not found");

  const fromStatus = doc.status as JobApplicationStatus;

  if (!canTransition(fromStatus, toStatus)) {
    throw new ApiError(
      400,
      `Invalid status transition: ${fromStatus} → ${toStatus}`
    );
  }

  // Apply
  doc.status = toStatus;

  // (Optional) If you later add statusHistory, push here:
  // (doc as any).statusHistory = (doc as any).statusHistory || [];
  // (doc as any).statusHistory.push({ from: fromStatus, to: toStatus, by: actorId, at: new Date(), note });

  await doc.save();

  // Logging for audits
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

  // Side-effects stub: on approved, you might emit an event to onboarding pipeline.
  // if (toStatus === "approved") { ... }

  return toPublicJobApplication(doc);
}

export async function updateMeta(input: UpdateMetaInput): Promise<PublicJobApplicationDTO> {
  const { id, logisticCenterId } = input;

  const doc = await JobApplication.findById(id).exec();
  if (!doc) throw new ApiError(404, "Application not found");

  doc.logisticCenterId = logisticCenterId ? new mongoose.Types.ObjectId(logisticCenterId) : null;

  await doc.save();
  return toPublicJobApplication(doc);
}
