import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/containerOps.controller";

const router = Router();

// Add a pick audit on a container (complements shelf.consume)
router.post("/:id/pick", authenticate, authorize("picker", "opManager", "admin"), ctrl.recordPicked);

// If slot reached 0kg, optionally flip containerOps state
router.post("/:id/mark-depleted", authenticate, authorize("opManager", "admin"), ctrl.markDepletedIfZero);

export default router;
