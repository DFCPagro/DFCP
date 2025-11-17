// src/controllers/schedule.controller.ts
import { Request, Response } from "express";
import { Types } from "mongoose";
import ApiError from "../utils/ApiError";
// If you want stronger typing for roles, you can uncomment this and adjust names:
// import { Role } from "../utils/constants";

import {
  addMonthlySchedule,
  updateMonthlySchedule,
  getScheduleForUserMonth,
  getScheduleByUserId as getScheduleByUserIdService,
  getScheduleByRoleAndDate as getScheduleByRoleAndDateService,
  getWorkersForShift as getWorkersForShiftService,
  type ScheduleType,
} from "../services/schedule.service";

// Adjust these to match your real manager roles
const MANAGER_ROLES = [
  "admin",
  "fManager",
  "tManager",
  "opManager",
] as string[];

function getAuthUser(req: Request) {
  return (req as any).user || {};
}

function getAuthUserId(req: Request): string {
  const user = getAuthUser(req);
  return user._id?.toString?.() || user.id?.toString?.();
}

function isManager(req: Request): boolean {
  const user = getAuthUser(req);
  const role = user.role as string | undefined;
  return !!role && MANAGER_ROLES.includes(role);
}

/* -------------------------------------------------------------------------- */
/*                         POST /schedule/month  (add)                        */
/* -------------------------------------------------------------------------- */

