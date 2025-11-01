import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/containerOps.controller";

const router = Router();

// ---- NEW: fetch by Mongo _id ----
router.get(
  "/:id",
  authenticate,
  authorize("picker", "opManager", "admin"),
  ctrl.getByMongoId
);

// ---- NEW: fetch by business containerId ----
// Put this BEFORE generic "/:id" routes if you ever use conflicting strings.
// Here we use a distinct path segment to avoid ambiguity.
router.get(
  "/by-container-id/:containerId",
  authenticate,
  authorize("picker", "opManager", "admin"),
  ctrl.getByContainerId
);

// Existing
router.post("/:id", authenticate, authorize("picker", "opManager", "admin"), ctrl.recordPicked);
router.post("/:id/pick", authenticate, authorize("picker", "opManager", "admin"), ctrl.recordPicked);
router.post("/:id/mark-depleted", authenticate, authorize("opManager", "admin"), ctrl.markDepletedIfZero);

// ---- Minimal logistics loop endpoints ----
// Auto-placement across multiple slots.  Sorter or ops manager can call this to split place a container.
router.post(
  "/:id/auto-place",
  authenticate,
  authorize("sorter", "opManager", "admin"),
  ctrl.autoPlace
);

// Consume (pick) a specific kg amount from a shelf/slot.  Picker or ops manager can call this.
router.post(
  "/:id/consume",
  authenticate,
  authorize("picker", "opManager", "admin"),
  ctrl.consumeWeight
);

export default router;
