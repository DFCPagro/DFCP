import { Router } from "express";
import * as ctrl from "../controllers/deliverer.controller";
import { authenticate, authorize } from "../middlewares/auth";
import type { Role } from "../utils/constants";

const MANAGER_ROLES: Role[] = ["admin", "opManager", "dManager"];

const router = Router();

// Self
router.get("/me", authenticate, ctrl.getMe);
router.get("/me/centers", authenticate, ctrl.listMyCenters);

// Collection
router.get("/", authenticate, authorize(...MANAGER_ROLES), ctrl.list);
router.post("/", authenticate, authorize("admin"), ctrl.create);

// Single
router.get("/:id", authenticate, authorize(...MANAGER_ROLES), ctrl.get);
router.patch("/:id", authenticate, authorize("admin"), ctrl.update);
router.delete("/:id", authenticate, authorize("admin"), ctrl.remove);

// Associations: deliverer ↔ centers
router.get("/:id/centers", authenticate, authorize(...MANAGER_ROLES), ctrl.listCenters);
router.post("/:id/centers/:centerId", authenticate, authorize(...MANAGER_ROLES), ctrl.assignCenter);
router.delete("/:id/centers/:centerId", authenticate, authorize(...MANAGER_ROLES), ctrl.unassignCenter);

// Scheduling helpers
router.patch("/:id/schedule", authenticate, authorize(...MANAGER_ROLES), ctrl.putActiveSchedule);
router.patch("/:id/next-schedule", authenticate, authorize(...MANAGER_ROLES), ctrl.putNextSchedule);
router.patch("/:id/schedule/day", authenticate, authorize(...MANAGER_ROLES), ctrl.patchDayShift);
router.get("/:id/availability", authenticate, authorize(...MANAGER_ROLES), ctrl.availability);
router.post("/:id/advance-month", authenticate, authorize(...MANAGER_ROLES), ctrl.advanceMonth);

export default router;
