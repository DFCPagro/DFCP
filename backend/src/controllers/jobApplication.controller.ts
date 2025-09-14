// controllers/jobApplication.controller.ts
import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import {
  createApplication,
  getById,
  listApplications,
  updateStatus,
  updateMeta,
} from "../services/jobApplication.service";

/** ---------------------------
 *  Helpers
 * -------------------------- */
function isStaffOrAdmin(role?: string) {
  return role === "admin" || role === "staff";
}

function getUser(req: Request): { id: string; role?: string } {
  const u = (req as any).user;
  if (!u?.id) throw new ApiError(401, "Unauthorized");
  return { id: String(u.id), role: u.role ? String(u.role) : undefined };
}

/** ---------------------------
 *  POST /api/job-applications
 *  (applicant creates)
 * -------------------------- */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: userId } = getUser(req);
    const { appliedRole, logisticCenterId, applicationData } = req.body || {};

    const dto = await createApplication({
      userId,
      appliedRole,
      logisticCenterId,
      applicationData,
    });

    res.status(201).json(dto);
  } catch (err) {
    next(err);
  }
}

/** ---------------------------
 *  GET /api/admin/job-applications
 *  (admin/staff list with filters)
 * -------------------------- */
export async function adminList(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = getUser(req);
    if (!isStaffOrAdmin(role)) throw new ApiError(403, "Forbidden");

    const {
      role: appliedRole,
      status,
      user,
      logisticCenterId,
      from,
      to,
      page = "1",
      limit = "20",
      sort = "-createdAt",
      includeUser = "false",
    } = req.query as Record<string, string | undefined>;

    const { items, total } = await listApplications(
      {
        role: appliedRole as any,
        status: status as any,
        user,
        logisticCenterId,
        from,
        to,
      },
      {
        page: Number(page),
        limit: Number(limit),
        sort: sort as any,
        includeUser: includeUser === "true",
      }
    );

    res.json({
      items,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      total,
    });
  } catch (err) {
    next(err);
  }
}

/** ---------------------------
 *  GET /api/admin/job-applications/:id
 *  (admin/staff read single)
 * -------------------------- */
export async function adminRead(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = getUser(req);
    if (!isStaffOrAdmin(role)) throw new ApiError(403, "Forbidden");

    const { id } = req.params;
    const includeUser = req.query.includeUser === "true";

    const dto = await getById(id, { includeUser });
    res.json(dto);
  } catch (err) {
    next(err);
  }
}

/** ---------------------------
 *  PATCH /api/admin/job-applications/:id/status
 *  (admin/staff status change)
 * -------------------------- */
export async function adminPatchStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: actorId, role } = getUser(req);
    if (!isStaffOrAdmin(role)) throw new ApiError(403, "Forbidden");

    const { id } = req.params;
    const { status: toStatus, note } = req.body || {};

    const dto = await updateStatus({
      id,
      actorId,
      toStatus,
      note,
    });

    res.json(dto);
  } catch (err) {
    next(err);
  }
}

/** ---------------------------
 *  PATCH /api/admin/job-applications/:id
 *  (admin/staff meta updates — e.g., center)
 *  Note: status changes must go through /:id/status
 * -------------------------- */
export async function adminPatchMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = getUser(req);
    if (!isStaffOrAdmin(role)) throw new ApiError(403, "Forbidden");

    const { id } = req.params;
    const { logisticCenterId = null } = req.body || {};

    const dto = await updateMeta({
      id,
      logisticCenterId,
    });

    res.json(dto);
  } catch (err) {
    next(err);
  }
}

/** Grouped default export for cleaner imports */
export default {
  create,
  adminList,
  adminRead,
  adminPatchStatus,
  adminPatchMeta,
};
