// controllers/jobApplication.controller.ts
import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import {
  createApplication,
  getById,
  listApplications,
  listMine,
  updateApplicationData,
  updateStatus,
  updateMeta,
} from "../services/jobApplication.service";

/** Utils */
function isStaffOrAdmin(role?: string) {
  return role === "admin" || role === "staff";
}

function getUserId(req: Request): string {
  // Assumes your authenticate middleware attaches { id, role, ... } to req.user
  const u = (req as any).user;
  if (!u?.id) throw new ApiError(401, "Unauthorized");
  return String(u.id);
}

function getUserRole(req: Request): string | undefined {
  const u = (req as any).user;
  return u?.role ? String(u.role) : undefined;
}

/** ---------------------------
 *  POST /job-applications
 *  (applicant)
 * -------------------------- */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
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
 *  GET /job-applications/mine
 *  (applicant)
 * -------------------------- */
export async function mine(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);

    const {
      role,
      status,
      logisticCenterId,
      from,
      to,
      page = "1",
      limit = "20",
      sort = "-createdAt",
    } = req.query as Record<string, string | undefined>;

    const { items, total } = await listMine(
      userId,
      {
        role: role as any,
        status: status as any,
        logisticCenterId,
        from,
        to,
      },
      {
        page: Number(page),
        limit: Number(limit),
        sort: sort as any,
        includeUser: false,
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
 *  GET /job-applications
 *  (staff/admin)
 * -------------------------- */
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const role = getUserRole(req);
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
 *  GET /job-applications/:id
 *  (owner or staff/admin)
 * -------------------------- */
export async function read(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const role = getUserRole(req);
    const { id } = req.params;
    const includeUser = isStaffOrAdmin(role) && req.query.includeUser === "true";

    const dto = await getById(id, { includeUser });

    // owner / staff-admin check
    if (!isStaffOrAdmin(role) && String(dto.user) !== String(userId)) {
      throw new ApiError(403, "Forbidden");
    }

    res.json(dto);
  } catch (err) {
    next(err);
  }
}

/** ---------------------------
 *  PATCH /job-applications/:id
 *  (owner, pending/contacted only)
 *  Only applicationData is allowed (validated at route level)
 * -------------------------- */
export async function patchApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { applicationData } = req.body || {};

    const dto = await updateApplicationData({
      id,
      userId,
      applicationData,
    });

    res.json(dto);
  } catch (err) {
    next(err);
  }
}

/** ---------------------------
 *  PATCH /job-applications/:id/status
 *  (staff/admin)
 * -------------------------- */
export async function patchStatusCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const role = getUserRole(req);
    if (!isStaffOrAdmin(role)) throw new ApiError(403, "Forbidden");

    const actorId = getUserId(req);
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
 *  PATCH /job-applications/:id/meta
 *  (staff/admin) — e.g., logisticCenterId
 * -------------------------- */
export async function patchMetaCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const role = getUserRole(req);
    if (!isStaffOrAdmin(role)) throw new ApiError(403, "Forbidden");

    const { id } = req.params;
    const { logisticCenterId } = req.body || {};

    const dto = await updateMeta({
      id,
      logisticCenterId: logisticCenterId ?? null,
    });

    res.json(dto);
  } catch (err) {
    next(err);
  }
}

export default {
  create,
  mine,
  listAll,
  read,
  patchApplication,
  patchStatusCtrl,
  patchMetaCtrl,
};
