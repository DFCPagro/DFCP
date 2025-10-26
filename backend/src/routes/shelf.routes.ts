// FILE: src/routes/shelf.routes.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/shelf.controller";

const router = Router();

/**
 * List shelves by logistic center (optional: zone, type)
 * GET /shelves?centerId=<mongoId>&zone=A&type=picker
 */
router.get(
  "/",
  authenticate,
  authorize("opManager", "picker", "sorter", "admin"),
  ctrl.list
);

/**
 * Non-crowded suggestions
 * NOTE: must appear BEFORE "/:id" to avoid param capture.
 */
router.get(
  "/suggest/non-crowded",
  authenticate,
  authorize("opManager", "admin"),
  ctrl.getNonCrowded
);
// Legacy alias kept for backward compatibility
router.get(
  "/_suggest/non-crowded",
  authenticate,
  authorize("opManager", "admin"),
  ctrl.getNonCrowded
);

/**
 * Read shelf + live crowd score
 */
router.get(
  "/:id",
  authenticate,
  authorize("opManager", "picker", "sorter", "admin"),
  ctrl.getShelf
);

/**
 * Refill a picker slot from a warehouse slot
 * POST /shelves/refill
 */
router.post(
  "/refill",
  authenticate,
  authorize("opManager", "sorter", "admin"),
  ctrl.refillFromWarehouse
);

/**
 * Put a container into a specific slot
 * POST /shelves/:shelfMongoId/slots/place
 */
router.post(
  "/:shelfMongoId/slots/place",
  authenticate,
  authorize("opManager", "sorter", "admin"),
  ctrl.placeContainer
);

/**
 * Consume weight from a slot (picker action)
 * POST /shelves/:id/slots/:slotId/consume
 */
router.post(
  "/:id/slots/:slotId/consume",
  authenticate,
  authorize("picker", "opManager", "admin"),
  ctrl.consumeFromSlot
);

/**
 * Move container between slots/shelves
 * POST /shelves/move
 */
router.post(
  "/move",
  authenticate,
  authorize("opManager", "sorter", "admin"),
  ctrl.moveContainer
);

/**
 * Crowd info for a shelf
 * GET /shelves/:id/crowd
 */
router.get(
  "/:id/crowd",
  authenticate,
  authorize("opManager", "picker", "sorter", "admin"),
  ctrl.crowdInfo
);

/**
 * Mark task start/end to affect crowding
 * POST /shelves/:id/crowd/start
 * POST /shelves/:id/crowd/end
 */
router.post(
  "/:id/crowd/start",
  authenticate,
  authorize("picker", "sorter", "opManager", "admin"),
  ctrl.markTaskStart
);
router.post(
  "/:id/crowd/end",
  authenticate,
  authorize("picker", "sorter", "opManager", "admin"),
  ctrl.markTaskEnd
);

/**
 * Empty a slot (toArea = "warehouse" | "out")
 * POST /shelves/:id/slots/empty
 */
router.post(
  "/:id/slots/empty",
  authenticate,
  authorize("opManager", "sorter", "admin"),
  ctrl.emptySlot
);

export default router;