export async function postAddMonthlySchedule(req: Request, res: Response) {
  try {
    const authUser = getAuthUser(req);
    const authUserId = getAuthUserId(req);
    if (!authUserId) throw new ApiError(401, "Unauthorized");

    const manager = isManager(req);
    if (!manager) {
      const userId = req.body.userId as string | undefined;
      const logisticCenterId = req.body.logisticCenterId as string | undefined;
      const role = req.body.role as string | undefined;
      const { month, scheduleType, bitmap, overwriteExisting } = req.body as {
        month?: string;
        scheduleType?: ScheduleType;
        bitmap?: number[];
        overwriteExisting?: boolean;
      };

      if (!month || !scheduleType || !bitmap) {
        throw new ApiError(
          400,
          "month, scheduleType and bitmap are required in body"
        );
      }

      const data = await addMonthlySchedule({
        userId: userId ?? authUserId,
        role: role ?? (authUser.role as string),
        logisticCenterId: logisticCenterId ?? null,
        month,
        scheduleType,
        bitmap,
        overwriteExisting: !!overwriteExisting,
      });

      return res.status(201).json({ data });
    } else {
      const {
        month,
        scheduleType,
        bitmap,
        userId: bodyUserId,
        logisticCenterId: bodyLcId,
        role: workerRoleFromBody,
        overwriteExisting,
      } = req.body as {
        month?: string;
        scheduleType?: ScheduleType;
        bitmap?: number[];
        userId?: string;
        logisticCenterId?: string;
        role?: string;
        overwriteExisting?: boolean;
      };

      if (!month || !scheduleType || !bitmap) {
        throw new ApiError(
          400,
          "month, scheduleType and bitmap are required in body"
        );
      }

      // Decide whose schedule we are modifying
      const targetUserId =
        manager && bodyUserId ? bodyUserId : (authUserId as string);

      // Decide which role is associated with this schedule
      // - Normal user: use their own role
      // - Manager: can optionally send workerRole in body (recommended)
      const workerRole = manager
        ? workerRoleFromBody || (authUser.role as string)
        : (authUser.role as string);

      if (!workerRole) {
        throw new ApiError(
          400,
          "Cannot determine worker role for schedule; provide role in body"
        );
      }

      // Resolve LC:
      // - Manager can override via body.logisticCenterId
      // - Otherwise, we fall back to user's lc from token (if any)
      const lcFromToken = authUser.logisticCenterId
        ? authUser.logisticCenterId.toString()
        : undefined;

      const logisticCenterId = manager ? bodyLcId || lcFromToken : lcFromToken;

      const data = await addMonthlySchedule({
        userId: targetUserId,
        role: workerRole,
        logisticCenterId: logisticCenterId ?? null,
        month,
        scheduleType,
        bitmap,
        overwriteExisting: !!overwriteExisting,
      });

      return res.status(201).json({ data });
    }
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("[postAddMonthlySchedule] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}

/* -------------------------------------------------------------------------- */
/*                       PATCH /schedule/month  (update)                      */
/* -------------------------------------------------------------------------- */

export async function patchUpdateMonthlySchedule(req: Request, res: Response) {
  try {
    const authUser = getAuthUser(req);
    const authUserId = getAuthUserId(req);
    if (!authUserId) throw new ApiError(401, "Unauthorized");

    const manager = isManager(req);
    const {
      month,
      scheduleType,
      bitmap,
      userId: bodyUserId,
      logisticCenterId: bodyLcId,
    } = req.body as {
      month?: string;
      scheduleType?: ScheduleType;
      bitmap?: number[];
      userId?: string;
      logisticCenterId?: string;
    };

    if (!month || !scheduleType || !bitmap) {
      throw new ApiError(
        400,
        "month, scheduleType and bitmap are required in body"
      );
    }

    const targetUserId = manager && bodyUserId ? bodyUserId : authUserId;

    const lcFromToken = authUser.logisticCenterId
      ? authUser.logisticCenterId.toString()
      : undefined;

    const logisticCenterId = manager ? bodyLcId || lcFromToken : lcFromToken;

    const data = await updateMonthlySchedule({
      userId: targetUserId,
      logisticCenterId: logisticCenterId ?? null,
      month,
      scheduleType,
      bitmap,
      canBypassTwoWeekRule: manager,
      // tz param: you can derive from LC / user if needed; default handled in service
    });

    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("[patchUpdateMonthlySchedule] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}

/* -------------------------------------------------------------------------- */
/*                     GET /schedule/my?month=YYYY-MM                         */
/* -------------------------------------------------------------------------- */

export async function getMySchedule(req: Request, res: Response) {
  try {
    const authUser = getAuthUser(req);
    const authUserId = getAuthUserId(req);
    if (!authUserId) throw new ApiError(401, "Unauthorized");

    const month = (req.query.month as string | undefined) || undefined;
    if (!month) {
      throw new ApiError(400, "Query param 'month' (YYYY-MM) is required");
    }

    const lcFromToken = authUser.logisticCenterId
      ? authUser.logisticCenterId.toString()
      : undefined;

    const data = await getScheduleForUserMonth({
      userId: authUserId,
      logisticCenterId: lcFromToken ?? null,
      month,
    });

    // NOTE: if you also want to attach shift windows from ShiftConfig,
    // you can query that here and extend "data" before returning.

    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("[getMySchedule] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}

/* -------------------------------------------------------------------------- */
/*           GET /schedule/user/:userId?month=YYYY-MM  (manager)              */
/* -------------------------------------------------------------------------- */

export async function getScheduleByUserId(req: Request, res: Response) {
  try {
    const authUser = getAuthUser(req);
    const authUserId = getAuthUserId(req);
    if (!authUserId) throw new ApiError(401, "Unauthorized");

    const { userId } = req.params;
    const month = req.query.month as string | undefined;

    if (!userId) {
      throw new ApiError(400, "Param 'userId' is required");
    }

    const manager = isManager(req);

    // Non-managers may only see their own schedule through this endpoint
    if (!manager && userId !== authUserId) {
      throw new ApiError(403, "Forbidden");
    }

    if (!Types.ObjectId.isValid(userId)) {
      throw new ApiError(400, "Invalid userId");
    }

    const data = await getScheduleByUserIdService({
      userId,
      month,
    });

    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("[getScheduleByUserId] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}

/* -------------------------------------------------------------------------- */
/*         GET /schedule/by-role?role=&date=&logisticCenterId=               */
/* -------------------------------------------------------------------------- */

export async function getScheduleByRoleAndDate(req: Request, res: Response) {
  try {
    const authUser = getAuthUser(req);
    const authUserId = getAuthUserId(req);
    if (!authUserId) throw new ApiError(401, "Unauthorized");

    if (!isManager(req)) {
      throw new ApiError(403, "Only managers can view schedules by role");
    }

    const role = req.query.role as string | undefined;
    const date = req.query.date as string | undefined; // YYYY-MM-DD
    const lcFromQuery = req.query.logisticCenterId as string | undefined;

    if (!role || !date) {
      throw new ApiError(
        400,
        "Query params 'role' and 'date' (YYYY-MM-DD) are required"
      );
    }

    const lcFromToken = authUser.logisticCenterId
      ? authUser.logisticCenterId.toString()
      : undefined;

    const logisticCenterId = lcFromQuery || lcFromToken;
    if (!logisticCenterId) {
      throw new ApiError(
        400,
        "logisticCenterId must be provided either in query or via user context"
      );
    }

    const data = await getScheduleByRoleAndDateService({
      role,
      date,
      logisticCenterId,
    });

    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("[getScheduleByRoleAndDate] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}

/* -------------------------------------------------------------------------- */
/*  GET /schedule/workers?role=&shift=&date=&scheduleType=&logisticCenterId= */
/* -------------------------------------------------------------------------- */

export async function getWorkersForShift(req: Request, res: Response) {
  try {
    const authUser = getAuthUser(req);
    const authUserId = getAuthUserId(req);
    if (!authUserId) throw new ApiError(401, "Unauthorized");

    if (!isManager(req)) {
      throw new ApiError(403, "Only managers can view workers for shift");
    }

    const role = req.query.role as string | undefined;
    const shiftName = req.query.shift as string | undefined;
    const date = req.query.date as string | undefined; // YYYY-MM-DD
    const scheduleType = req.query.scheduleType as ScheduleType | undefined;
    const lcFromQuery = req.query.logisticCenterId as string | undefined;

    if (!role || !shiftName || !date || !scheduleType) {
      throw new ApiError(
        400,
        "Query params 'role', 'shift', 'date' (YYYY-MM-DD) and 'scheduleType' are required"
      );
    }

    const lcFromToken = authUser.logisticCenterId
      ? authUser.logisticCenterId.toString()
      : undefined;

    const logisticCenterId = lcFromQuery || lcFromToken;
    if (!logisticCenterId) {
      throw new ApiError(
        400,
        "logisticCenterId must be provided either in query or via user context"
      );
    }

    const data = await getWorkersForShiftService({
      role,
      shiftName,
      date,
      scheduleType,
      logisticCenterId,
    });

    return res.status(200).json({ data });
  } catch (err: any) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error("[getWorkersForShift] error:", err);
    return res.status(500).json({ error: "ServerError" });
  }
}
