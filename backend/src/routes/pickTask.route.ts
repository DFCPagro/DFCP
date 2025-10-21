// FILE: src/routes/pickTask.routes.ts
import { Router } from "express";
import * as PickTaskController from "../controllers/pickTask.controller";
// If you have auth/roles, uncomment and adjust:
// import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /pick-tasks/_suggest?centerId=...
 * Returns the best (lowest-crowd) task suggestion or null.
 */
router.get(
  "/_suggest",
  // requireAuth,
  // requireRole(["opManager", "picker", "admin"]),
  PickTaskController.suggestPickTask
);

/**
 * GET /pick-tasks/:id
 * Fetch one task (for UI/details).
 */
router.get(
  "/:id",
  // requireAuth,
  // requireRole(["opManager", "picker", "admin"]),
  PickTaskController.getById
);

/**
 * POST /pick-tasks/:id/start
 * Body: { userId: string }
 * Marks task in_progress, assigns to user, bumps crowd on involved shelves.
 */
router.post(
  "/:id/start",
  // requireAuth,
  // requireRole(["picker", "opManager", "admin"]),
  PickTaskController.startTask
);

/**
 * POST /pick-tasks/:id/complete
 * Marks task completed and releases crowd reservations.
 */
router.post(
  "/:id/complete",
  // requireAuth,
  // requireRole(["picker", "opManager", "admin"]),
  PickTaskController.completeTask
);

export default router;
