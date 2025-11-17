// src/routes/schedule.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/schedule.controller";

const router = Router();

// All routes require auth
router.use(authenticate);

/**
 * POST /api/v1/schedule/month
 * - Add a monthly schedule (active / standby)
 * - Normal users: for themselves only
 * - Managers: can target other users / LCs (controller handles logic)
 */
router.post("/month", ctrl.postAddMonthlySchedule);

/**
 * PATCH /api/v1/schedule/month
 * - Update existing monthly schedule
 * - Manager-only (controller also enforces)
 */
router.patch(
  "/month",
  authorize("admin", "fManager", "tManager", "opManager"),
  ctrl.patchUpdateMonthlySchedule
);

/**
 * GET /api/v1/schedule/my?month=YYYY-MM
 * - Get own schedule (active + standby) for a month
 */
router.get("/my", ctrl.getMySchedule);

/**
 * GET /api/v1/schedule/user/:userId?month=YYYY-MM
 * - Manager view of a specific worker's schedule
 * - Controller also blocks non-managers from seeing others' schedules
 */
router.get(
  "/user/:userId",
  authorize("admin", "fManager", "tManager", "opManager"),
  ctrl.getScheduleByUserId
);

/**
 * GET /api/v1/schedule/by-role?role=&date=&logisticCenterId=
 * - Aggregated snapshot for all workers of a role on a given date in an LC
 */
router.get(
  "/by-role",
  authorize("admin", "fManager", "tManager", "opManager"),
  ctrl.getScheduleByRoleAndDate
);

/**
 * GET /api/v1/schedule/workers?role=&shift=&date=&scheduleType=&logisticCenterId=
 * - Workers assigned to a specific shift/date/LC (active or standby)
 */
router.get(
  "/workers",
  authorize("admin", "fManager", "tManager", "opManager"),
  ctrl.getWorkersForShift
);

export default router;
